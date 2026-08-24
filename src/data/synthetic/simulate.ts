/**
 * Runs a synthetic patient through the whole closed loop, day by day.
 *
 * The distinction that makes the safety number meaningful: each day is
 * simulated twice, once at the dose NaviTBI recommended and once at the dose
 * the patient actually took. The posterior learns from what they actually did,
 * because that is what really happened. The safety rate is measured against
 * the counterfactual, because a patient who ignores the plan and overshoots by
 * 50% has not been failed by the recommendation.
 */

import { LOAD_DOMAINS, isMildAndBrief, type Exacerbation, type LoadDomain } from '@/data/guidelines';
import { applyDecision, evaluate } from '@/engine/stage/machine';
import type { StageState } from '@/engine/stage/types';
import { observe, priorPosterior, type Posterior } from '@/engine/tolerance/posterior';
import { planDay, type BindingConstraint } from '@/engine/tolerance/threshold';
import { stageCap } from '@/engine/tolerance/stage-caps';
import { denormalizeDose, normalizeDose } from '@/engine/tolerance/units';
import { gaussian, seededRng } from './random';
import { sampleSleepDebt, simulateDay, trueTolerance, type SyntheticPatient } from './patient';

const EPOCH = new Date('2026-01-01T08:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

type DoseMap = Partial<Record<LoadDomain, number>>;

/**
 * Which policy produced the daily dose. The two ablations exist so the
 * evaluation can answer "does the model earn its place?" rather than only
 * "is the model safe?".
 *
 *   navitbi     min(model tolerance, ramp cap, stage cap) — the shipped policy
 *   stage-only  the guideline ceiling alone, with no personalization at all
 *   model-only  the model with both guardrails removed
 */
export type Policy = 'navitbi' | 'stage-only' | 'model-only';

export interface SimulatedDay {
  readonly day: number;
  readonly step: number;
  readonly recommended: DoseMap;
  readonly actual: DoseMap;
  /** What would have happened had the patient followed the plan exactly. */
  readonly counterfactual: Exacerbation;
  /** What happened given how the patient actually behaved. */
  readonly observed: Exacerbation;
  /** Normalised, so estimate and truth are directly comparable. */
  readonly trueTolerance: Record<LoadDomain, number>;
  readonly estimatedTolerance: Record<LoadDomain, number>;
  readonly binding: Record<LoadDomain, BindingConstraint>;
  readonly isProvisional: boolean;
  readonly recommendationWasSafe: boolean;
  /** The guideline floor had to rescue a domain the model zeroed out. */
  readonly floorRescued: boolean;
  /** The model believed even no load would breach the limit. */
  readonly needsClinicianReview: boolean;
  readonly zeroToleranceDomains: number;
}

export interface SimulationResult {
  readonly patient: SyntheticPatient;
  readonly days: readonly SimulatedDay[];
  /** Set when a red flag halted the simulation, with the day it happened. */
  readonly haltedOn: number | null;
  readonly haltWasDetected: boolean;
}

/** A quiet starting day, before the app knows anything about the patient. */
const OPENING_CONTEXT: DoseMap = {
  cognitive: 30,
  visualVestibular: 20,
  physical: 10,
  sleepFatigue: 1,
  emotionalAutonomic: 30,
};

export function simulatePatient(
  patient: SyntheticPatient,
  dayCount = 21,
  policy: Policy = 'navitbi',
): SimulationResult {
  const rng = seededRng(patient.seed * 7919 + 13);

  let posterior: Posterior = priorPosterior();
  let stage: StageState = { protocol: 'return-to-learn', step: 1, enteredAt: EPOCH };
  let context: DoseMap = OPENING_CONTEXT;
  let yesterday: DoseMap = {};

  const days: SimulatedDay[] = [];

  for (let day = 0; day < dayCount; day += 1) {
    const endOfDay = new Date(EPOCH.getTime() + (day + 1) * DAY_MS);

    if (patient.redFlagDay === day) {
      const decision = evaluate(stage, {
        at: endOfDay,
        exacerbation: { deltaPoints: 0, durationMinutes: 0 },
        redFlagIds: ['severe-headache'],
      });
      return {
        patient,
        days,
        haltedOn: day,
        // No plan may be produced on a red-flag day. That is the requirement.
        haltWasDetected: decision.kind === 'halt',
      };
    }

    const plan = planDay({
      posterior,
      protocol: stage.protocol,
      step: stage.step,
      context,
      yesterday,
    });

    const recommended: DoseMap = {};
    const actual: DoseMap = {};
    const binding = {} as Record<LoadDomain, BindingConstraint>;
    const estimated = {} as Record<LoadDomain, number>;
    const truth = {} as Record<LoadDomain, number>;

    for (const item of plan.recommendations) {
      const dose =
        policy === 'stage-only'
          ? denormalizeDose(item.domain, stageCap(stage.protocol, stage.step, item.domain).cap)
          : policy === 'model-only'
            ? item.modelTolerance
            : item.dose;

      recommended[item.domain] = dose;
      binding[item.domain] = item.binding;
      estimated[item.domain] = normalizeDose(item.domain, item.modelTolerance);
      // Measured against the same partial day the estimator solved against.
      // Comparing to a different baseline would not be measuring error at all.
      truth[item.domain] = trueTolerance(patient, day, item.domain, item.solvedContext);
      actual[item.domain] = Math.max(0, dose * patient.adherence * (1 + gaussian(rng) * 0.1));
    }

    // Sleep is not something the plan controls, so both the recommended day and
    // the day that actually happened carry the same real shortfall. The plan's
    // sleep figure is a ceiling we report, never a dose we hand out.
    const sleepDebt = sampleSleepDebt(patient, rng);
    recommended.sleepFatigue = sleepDebt;
    actual.sleepFatigue = sleepDebt;

    const counterfactual = simulateDay(patient, day, recommended, rng);
    const observed = simulateDay(patient, day, actual, rng);

    days.push({
      day,
      step: stage.step,
      recommended,
      actual,
      counterfactual,
      observed,
      trueTolerance: truth,
      estimatedTolerance: estimated,
      binding,
      isProvisional: plan.isProvisional,
      recommendationWasSafe: isMildAndBrief(counterfactual),
      floorRescued: plan.floorOverrodeModel,
      needsClinicianReview: plan.needsClinicianReview,
      zeroToleranceDomains: plan.recommendations.filter((item) => item.modelTolerance <= 0).length,
    });

    posterior = observe(posterior, { doses: actual, deltaPoints: observed.deltaPoints });

    const decision = evaluate(stage, {
      at: endOfDay,
      exacerbation: observed,
      redFlagIds: [],
      symptomFreeWithExertion: observed.deltaPoints < 0.5,
    });
    stage = applyDecision(stage, decision, endOfDay);

    yesterday = actual;
    context = actual;
  }

  return { patient, days, haltedOn: null, haltWasDetected: false };
}

export interface CohortMetrics {
  readonly patients: number;
  readonly simulatedDays: number;
  /** Share of recommended doses that would have breached the guideline limit. */
  readonly unsafeRecommendationRate: number;
  /** Mean absolute tolerance error by day index, averaged over domains. */
  readonly toleranceErrorByDay: readonly number[];
  readonly toleranceErrorFirstThreeDays: number;
  readonly toleranceErrorAfterDaySeven: number;
  readonly bindingShare: Record<BindingConstraint, number>;
  /**
   * Share of estimates that exceeded the truth. This is the direction that
   * hurts people; a conservative estimate costs time, an optimistic one costs
   * a setback.
   */
  readonly overEstimationRate: number;
  readonly meanSignedError: number;
  /** Share of domain-days where the model recommended literally nothing. */
  readonly collapsedToleranceRate: number;
  readonly floorRescuedDayShare: number;
  readonly clinicianReviewDayShare: number;
  /** Split by phase, to show whether escalation is an acute-phase signal or constant noise. */
  readonly clinicianReviewFirstFourDays: number;
  readonly clinicianReviewAfterDaySeven: number;
  readonly redFlagPatients: number;
  readonly redFlagRecall: number;
  readonly provisionalDays: number;
  /** Mean recommended load as a fraction of an ordinary day, across domains. */
  readonly meanRecommendedLoad: number;
}

export function summarize(results: readonly SimulationResult[]): CohortMetrics {
  const allDays = results.flatMap((result) => result.days);
  const maxDay = Math.max(...allDays.map((day) => day.day), 0);

  const errorByDay: number[] = [];
  for (let day = 0; day <= maxDay; day += 1) {
    const onThisDay = allDays.filter((entry) => entry.day === day);
    if (onThisDay.length === 0) {
      errorByDay.push(Number.NaN);
      continue;
    }
    const errors = onThisDay.flatMap((entry) =>
      LOAD_DOMAINS.map((domain) =>
        Math.abs(entry.estimatedTolerance[domain] - entry.trueTolerance[domain]),
      ),
    );
    errorByDay.push(mean(errors));
  }

  const bindingCounts: Record<BindingConstraint, number> = { model: 0, ramp: 0, stage: 0, floor: 0 };
  for (const entry of allDays) {
    for (const domain of LOAD_DOMAINS) bindingCounts[entry.binding[domain]] += 1;
  }
  const bindingTotal = Object.values(bindingCounts).reduce((a, b) => a + b, 0) || 1;

  const signedErrors = allDays.flatMap((entry) =>
    LOAD_DOMAINS.map((domain) => entry.estimatedTolerance[domain] - entry.trueTolerance[domain]),
  );

  const withRedFlags = results.filter((result) => result.haltedOn !== null);

  return {
    patients: results.length,
    simulatedDays: allDays.length,
    unsafeRecommendationRate:
      allDays.filter((entry) => !entry.recommendationWasSafe).length / (allDays.length || 1),
    toleranceErrorByDay: errorByDay,
    toleranceErrorFirstThreeDays: mean(errorByDay.slice(0, 3).filter(Number.isFinite)),
    toleranceErrorAfterDaySeven: mean(errorByDay.slice(7).filter(Number.isFinite)),
    bindingShare: {
      model: bindingCounts.model / bindingTotal,
      ramp: bindingCounts.ramp / bindingTotal,
      stage: bindingCounts.stage / bindingTotal,
      floor: bindingCounts.floor / bindingTotal,
    },
    overEstimationRate: signedErrors.filter((error) => error > 0).length / (signedErrors.length || 1),
    meanSignedError: mean(signedErrors),
    collapsedToleranceRate:
      allDays.reduce((sum, entry) => sum + entry.zeroToleranceDomains, 0) /
      ((allDays.length || 1) * LOAD_DOMAINS.length),
    floorRescuedDayShare: allDays.filter((entry) => entry.floorRescued).length / (allDays.length || 1),
    clinicianReviewDayShare:
      allDays.filter((entry) => entry.needsClinicianReview).length / (allDays.length || 1),
    clinicianReviewFirstFourDays: shareNeedingReview(allDays.filter((entry) => entry.day < 4)),
    clinicianReviewAfterDaySeven: shareNeedingReview(allDays.filter((entry) => entry.day >= 7)),
    redFlagPatients: withRedFlags.length,
    redFlagRecall:
      withRedFlags.length === 0
        ? 1
        : withRedFlags.filter((result) => result.haltWasDetected).length / withRedFlags.length,
    provisionalDays: allDays.filter((entry) => entry.isProvisional).length,
    meanRecommendedLoad: mean(
      allDays.flatMap((entry) =>
        LOAD_DOMAINS.map((domain) => normalizeDose(domain, entry.recommended[domain] ?? 0)),
      ),
    ),
  };
}

function shareNeedingReview(days: readonly SimulatedDay[]): number {
  return days.length === 0 ? 0 : days.filter((day) => day.needsClinicianReview).length / days.length;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? Number.NaN : values.reduce((a, b) => a + b, 0) / values.length;
}
