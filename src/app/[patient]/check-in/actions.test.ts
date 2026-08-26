import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS } from '@/data/guidelines';
import { MAX_REPORTABLE_DOSE, REFERENCE_DOSES } from '@/engine/tolerance/units';

/**
 * The server action itself needs a request context to run, so what is checked
 * here is the bound it enforces — which is where the defect was.
 */
describe('what a check-in is allowed to report', () => {
  it('bounds every domain, in that domain’s own unit', () => {
    for (const domain of LOAD_DOMAINS) {
      expect(MAX_REPORTABLE_DOSE[domain], domain).toBeGreaterThan(
        REFERENCE_DOSES[domain].reference,
      );
    }
  });

  it('does not let a minute-shaped ceiling govern a domain measured in hours', () => {
    // The bug: sleep debt has a reference of 3 hours and was validated against
    // the same 1440 as the minute domains — 480 times the reference dose, in a
    // single request, straight into the posterior.
    const sleep = MAX_REPORTABLE_DOSE.sleepFatigue / REFERENCE_DOSES.sleepFatigue.reference;
    for (const domain of LOAD_DOMAINS) {
      const ratio = MAX_REPORTABLE_DOSE[domain] / REFERENCE_DOSES[domain].reference;
      expect(ratio, `${domain} ceiling is ${ratio}x its reference dose`).toBeLessThan(20);
    }
    expect(sleep).toBeLessThan(5);
  });

  it('keeps sleep debt below what a night can lose', () => {
    expect(MAX_REPORTABLE_DOSE.sleepFatigue).toBeLessThanOrEqual(12);
  });

  it('keeps every other domain inside a waking day', () => {
    for (const domain of LOAD_DOMAINS) {
      if (domain === 'sleepFatigue') continue;
      expect(MAX_REPORTABLE_DOSE[domain], domain).toBeLessThanOrEqual(16 * 60);
    }
  });
});
