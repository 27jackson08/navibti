import { describe, expect, it } from 'vitest';
import { getCheckIns, getPatient, recordClinicianDecision, seededOn } from './store';
import { buildSession } from '@/engine/session';
import { evaluate } from '@/engine/stage/machine';

/**
 * Clearance is the one thing NaviTBI refuses to decide and had, until now, no
 * way to be told. Maya sat at Return-to-Sport step 3 permanently: the field
 * existed and nothing could write to it.
 */

const sessionFor = (id: string) =>
  buildSession(getPatient(id)!, getCheckIns(id), seededOn);

describe('recording a clearance decision', () => {
  it('attributes it to a named person and stamps it', () => {
    recordClinicianDecision('maya', {
      clearance: { recordedBy: 'Dr Amara Reyes', coversUpToStep: 4 },
    });
    const patient = getPatient('maya')!;

    expect(patient.clearance?.recordedBy).toBe('Dr Amara Reyes');
    expect(patient.clearance?.coversUpToStep).toBe(4);
    expect(patient.clearance?.recordedAt).toBeInstanceOf(Date);
  });

  it('opens the gate it covers, and no further', () => {
    recordClinicianDecision('maya', {
      clearance: { recordedBy: 'Dr Reyes', coversUpToStep: 4 },
    });
    const session = sessionFor('maya');

    const atFour = evaluate(
      { ...session.stage, step: 3, fullReturnToSchool: true },
      {
        at: new Date(`${seededOn}T20:00:00Z`),
        exacerbation: { deltaPoints: 0, durationMinutes: 0 },
        redFlagIds: [],
        symptomFreeWithExertion: true,
      },
    );
    expect(atFour.kind).toBe('advance');

    // Cleared to 4 is not cleared to 6.
    const atSix = evaluate(
      { ...session.stage, step: 5, fullReturnToSchool: true },
      {
        at: new Date(`${seededOn}T20:00:00Z`),
        exacerbation: { deltaPoints: 0, durationMinutes: 0 },
        redFlagIds: [],
        symptomFreeWithExertion: true,
      },
    );
    expect(atSix.kind).toBe('blocked');
  });

  it('refuses an unknown patient rather than inventing one', () => {
    expect(
      recordClinicianDecision('nobody', { clearance: { recordedBy: 'X', coversUpToStep: 4 } }),
    ).toBe(false);
  });
});

describe('clinician ceilings', () => {
  it('outrank the guideline floor', () => {
    // A general default about minimum activity has no business overriding
    // someone who has examined this particular patient.
    const before = sessionFor('amara').plan!.recommendations.find(
      (r) => r.domain === 'physical',
    )!;
    expect(before.dose).toBeGreaterThan(0);

    recordClinicianDecision('amara', { clinicianCaps: { physical: 0 } });
    const after = sessionFor('amara').plan!.recommendations.find((r) => r.domain === 'physical')!;

    expect(after.dose).toBe(0);
    expect(after.binding).toBe('clinician');
  });

  it('only restrict, never permit more', () => {
    recordClinicianDecision('tom', { clinicianCaps: { cognitive: 100000 } });
    const item = sessionFor('tom').plan!.recommendations.find((r) => r.domain === 'cognitive')!;

    expect(item.dose).toBeLessThan(100000);
    expect(item.binding).not.toBe('clinician');
  });

  it('leave untouched domains alone', () => {
    recordClinicianDecision('tom', { clinicianCaps: { visualVestibular: 10 } });
    const plan = sessionFor('tom').plan!;

    expect(plan.recommendations.find((r) => r.domain === 'visualVestibular')!.dose).toBe(10);
    expect(plan.recommendations.find((r) => r.domain === 'cognitive')!.binding).not.toBe(
      'clinician',
    );
  });
});
