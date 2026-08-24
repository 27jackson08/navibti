/**
 * Synthetic patients with known ground truth.
 *
 * No human data exists for this system and none should be collected in eleven
 * days. Generating patients from coefficients we choose lets us ask the
 * question that actually matters — "would this recommendation have hurt
 * someone?" — which no amount of real-looking demo data can answer.
 *
 * The generator is deliberately harder than the model. Sensitivity decays over
 * time as the patient recovers, so the model is fitting a moving target rather
 * than a stationary one, and "recovering the true weights" is not even
 * well-posed. What we measure instead is whether the estimated tolerance
 * tracks the true tolerance on the day it was acted on.
 */

import type { Exacerbation, LoadDomain } from '@/data/guidelines';
import { FEATURE_ORDER, featureVector, type Feature } from '@/engine/tolerance/units';
import { gaussian, seededRng, uniform, type Rng } from './random';

export interface SyntheticPatient {
  readonly id: string;
  readonly seed: number;
  readonly isMinor: boolean;
  /** Sensitivity on the day of injury, in points per reference unit. */
  readonly baselineWeights: Record<Feature, number>;
  readonly noiseSd: number;
  /** Days for sensitivity to decay by 1/e toward its residual floor. */
  readonly recoveryTau: number;
  /** Fraction of baseline sensitivity that remains once recovered. */
  readonly residualSensitivity: number;
  /** 1.0 follows the plan; above 1 overshoots it. */
  readonly adherence: number;
  /** Day index on which red flags appear, or null for none. */
  readonly redFlagDay: number | null;
  /**
   * Typical nightly sleep shortfall, in hours. Exogenous by construction: no
   * plan can prescribe how well someone sleeps, and modelling it as a dose the
   * app hands out is what made every simulated patient accrue the maximum
   * tolerated debt every single night.
   */
  readonly sleepDebtMean: number;
  readonly sleepDebtSd: number;
}

const WEIGHT_CENTRES: Record<Feature, number> = {
  intercept: 0.3,
  cognitive: 1.4,
  visualVestibular: 1.6,
  physical: 0.5,
  sleepFatigue: 1.8,
  emotionalAutonomic: 1.0,
};

const WEIGHT_SPREAD: Record<Feature, number> = {
  intercept: 0.15,
  cognitive: 0.6,
  visualVestibular: 0.8,
  physical: 0.5,
  sleepFatigue: 0.7,
  emotionalAutonomic: 0.5,
};

export function makePatient(seed: number): SyntheticPatient {
  const rng = seededRng(seed);

  const baselineWeights = Object.fromEntries(
    FEATURE_ORDER.map((feature) => {
      const drawn = WEIGHT_CENTRES[feature] + gaussian(rng) * WEIGHT_SPREAD[feature];
      // Physical activity genuinely helps some patients, so it is the one
      // domain allowed to come out negative.
      const floor = feature === 'physical' ? -0.8 : 0.05;
      return [feature, Math.max(floor, drawn)];
    }),
  ) as Record<Feature, number>;

  return {
    id: `synthetic-${seed}`,
    seed,
    isMinor: rng() < 0.4,
    baselineWeights,
    noiseSd: uniform(rng, 0.2, 0.6),
    recoveryTau: uniform(rng, 6, 18),
    residualSensitivity: uniform(rng, 0.08, 0.3),
    adherence: rng() < 0.35 ? uniform(rng, 1.15, 1.6) : uniform(rng, 0.85, 1.05),
    redFlagDay: rng() < 0.06 ? Math.floor(uniform(rng, 1, 14)) : null,
    sleepDebtMean: uniform(rng, 0.2, 1.6),
    sleepDebtSd: uniform(rng, 0.3, 0.9),
  };
}

/** Sensitivity on a given day, decaying toward the residual floor. */
export function trueWeightsOn(patient: SyntheticPatient, day: number): Record<Feature, number> {
  const decay =
    patient.residualSensitivity +
    (1 - patient.residualSensitivity) * Math.exp(-day / patient.recoveryTau);

  return Object.fromEntries(
    FEATURE_ORDER.map((feature) => [feature, patient.baselineWeights[feature] * decay]),
  ) as Record<Feature, number>;
}

export function expectedDelta(
  patient: SyntheticPatient,
  day: number,
  doses: Partial<Record<LoadDomain, number>>,
): number {
  const weights = trueWeightsOn(patient, day);
  const x = featureVector(doses);
  return FEATURE_ORDER.reduce((sum, feature, i) => sum + weights[feature] * x[i], 0);
}

/**
 * What actually happens on a day. Duration scales with magnitude, because a
 * four-point spike does not resolve in twenty minutes — and the guideline's
 * test is on both magnitude and duration.
 */
export function simulateDay(
  patient: SyntheticPatient,
  day: number,
  doses: Partial<Record<LoadDomain, number>>,
  rng: Rng,
): Exacerbation {
  const deltaPoints = Math.max(0, expectedDelta(patient, day, doses) + gaussian(rng) * patient.noiseSd);
  // Calibrated so the magnitude and duration limits fail together rather than
  // duration failing first: a 2-point rise lands near 48 minutes, inside the
  // hour, while a 4-point rise runs well past it.
  const durationMinutes = Math.round(12 + deltaPoints * 18 + Math.abs(gaussian(rng)) * 6);
  return { deltaPoints, durationMinutes };
}

/**
 * The true tolerance: the dose at which expected symptom rise reaches the
 * 2-point limit, holding the rest of the day fixed. In normalised units.
 *
 * Linear in the dose, so this is exact rather than searched — which is the
 * point of generating the data ourselves.
 */
export function trueTolerance(
  patient: SyntheticPatient,
  day: number,
  domain: LoadDomain,
  context: Partial<Record<LoadDomain, number>>,
  limit = 2,
  ceiling = 1.5,
): number {
  const weights = trueWeightsOn(patient, day);
  const withoutDomain = { ...context, [domain]: 0 };
  const base = expectedDelta(patient, day, withoutDomain);
  const slope = weights[domain];

  if (slope <= 0) return ceiling;
  return Math.min(ceiling, Math.max(0, (limit - base) / slope));
}

export function makeCohort(size: number, firstSeed = 1): SyntheticPatient[] {
  return Array.from({ length: size }, (_, i) => makePatient(firstSeed + i));
}

/** A night's sleep shortfall. Independent of anything the app recommended. */
export function sampleSleepDebt(patient: SyntheticPatient, rng: Rng): number {
  return Math.max(0, patient.sleepDebtMean + gaussian(rng) * patient.sleepDebtSd);
}
