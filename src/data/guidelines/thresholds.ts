/**
 * Every number that can influence a recommendation, tagged with where it
 * came from.
 *
 * Values marked 'guideline' are quoted from the cited document. Values marked
 * 'product-default' are our own conservative engineering choices and are NOT
 * attributable to any clinical source — they are separated out precisely so
 * nobody, including us, can later mistake one for the other.
 */

import type { Sourced } from './types';

export const SYMPTOM_SCALE = {
  min: 0,
  max: 10,
  label: '0-10 symptom severity scale',
} as const;

// ---------------------------------------------------------------------------
// Guideline values
// ---------------------------------------------------------------------------

/**
 * The threshold the entire tolerance model is built around.
 *
 * Note it is measured against the PRE-ACTIVITY value, not against a daily
 * baseline and not against an absolute severity. This is why the model's target
 * variable is a delta — see `src/engine/tolerance`.
 */
export const EXACERBATION_POINT_LIMIT: Sourced<number> = {
  value: 2,
  provenance: 'guideline',
  citation: 'pedsconcussion-2023',
  quote:
    'Mild exacerbation (worsening) of symptoms: No more than a 2-point increase when compared ' +
    'with the pre-activity value on a 0-10-point symptom severity scale.',
};

export const EXACERBATION_MINUTE_LIMIT: Sourced<number> = {
  value: 60,
  provenance: 'guideline',
  citation: 'pedsconcussion-2023',
  quote: '"Brief" exacerbation of symptoms: Worsening of symptoms for up to 1 hour.',
};

export const RELATIVE_REST_MAX_HOURS: Sourced<number> = {
  value: 48,
  provenance: 'guideline',
  citation: 'pedsconcussion-2023',
  quote: 'Activities of daily living and relative rest (Maximum of 24-48 hours).',
};

export const MIN_HOURS_BETWEEN_STEPS: Sourced<number> = {
  value: 24,
  provenance: 'guideline',
  citation: 'pedsconcussion-2023',
  quote: 'Progression through each subsequent step taking a minimum of 24 hours.',
};

export const MAX_SCHOOL_ABSENCE_DAYS: Sourced<number> = {
  value: 7,
  provenance: 'guideline',
  citation: 'pedsconcussion-2023',
  quote:
    'A complete absence from the school environment for more than one week is not generally ' +
    'recommended.',
};

/**
 * The anti-strict-rest rule. This is what licenses NaviTBI to nudge load
 * *upward* when a patient is under-exposed, which is the behaviour that
 * separates it from every pacing app that only ever caps.
 */
export const EARLY_ACTIVITY_WINDOW_HOURS: Sourced<number> = {
  value: 48,
  provenance: 'guideline',
  citation: 'amsterdam-2023',
  quote:
    'Relative rest is defined as activities of daily living, and light, symptom limited ' +
    'physical exercise (such as walking), and may begin during the first 24-48 hours after ' +
    'injury.',
};

// ---------------------------------------------------------------------------
// Product defaults — ours, not the literature's
// ---------------------------------------------------------------------------

/**
 * We recommend a dose only where the posterior predictive says the chance of
 * breaching the 2-point limit is at or below this.
 *
 * Lower is more cautious. This is the single knob that makes sparse data
 * produce small recommendations: a wide posterior pushes the 20th-percentile
 * dose down automatically, with no special-case branch anywhere in the engine.
 */
export const TOLERANCE_EXCEEDANCE_QUANTILE: Sourced<number> = {
  value: 0.2,
  provenance: 'product-default',
  citation: 'pedsconcussion-2023',
  rationale:
    'No source specifies an acceptable exceedance probability. We chose 0.2 so that a ' +
    'recommended dose is one we are roughly 80% confident stays inside the guideline limit, ' +
    'and we report the interval rather than only the point estimate.',
};

export const MAX_DAILY_RAMP_FRACTION: Sourced<number> = {
  value: 0.2,
  provenance: 'product-default',
  citation: 'pedsconcussion-2023',
  rationale:
    'The guidelines describe graduated progression but give no numeric rate outside the ' +
    '24-hour-per-step rule. A 20% ceiling over yesterday keeps day-to-day change gradual even ' +
    'when the model becomes confident quickly.',
};

export const MIN_CHECK_INS_FOR_PERSONALIZATION: Sourced<number> = {
  value: 3,
  provenance: 'product-default',
  citation: 'pedsconcussion-2023',
  rationale:
    'Below three observations the posterior is dominated by the prior. We keep running the ' +
    'model but label output provisional rather than implying it is personalized.',
};

