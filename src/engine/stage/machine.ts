/**
 * The deterministic half of NaviTBI.
 *
 * `evaluate` applies the published progression rules in a fixed precedence
 * order. The order is itself a safety property and is tested directly:
 *
 *   1. Red flags halt everything.
 *   2. The relative-rest ceiling forces movement off step 1.
 *   3. More-than-mild-and-brief exacerbation applies the step's own rule.
 *   4. Minimum dwell time holds the patient in place.
 *   5. Clearance and school gates block.
 *   6. Otherwise the patient may advance.
 *
 * Rule 2 sitting above rule 3 is deliberate and is the anti-strict-rest
 * behaviour: extended rest is no longer recommended, so a flare on day two does
 * not license a third day in a dark room. The step moves; the dose does not.
 */

import {
  MAX_SCHOOL_ABSENCE_DAYS,
  PROTOCOLS,
  RED_FLAG_INSTRUCTION,
  RELATIVE_REST_MAX_HOURS,
  isMildAndBrief,
  stepOf,
} from '@/data/guidelines';
import type { DayObservation, StageDecision, StageState } from './types';

const HOURS = 1000 * 60 * 60;

export function hoursAtStep(state: StageState, now: Date): number {
  return (now.getTime() - state.enteredAt.getTime()) / HOURS;
}

/**
 * Whether recorded clearance covers entry to `step`.
 *
 * Absent clearance is never treated as permission, and clearance for a lower
 * step is never extrapolated upward.
 */
export function isClearedFor(state: StageState, step: number): boolean {
  return state.clearance !== undefined && state.clearance.coversUpToStep >= step;
}

function unmetRequirements(state: StageState, nextStep: number): string[] {
  const protocol = PROTOCOLS[state.protocol];
  const target = stepOf(protocol, nextStep);
  const unmet: string[] = [];

  if (target.requiresMedicalClearance && !isClearedFor(state, nextStep)) {
    unmet.push(
      `Written medical clearance covering step ${nextStep} has not been recorded. ` +
        'NaviTBI does not issue clearance.',
    );
  }

  const needsSchool =
    state.protocol === 'return-to-sport' && nextStep === 4 && state.fullReturnToSchool !== true;
  if (needsSchool) {
    unmet.push('A full return to school is required before non-contact drills.');
  }

  // Leaving sport step 3 also requires symptom-free exertion, which the caller
  // supplies per-day; handled in `evaluate` where the observation is in scope.
  return unmet;
}

