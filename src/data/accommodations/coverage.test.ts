import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS, LOAD_DOMAIN_LABELS } from '@/data/guidelines';
import { ACCOMMODATIONS_BY_ROLE, type AccommodationRole } from './index';

/**
 * Every role can act on every load domain.
 *
 * The caregiver packet had nothing at all for screens and light, or for
 * physical activity — the two domains a household controls most directly, and
 * the second is the one the engine allocates first precisely because the
 * guidance wants it protected. Nothing failed: the packet simply never
 * mentioned them, and `domainsLeftUnsupported` is deliberately quiet about a
 * domain the library never covered, since its job is reporting supports the
 * environment removed rather than gaps in our own writing.
 *
 * So the gap is asserted here instead. This is coverage, not adequacy — one
 * item per domain proves only that the domain was considered.
 */
const ROLES: readonly AccommodationRole[] = ['school', 'employer', 'caregiver'];

describe('what each audience is given something to do', () => {
  it.each(
    ROLES.flatMap((role) => LOAD_DOMAINS.map((domain) => [role, domain] as const)),
  )('%s can act on %s', (role, domain) => {
    const items = ACCOMMODATIONS_BY_ROLE[role].filter((item) => item.domain === domain);
    expect(
      items.length,
      `no ${LOAD_DOMAIN_LABELS[domain]} accommodation for a ${role}`,
    ).toBeGreaterThan(0);
  });

  it.each(ROLES)('gives %s something on the worst days it applies to', (role) => {
    // The days that matter most are the worst ones. A library that only has
    // advice for someone already improving is not much of a library.
    //
    // Measured from the earliest step the role itself appears at, not from step
    // 1: return-to-learn step 1 is daily activity at home before any return, so
    // a school or workplace adjustment there would have nobody to act on it.
    // Only the caregiver is in the room that early.
    const items = ACCOMMODATIONS_BY_ROLE[role];
    const firstStep = Math.min(...items.map((item) => item.minStep));

    const onTheWorstDays = items.filter(
      (item) => item.minStep <= firstStep && item.bands.includes('very-low'),
    );
    expect(
      onTheWorstDays.length,
      `${role} enters at step ${firstStep} with nothing for a very-low day`,
    ).toBeGreaterThan(2);
  });

  it('has the caregiver present from the first day and the others later', () => {
    // Not incidental — it is the shape of the guidance. Someone is at home
    // before they are anywhere else.
    const firstStepOf = (role: AccommodationRole) =>
      Math.min(...ACCOMMODATIONS_BY_ROLE[role].map((item) => item.minStep));

    expect(firstStepOf('caregiver')).toBe(1);
    expect(firstStepOf('school')).toBeGreaterThan(1);
    expect(firstStepOf('employer')).toBeGreaterThan(1);
  });

  it.each(ROLES)('%s still has something to say once someone is nearly back', (role) => {
    const late = ACCOMMODATIONS_BY_ROLE[role].filter(
      (item) => item.maxStep >= 3 && item.bands.includes('near-full'),
    );
    expect(late.length, `${role} goes silent at near-full`).toBeGreaterThan(0);
  });
});