export const UNDER_EXPOSURE_HEADROOM_FRACTION: Sourced<number> = {
  value: 0.5,
  provenance: 'product-default',
  citation: 'amsterdam-2023',
  rationale:
    'If logged load sits below half of estimated tolerance while symptoms are stable, we ' +
    'surface an increase prompt. Under-activity is a documented failure mode; strict rest is ' +
    'no longer recommended beyond 24-48 hours.',
};

export const UNDER_EXPOSURE_CONSECUTIVE_DAYS: Sourced<number> = {
  value: 2,
  provenance: 'product-default',
  citation: 'amsterdam-2023',
  rationale: 'One quiet day is normal. Two consecutive days suggests avoidance worth naming.',
};

/**
 * How close to an ordinary day's cognitive load counts as "a full day".
 *
 * Return-to-Learn step 4 is defined as full days without accommodations, so
 * reaching it has to mean the patient is actually managing something close to a
 * full day. Advancing on the absence of symptoms alone lets someone doing
 * ninety minutes of work arrive at the step that says they need no support --
 * which is how a person still plainly struggling ends up with an empty
 * accommodations letter.
 */
export const FULL_DAY_COGNITIVE_FRACTION: Sourced<number> = {
  value: 0.8,
  provenance: 'product-default',
  citation: 'pedsconcussion-2023',
  rationale:
    'The guideline says to increase workload "until full days without concussion-related ' +
    'accommodations are tolerated" but does not quantify a full day. Four fifths of an ordinary ' +
    'demanding day is our reading of close enough to count.',
};

/**
 * How much of yesterday's accumulated evidence survives into today.
 *
 * Tolerance genuinely improves during recovery, so a model that weights a day
 * three weeks ago as heavily as yesterday will keep insisting on restrictions
 * the patient has already outgrown. That is the same over-restriction the
 * guidance warns against, arriving by a different route. Discounting toward the
 * prior each day gives roughly a ten-day memory.
 */
export const POSTERIOR_FORGETTING_FACTOR: Sourced<number> = {
  value: 0.9,
  provenance: 'product-default',
  citation: 'amsterdam-2023',
  rationale:
    'No source specifies a forgetting rate. Chosen so the estimate tracks a recovering patient ' +
    'within about a week rather than lagging behind them for the whole episode.',
};

/**
 * The point at which the guideline itself says to seek medical advice.
 *
 * Applied uniformly rather than split by age. NaviTBI previously used 14 days
 * for adults and 28 for children, which had two problems: the 14-day figure
 * came from the superseded Berlin-era definition of persistent symptoms, and
 * the age asymmetry was not grounded in anything at all.
 */
export const PERSISTING_SYMPTOMS_DAYS: Sourced<number> = {
  value: 28,
  provenance: 'guideline',
  citation: 'amsterdam-2023',
  quote:
    'Individuals should seek medical advice from their GP if symptoms persist beyond 28 days, ' +
    'which may include onward referral.',
};

/**
 * An earlier, softer nudge of our own.
 *
 * Deliberately before the guideline's own 28-day mark, because suggesting a
 * conversation is low-risk and delaying one is not. Presented as a suggestion,
 * never as a finding of persisting symptoms — that determination is 28 days and
 * belongs to a clinician.
 */
export const EARLY_CLINICIAN_PROMPT_DAYS: Sourced<number> = {
  value: 14,
  provenance: 'product-default',
  citation: 'amsterdam-2023',
  rationale:
    'Half the guideline window. Chosen so someone whose symptoms are clearly not settling hears ' +
    'the suggestion before the point at which the guidance would tell them to act on it.',
};

// ---------------------------------------------------------------------------
// The guideline predicate
// ---------------------------------------------------------------------------

export interface Exacerbation {
  /** Increase over the pre-activity value, in points on the 0-10 scale. */
  readonly deltaPoints: number;
  /** How long the worsening lasted, in minutes. */
  readonly durationMinutes: number;
}

/**
 * "Mild and brief" as the guideline defines it: at most a 2-point rise over the
 * pre-activity value, lasting at most an hour.
 *
 * Both conditions must hold. A 1-point rise lasting all afternoon is not brief,
 * and is not acceptable just because it is small.
 */
export function isMildAndBrief(exacerbation: Exacerbation): boolean {
  return (
    exacerbation.deltaPoints <= EXACERBATION_POINT_LIMIT.value &&
    exacerbation.durationMinutes <= EXACERBATION_MINUTE_LIMIT.value
  );
}
