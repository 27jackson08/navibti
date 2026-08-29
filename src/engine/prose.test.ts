import { describe, expect, it } from 'vitest';
import type { AccommodationRole } from '@/data/accommodations';
import { LOAD_DOMAINS, type LoadDomain } from '@/data/guidelines';
import { getCheckIns, getPatient, listPatients } from '@/db/store';
import { seededOn } from '@/db/store';
import { composePacket } from '@/engine/packet/compose';
import { clinicianSummary } from '@/engine/packet/clinician';
import { deriveSlots, fillSlots } from '@/engine/packet/slots';
import { buildSession, type Session } from '@/engine/session';
import { ACCOMMODATION_LIBRARY } from '@/data/accommodations';
import { unmetSupports } from '@/engine/packet/environment';
import { formatDose, unitFor } from '@/components/plan/DoseCard';

/**
 * Everything the engine says out loud, checked for the same handful of ways a
 * generated sentence goes wrong.
 *
 * Four defects of this family have been found one at a time — "Cap live
 * meetings at 0 per day", "a ocular-motor presentation", "1 focused minutes",
 * and a raw "{{hours}}" echoed back to a recipient. Each was invisible in the
 * template and only appeared once the value was substituted, so each was found
 * by rendering rather than by reading. This renders everything it can reach,
 * across the boundary values the demo data happens to avoid.
 *
 * What it reaches is bounded by the personas and ceilings below, and that limit
 * is worth stating rather than discovering later. Checked against the four:
 * the echoed accommodation and the dose figure are caught here. The article in
 * the sensitivity summary is not — producing it needs a posterior that ranks a
 * particular domain first, which no seeded patient does — and is covered
 * directly in attribution.test.ts, which renders the sentence for every domain
 * instead of hoping one turns up.
 *
 * So: a net, not a proof. It catches shapes rather than meaning, and only in
 * the prose these inputs happen to generate. Both halves of that were verified
 * by reintroducing each defect and counting what this file reported.
 */
const ROLES: readonly AccommodationRole[] = ['school', 'employer', 'caregiver'];

const MALFORMED: readonly { readonly pattern: RegExp; readonly name: string }[] = [
  { pattern: /\{\{|\}\}/, name: 'an unfilled template placeholder' },
  { pattern: /\bNaN\b|\bInfinity\b|\bundefined\b|\bnull\b/, name: 'a non-value' },
  // The lookbehind matters: without it "0.0 hours of sleep debt" reads as
  // "0 hours" and "2.1 hours" reads as "1 hours". Both are correct decimals,
  // and both failed the first version of this check.
  { pattern: /(?<![\d.])0 (minutes|hours|per day|days)\b/i, name: 'a quantity of nothing' },
  {
    // The optional word matters: the units are "focused minutes" and
    // "exertion-weighted minutes", so a pattern requiring the noun to follow
    // the number directly misses "1 focused minutes" — which is the defect
    // this line was written for.
    pattern: /(?<![\d.])1 (?:[\w-]+ )?(minutes|hours|days|weeks|items|steps|check-ins)\b/i,
    name: 'a plural of one',
  },
  { pattern: /\ban [^aeiou\W]/i, name: '"an" before a consonant' },
  { pattern: /\ba [aeiou]/, name: '"a" before a vowel' },
  { pattern: / {2,}/, name: 'a doubled space' },
  { pattern: / [.,;]/, name: 'a space before punctuation' },
  { pattern: /\.\s*\./, name: 'a doubled full stop' },
];

/**
 * Words that begin with a vowel letter but not a vowel sound, and vice versa.
 * The article checks above are crude by design; these are the exceptions that
 * appear in this product's own vocabulary.
 */
const ARTICLE_EXCEPTIONS = /\ban (hour|honest)|\ba (uni|use|user|one-)/i;

function assertWellFormed(text: string, where: string): void {
  for (const { pattern, name } of MALFORMED) {
    if (!pattern.test(text)) continue;
    if (ARTICLE_EXCEPTIONS.test(text) && name.includes('"a')) continue;

    expect.fail(`${where} contains ${name}:\n    "${text.trim()}"`);
  }
}

/** Everything a session says, in one list. */
function proseOf(session: Session): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  const add = (text: string | undefined | null, where: string) => {
    if (typeof text === 'string' && text.trim().length > 0) out.push({ text, where });
  };

  add(session.sensitivity.summary, 'sensitivity summary');
  add(session.redFlag?.instruction, 'red-flag instruction');
  add(session.lastDecision?.reason, 'stage decision');
  session.escalations.forEach((line, i) => add(line, `escalation ${i}`));
  session.underExposure.forEach((finding) => add(finding.message, `under-exposure ${finding.domain}`));

  const slots = session.plan ? deriveSlots(session.plan) : null;
  session.unmetSupports.forEach((item) =>
    add(slots ? fillSlots(item.text, slots) : item.text, `unmet support ${item.accommodationId}`),
  );

  return out;
}

