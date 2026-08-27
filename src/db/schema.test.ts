import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The schema is the stated target for real persistence, and store.ts says the
 * in-memory shapes match it. They had stopped matching: the patients table was
 * missing protocol, roles and fullReturnToSchool, there was nowhere to put a
 * clinician's clearance or ceilings, and the entire recipient response loop —
 * the half of the product that makes it a coordinator — had no table at all.
 *
 * A schema nobody runs drifts silently, because nothing fails. This is what
 * fails instead.
 */
const schema = readFileSync(new URL('./schema.ts', import.meta.url), 'utf8');
const session = readFileSync(new URL('../engine/session.ts', import.meta.url), 'utf8');

function tableNames(): string[] {
  return [...schema.matchAll(/pgTable\(\s*\n?\s*'([a-z_]+)'/g)].map((m) => m[1]);
}

function columnsOf(table: string): string[] {
  const start = schema.indexOf(`pgTable(\n  '${table}'`);
  const inline = schema.indexOf(`pgTable('${table}'`);
  const from = start >= 0 ? start : inline;
  expect(from, `table ${table} not found`).toBeGreaterThan(-1);

  const body = schema.slice(from, schema.indexOf('\n);', from));
  // Enum-typed columns count too — protocol and roles are declared that way,
  // and leaving them out made this pass while the columns were missing.
  return [
    ...body.matchAll(
      /\b(?:uuid|text|boolean|date|timestamp|integer|jsonb|real|doublePrecision|\w+Enum)\('([a-z_]+)'\)/g,
    ),
  ].map(
    (m) => m[1],
  );
}

describe('the schema covers what the app actually stores', () => {
  it('parses', () => {
    expect(tableNames().length).toBeGreaterThan(5);
  });

  it.each([
    ['patients', 'who is being tracked'],
    ['check_ins', 'the only input that moves the model'],
    ['share_links', 'how a packet reaches anyone'],
    ['access_log', 'who opened what, which the patient can see'],
    ['clinician_decisions', 'clearance and hard ceilings'],
    ['recipient_responses', 'what the school or workplace sent back'],
  ])('has a table for %s — %s', (table) => {
    expect(tableNames()).toContain(table);
  });

  it('carries every stored field of a patient', () => {
    // Parsed from the interface rather than listed here, so adding a field to
    // Patient without a home in the schema fails rather than passes quietly.
    const block = session.slice(
      session.indexOf('export interface Patient'),
      session.indexOf('}', session.indexOf('export interface Patient')),
    );
    const fields = [...block.matchAll(/readonly (\w+)\??:/g)].map((m) => m[1]);
    expect(fields, 'Patient interface not parsed').toContain('injuryDate');

    const snake = (name: string) => name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const columns = columnsOf('patients');

    // Clinician decisions live in their own append-only table, because the
    // record of who decided what is the point and a column would overwrite it.
    const elsewhere = new Set(['clearance', 'clinicianCaps']);

    for (const field of fields) {
      if (elsewhere.has(field)) continue;
      expect(columns, `patients has no column for Patient.${field}`).toContain(snake(field));
    }

    for (const field of elsewhere) {
      expect(tableNames(), `${field} has nowhere to live`).toContain('clinician_decisions');
    }
  });

  it('lets a recipient hold one standing answer per accommodation', () => {
    // Not a detail: without it, changing their mind stacks another opinion on
    // top rather than replacing the first, and the plan reads the wrong one.
    expect(schema).toContain('recipient_responses_one_per_item');
  });
});
