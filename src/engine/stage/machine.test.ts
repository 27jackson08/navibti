import { describe, expect, it } from 'vitest';
import { applyDecision, evaluate, hoursAtStep, isClearedFor, schoolAbsenceWarning } from './machine';
import type { DayObservation, StageState } from './types';

const ENTERED = new Date('2026-08-24T08:00:00Z');
const hoursLater = (h: number) => new Date(ENTERED.getTime() + h * 3600_000);

const TOLERATED = { deltaPoints: 1, durationMinutes: 30 };
const FLARE = { deltaPoints: 4, durationMinutes: 180 };

function state(overrides: Partial<StageState> = {}): StageState {
  return { protocol: 'return-to-sport', step: 2, enteredAt: ENTERED, ...overrides };
}

function observation(overrides: Partial<DayObservation> = {}): DayObservation {
  return { at: hoursLater(25), exacerbation: TOLERATED, redFlagIds: [], ...overrides };
}

describe('red flags outrank everything', () => {
  it('halts even when the patient is otherwise ready to advance', () => {
    const decision = evaluate(state(), observation({ redFlagIds: ['severe-headache'] }));
    expect(decision.kind).toBe('halt');
  });

  it('halts even past the relative-rest ceiling, which otherwise forces movement', () => {
    const decision = evaluate(
      state({ step: 1 }),
      observation({ at: hoursLater(60), redFlagIds: ['seizure'] }),
    );
    expect(decision.kind).toBe('halt');
  });

  it('carries the flags and an unambiguous instruction', () => {
    const decision = evaluate(state(), observation({ redFlagIds: ['neck-pain', 'vomiting'] }));
    if (decision.kind !== 'halt') throw new Error('expected halt');
    expect(decision.redFlagIds).toEqual(['neck-pain', 'vomiting']);
    expect(decision.instruction).toMatch(/urgent medical care/i);
    expect(decision.citation).toBe('crt6-2023');
  });
});

describe('the relative-rest ceiling', () => {
  it('holds inside the window', () => {
    const decision = evaluate(state({ step: 1 }), observation({ at: hoursLater(12) }));
    expect(decision.kind).toBe('hold');
  });

  it('forces movement at 48 hours', () => {
    const decision = evaluate(state({ step: 1 }), observation({ at: hoursLater(48) }));
    expect(decision).toMatchObject({ kind: 'advance', from: 1, to: 2, cautious: true });
  });

  it('still forces movement when the patient flared, because rest is not the answer', () => {
    // This is the rule that separates NaviTBI from a pacing app. A flare on day
    // two does not license a third day in a dark room; it lowers the dose.
    const decision = evaluate(
      state({ step: 1 }),
      observation({ at: hoursLater(50), exacerbation: FLARE }),
    );
    expect(decision).toMatchObject({ kind: 'advance', cautious: true });
    expect(decision.citation).toBe('amsterdam-2023');
  });

  it('marks the advance cautious so the dose planner stays conservative', () => {
    const decision = evaluate(state({ step: 1 }), observation({ at: hoursLater(48) }));
    if (decision.kind !== 'advance') throw new Error('expected advance');
    expect(decision.cautious).toBe(true);
  });
});

describe('exacerbation handling follows the step, not a global rule', () => {
  it.each([1, 2, 3])('sport step %i holds and retries tomorrow', (step) => {
    const decision = evaluate(
      state({ step }),
      observation({ at: hoursLater(30), exacerbation: FLARE }),
    );
    expect(decision).toMatchObject({ kind: 'hold', step });
  });

  it.each([4, 5, 6])('sport step %i drops back to step 3', (step) => {
    const decision = evaluate(
      state({ step, clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 6 } }),
      observation({ at: hoursLater(30), exacerbation: FLARE }),
    );
    expect(decision).toMatchObject({ kind: 'regress', from: step, to: 3 });
  });

  it.each([2, 3])('learn step %i slows progression rather than withdrawing the student', (step) => {
    const decision = evaluate(
      state({ protocol: 'return-to-learn', step }),
      observation({ at: hoursLater(30), exacerbation: FLARE }),
    );
    expect(decision).toMatchObject({ kind: 'hold', step });
  });

  it('treats a small but long-lasting rise as an exceedance', () => {
    const decision = evaluate(
      state({ step: 2 }),
      observation({ at: hoursLater(30), exacerbation: { deltaPoints: 1, durationMinutes: 120 } }),
    );
    expect(decision.kind).toBe('hold');
  });

  it('accepts the boundary case of exactly 2 points for exactly an hour', () => {
    const decision = evaluate(
      state({ step: 2 }),
      observation({ at: hoursLater(30), exacerbation: { deltaPoints: 2, durationMinutes: 60 } }),
    );
    expect(decision.kind).toBe('advance');
  });
});

describe('minimum dwell time', () => {
  it('holds before 24 hours have passed', () => {
    const decision = evaluate(state({ step: 2 }), observation({ at: hoursLater(23) }));
    expect(decision).toMatchObject({ kind: 'hold', step: 2 });
    expect(decision.reason).toMatch(/minimum of 24 hours/);
  });

  it('permits advancing at exactly 24 hours', () => {
    const decision = evaluate(state({ step: 2 }), observation({ at: hoursLater(24) }));
    expect(decision.kind).toBe('advance');
  });
});

