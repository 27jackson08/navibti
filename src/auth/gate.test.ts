import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every mutation scoped to a patient goes through requireActor.
 *
 * Asserted structurally rather than trusted to review, because it has already
 * failed once: withdrawUnavailable was added to `[patient]/today/actions.ts`
 * without the gate, and a crafted request could have raised any patient's
 * limits. Nothing about that file looked wrong — the gate is simply easy to
 * forget, and a comment claiming it is "the single gate every mutation passes
 * through" does not enforce itself.
 *
 * Actions under `/s/[token]` are deliberately outside this rule. Their
 * authorisation is the token: a recipient has no account and never will, which
 * is the entire reason share links exist.
 */
const APP = new URL('../app/', import.meta.url);

function serverActionFiles(dir: URL, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) serverActionFiles(child, found);
    else if (entry.name.endsWith('.ts') && readFileSync(child, 'utf8').startsWith("'use server'")) {
      found.push(child.pathname.slice(APP.pathname.length));
    }
  }
  return found;
}

describe('the authorisation gate', () => {
  const files = serverActionFiles(APP);

  it('finds the server actions at all', () => {
    expect(files.length, 'no server action files located').toBeGreaterThan(2);
  });

  it.each(
    serverActionFiles(APP).filter((path) => path.startsWith('[patient]/')),
  )('%s calls requireActor', (path) => {
    const source = readFileSync(new URL(path, APP), 'utf8');
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1]);

    expect(exported.length, `${path} exports no action`).toBeGreaterThan(0);
    expect(source, `${path} mutates a patient without the gate`).toContain('requireActor(');

    // One call per exported action, so adding a second action to an existing
    // file cannot ride in on the first one's gate.
    const gates = [...source.matchAll(/requireActor\(/g)].length;
    expect(gates, `${path} has ${exported.length} actions and ${gates} gates`).toBeGreaterThanOrEqual(
      exported.length,
    );
  });

  it('leaves the token-authorised actions alone', () => {
    // Not an oversight: holding the link is a recipient's whole authorisation.
    for (const path of files.filter((entry) => entry.startsWith('s/[token]/'))) {
      const source = readFileSync(new URL(path, APP), 'utf8');
      expect(source, path).toMatch(/resolveToken\(/);
    }
  });
});