export function evaluate(
  state: StageState,
  observation: DayObservation,
): StageDecision {
  const protocol = PROTOCOLS[state.protocol];
  const current = stepOf(protocol, state.step);
  const elapsed = hoursAtStep(state, observation.at);

  // 1 — Red flags outrank every other consideration.
  if (observation.redFlagIds.length > 0) {
    return {
      kind: 'halt',
      redFlagIds: observation.redFlagIds,
      instruction: RED_FLAG_INSTRUCTION,
      reason: 'A red-flag symptom was reported.',
      citation: 'crt6-2023',
    };
  }

  const isFinalStep = state.step >= protocol.steps.length;

  // 2 — The relative-rest ceiling. Extended rest is not a safe default.
  if (state.step === 1 && current.maxHoursAtStep !== null && elapsed >= current.maxHoursAtStep) {
    return {
      kind: 'advance',
      from: state.step,
      to: 2,
      cautious: true,
      reason:
        `Relative rest is capped at ${RELATIVE_REST_MAX_HOURS.value} hours. Moving on to light ` +
        'activity is what the guideline recommends, at a small dose rather than a normal one.',
      citation: 'amsterdam-2023',
    };
  }

  // 3 — Exacerbation beyond "mild and brief" applies this step's own rule.
  if (!isMildAndBrief(observation.exacerbation)) {
    const action = current.onExceedance;

    if (action.kind === 'return-to-step') {
      return {
        kind: 'regress',
        from: state.step,
        to: action.step,
        reason: action.reason,
        citation: protocol.citation,
      };
    }

    return {
      kind: 'hold',
      step: state.step,
      reason:
        action.kind === 'stop-and-retry-next-day'
          ? 'Symptoms rose by more than 2 points or for longer than an hour. Stop the activity ' +
            'and attempt this step again tomorrow.'
          : action.reason,
      citation: protocol.citation,
    };
  }

  if (isFinalStep) {
    return {
      kind: 'hold',
      step: state.step,
      reason: `Already at the final step of ${protocol.name}.`,
      citation: protocol.citation,
    };
  }

  // 4 — Minimum dwell time.
  if (elapsed < current.minHoursBeforeAdvance) {
    return {
      kind: 'hold',
      step: state.step,
      reason:
        `Each step takes a minimum of ${current.minHoursBeforeAdvance} hours. ` +
        `${Math.ceil(current.minHoursBeforeAdvance - elapsed)} to go.`,
      citation: protocol.citation,
    };
  }

  // 5 — Gates.
  const nextStep = state.step + 1;

  // Return-to-Learn step 4 means full days with no accommodations. Arriving
  // there because a very light day produced no symptoms would hand someone who
  // is still plainly struggling an empty accommodations letter.
  if (
    state.protocol === 'return-to-learn' &&
    nextStep === 4 &&
    observation.demonstratedFullDay !== true
  ) {
    return {
      kind: 'hold',
      step: state.step,
      reason:
        'Step 4 means full days without any concussion-related accommodations. Keep building ' +
        'up the school or work day first — the accommodations come off once full days are ' +
        'comfortable, not before.',
      citation: protocol.citation,
    };
  }
  const requirements = unmetRequirements(state, nextStep);

  const needsExertionCheck = state.protocol === 'return-to-sport' && state.step === 3;
  if (needsExertionCheck && observation.symptomFreeWithExertion !== true) {
    requirements.push(
      'Full resolution of symptoms with exertion has not been established at step 3.',
    );
  }

  if (requirements.length > 0) {
    return {
      kind: 'blocked',
      step: state.step,
      blockedFrom: nextStep,
      requirements,
      reason: `Step ${nextStep} has requirements that are not met.`,
      citation: protocol.citation,
    };
  }

  // 6 — Tolerated the step, waited long enough, nothing gating.
  return {
    kind: 'advance',
    from: state.step,
    to: nextStep,
    cautious: false,
    reason:
      `Symptoms stayed within the mild-and-brief limit for at least ` +
      `${current.minHoursBeforeAdvance} hours at step ${state.step}.`,
    citation: protocol.citation,
  };
}

/** Applies a decision to produce the next state. Pure; returns a new object. */
export function applyDecision(
  state: StageState,
  decision: StageDecision,
  now: Date,
): StageState {
  if (decision.kind === 'advance' || decision.kind === 'regress') {
    return { ...state, step: decision.to, enteredAt: now };
  }
  return state;
}

/**
 * How long the patient has been away, and whether that has passed the point the
 * guideline warns about. Separate from step progression because someone can be
 * at step 2 and still not physically attending.
 *
 * The guideline states this about school. Applying the same reasoning to work
 * is our extension, so the wording changes with the audience while the
 * threshold does not.
 */
export function schoolAbsenceWarning(
  daysAbsent: number,
  setting: 'school' | 'work' = 'school',
): string | null {
  if (daysAbsent <= MAX_SCHOOL_ABSENCE_DAYS.value) return null;

  return setting === 'school'
    ? `${daysAbsent} days out of school. A complete absence from the school environment for ` +
        'more than one week is not generally recommended — adapt the school day rather than ' +
        'extending time away.'
    : `${daysAbsent} days away from work. The guidance is written about school, where more than ` +
        'a week away is not generally recommended; the reasoning carries over. Adapting the ' +
        'working day tends to beat extending the time away from it.';
}