/**
 * Ceilings that push each domain onto the boundaries the seeded personas never
 * reach: nothing at all, and exactly one unit.
 */
const CEILINGS: readonly (Partial<Record<LoadDomain, number>> | undefined)[] = [
  undefined,
  Object.fromEntries(LOAD_DOMAINS.map((domain) => [domain, 0])),
  Object.fromEntries(LOAD_DOMAINS.map((domain) => [domain, 1])),
  { cognitive: 1 },
  { cognitive: 0, visualVestibular: 1 },
];

describe('everything the engine says out loud', () => {
  const patients = listPatients();

  it('has patients to say it about', () => {
    expect(patients.length).toBeGreaterThan(2);
  });

  it.each(
    patients.flatMap((patient) =>
      CEILINGS.map((caps, index) => [patient.id, index, caps] as const),
    ),
  )('%s reads correctly under ceiling %i', (id, _index, caps) => {
    const patient = { ...getPatient(id)!, clinicianCaps: caps };
    const session = buildSession(patient, getCheckIns(id), seededOn);

    for (const { text, where } of proseOf(session)) {
      assertWellFormed(text, `${id}: ${where}`);
    }
  });

  it.each(
    listPatients().flatMap((patient) =>
      CEILINGS.map((caps, index) => [patient.id, index, caps] as const),
    ),
  )('%s packets read correctly under ceiling %i', (id, _index, caps) => {
    const patient = { ...getPatient(id)!, clinicianCaps: caps };
    const session = buildSession(patient, getCheckIns(id), seededOn);

    for (const role of ROLES) {
      const packet = composePacket(session, role);
      if (!packet) continue;

      assertWellFormed(packet.intro, `${id}/${role}: intro`);
      assertWellFormed(packet.title, `${id}/${role}: title`);
      for (const item of packet.items) {
        assertWellFormed(item.text, `${id}/${role}: ${item.id}`);
        assertWellFormed(item.rationale, `${id}/${role}: ${item.id} rationale`);
      }
      if (packet.emptyReason) assertWellFormed(packet.emptyReason, `${id}/${role}: empty reason`);
    }
  });

  it.each(
    listPatients().flatMap((patient) =>
      CEILINGS.map((caps, index) => [patient.id, index, caps] as const),
    ),
  )('%s dose figures read correctly under ceiling %i', (id, _index, caps) => {
    // The card renders the number and its unit as separate elements, so the
    // sentence a reader actually sees exists nowhere in the source. "1 focused
    // minutes" was invisible until the two were put back together.
    const patient = { ...getPatient(id)!, clinicianCaps: caps };
    const session = buildSession(patient, getCheckIns(id), seededOn);

    for (const item of session.plan?.recommendations ?? []) {
      const rendered = `${formatDose(item.dose, item.unit)} ${unitFor(item.dose, item.unit)}`;
      assertWellFormed(rendered, `${id}: ${item.domain} figure`);
    }
  });

  it.each(
    listPatients().flatMap((patient) =>
      CEILINGS.map((caps, index) => [patient.id, index, caps] as const),
    ),
  )('every echoed accommodation reads correctly for %s under ceiling %i', (id, _index, caps) => {
    // Not only the items a packet selected. Both echo-back surfaces show an
    // accommodation that is no longer in today's packet, which is how "Cap live
    // meetings at 0 per day" reached a reader after the composer had already
    // been taught not to select it.
    //
    // The library's own templates are deliberately *not* required to read well
    // at every value — the design's answer to that is selection, and the
    // composer is tested separately for it. What has to hold here is that
    // whatever the echo shows is well formed.
    const patient = { ...getPatient(id)!, clinicianCaps: caps };
    const session = buildSession(patient, getCheckIns(id), seededOn);
    if (!session.plan) return;

    const slots = deriveSlots(session.plan);
    const everything = new Set(ACCOMMODATION_LIBRARY.map((item) => item.id));
    for (const echoed of unmetSupports(everything)) {
      assertWellFormed(fillSlots(echoed.text, slots), `${id}: echoed ${echoed.accommodationId}`);
    }
  });

  it.each(listPatients().map((patient) => patient.id))(
    '%s clinician summary reads correctly',
    (id) => {
      const summary = clinicianSummary(getPatient(id)!, getCheckIns(id), seededOn);
      summary.openQuestions.forEach((q, i) => assertWellFormed(q, `${id}: open question ${i}`));
      summary.escalations.forEach((e, i) => assertWellFormed(e, `${id}: escalation ${i}`));
    },
  );
});