describe('the sport clearance gate', () => {
  const readyAtThree = state({ step: 3, fullReturnToSchool: true });
  const cleanExertion = observation({ at: hoursLater(30), symptomFreeWithExertion: true });

  it('blocks step 4 with no clearance recorded', () => {
    const decision = evaluate(readyAtThree, cleanExertion);
    expect(decision).toMatchObject({ kind: 'blocked', blockedFrom: 4 });
    if (decision.kind !== 'blocked') throw new Error('expected blocked');
    expect(decision.requirements.join(' ')).toMatch(/does not issue clearance/i);
  });

  it('blocks step 4 when cleared but not fully back at school', () => {
    const decision = evaluate(
      state({
        step: 3,
        fullReturnToSchool: false,
        clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 4 },
      }),
      cleanExertion,
    );
    if (decision.kind !== 'blocked') throw new Error('expected blocked');
    expect(decision.requirements.join(' ')).toMatch(/full return to school/i);
  });

  it('blocks step 4 when exertion has not been shown symptom-free', () => {
    const decision = evaluate(
      state({
        step: 3,
        fullReturnToSchool: true,
        clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 4 },
      }),
      observation({ at: hoursLater(30), symptomFreeWithExertion: false }),
    );
    if (decision.kind !== 'blocked') throw new Error('expected blocked');
    expect(decision.requirements.join(' ')).toMatch(/exertion/i);
  });

  it('advances only when clearance, school return and exertion all line up', () => {
    const decision = evaluate(
      state({
        step: 3,
        fullReturnToSchool: true,
        clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 4 },
      }),
      cleanExertion,
    );
    expect(decision).toMatchObject({ kind: 'advance', from: 3, to: 4 });
  });

  it('never extrapolates clearance upward to a step it does not cover', () => {
    const decision = evaluate(
      state({
        step: 5,
        fullReturnToSchool: true,
        clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 5 },
      }),
      observation({ at: hoursLater(30) }),
    );
    expect(decision).toMatchObject({ kind: 'blocked', blockedFrom: 6 });
  });
});

describe('return to learn is never gated on a doctor', () => {
  it.each([1, 2, 3])('advances from step %i with no clearance recorded', (step) => {
    const decision = evaluate(
      state({ protocol: 'return-to-learn', step }),
      observation({ at: hoursLater(step === 1 ? 48 : 30) }),
    );
    expect(decision.kind).toBe('advance');
  });

  it('never produces a blocked decision at any step', () => {
    for (const step of [1, 2, 3, 4]) {
      const decision = evaluate(
        state({ protocol: 'return-to-learn', step }),
        observation({ at: hoursLater(50) }),
      );
      expect(decision.kind).not.toBe('blocked');
    }
  });
});

describe('final step', () => {
  it('holds at sport step 6 rather than inventing a seventh', () => {
    const decision = evaluate(
      state({ step: 6, clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 6 } }),
      observation({ at: hoursLater(72) }),
    );
    expect(decision).toMatchObject({ kind: 'hold', step: 6 });
    expect(decision.reason).toMatch(/final step/i);
  });

  it('holds at learn step 4', () => {
    const decision = evaluate(
      state({ protocol: 'return-to-learn', step: 4 }),
      observation({ at: hoursLater(72) }),
    );
    expect(decision).toMatchObject({ kind: 'hold', step: 4 });
  });
});

describe('applyDecision', () => {
  const now = hoursLater(30);

  it('moves the step and resets the clock on advance', () => {
    const before = state({ step: 2 });
    const after = applyDecision(before, evaluate(before, observation({ at: now })), now);
    expect(after.step).toBe(3);
    expect(after.enteredAt).toEqual(now);
  });

  it('does not mutate the state it was given', () => {
    const before = state({ step: 2 });
    applyDecision(before, evaluate(before, observation({ at: now })), now);
    expect(before.step).toBe(2);
    expect(before.enteredAt).toEqual(ENTERED);
  });

  it('leaves state untouched on hold and halt', () => {
    const before = state({ step: 2 });
    for (const flags of [[], ['seizure']]) {
      const decision = evaluate(before, observation({ at: hoursLater(2), redFlagIds: flags }));
      expect(applyDecision(before, decision, now)).toEqual(before);
    }
  });

  it('preserves clearance across a regression', () => {
    const clearance = { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 6 };
    const before = state({ step: 5, clearance });
    const decision = evaluate(before, observation({ at: now, exacerbation: FLARE }));
    expect(applyDecision(before, decision, now)).toMatchObject({ step: 3, clearance });
  });
});

describe('helpers', () => {
  it('isClearedFor refuses absent and insufficient clearance', () => {
    expect(isClearedFor(state(), 4)).toBe(false);
    expect(
      isClearedFor(
        state({ clearance: { recordedBy: 'Dr Reyes', recordedAt: ENTERED, coversUpToStep: 4 } }),
        6,
      ),
    ).toBe(false);
  });

  it('hoursAtStep measures from entry', () => {
    expect(hoursAtStep(state(), hoursLater(36))).toBe(36);
  });

  it('warns past one week out of school, not before', () => {
    expect(schoolAbsenceWarning(7)).toBeNull();
    expect(schoolAbsenceWarning(8)).toMatch(/not generally recommended/);
  });
});
