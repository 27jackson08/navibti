/**
 * Bayesian linear regression with a Normal-Inverse-Gamma conjugate prior.
 *
 *   Δ | w, σ²  ~  N(wᵀx, σ²)
 *   w | σ²     ~  N(μ₀, σ² Λ₀⁻¹)
 *   σ²         ~  InvGamma(a₀, b₀)
 *
 * Δ is the worst within-day symptom increase over the PRE-ACTIVITY value, on
 * the guideline's own 0-10 scale. Predicting the delta rather than an absolute
 * severity is what makes the model's output comparable to the published
 * threshold without any translation step.
 *
 * Updates are closed-form, so there is no training loop, no sampling, and no
 * separate service — and a day can be replayed exactly from stored parameters.
 */

import {
  MIN_CHECK_INS_FOR_PERSONALIZATION,
  POSTERIOR_FORGETTING_FACTOR,
  type LoadDomain,
} from '@/data/guidelines';
import {
  addMatrices,
  dot,
  identity,
  matVec,
  outer,
  quadraticForm,
  solveSpd,
  type Matrix,
  type Vector,
} from './matrix';
import { studentTSurvival } from './student-t';
import {
  FEATURE_COUNT,
  FEATURE_ORDER,
  PRIOR_MEANS,
  PRIOR_PRECISION,
  PRIOR_RATE,
  PRIOR_SHAPE,
  featureVector,
  type Feature,
} from './units';

export interface Posterior {
  /** μₙ, in the fixed FEATURE_ORDER. */
  readonly meanWeights: readonly number[];
  /** Λₙ, the precision matrix. */
  readonly precision: Matrix;
  readonly shape: number;
  readonly rate: number;
  readonly observationCount: number;
}

export function priorPosterior(): Posterior {
  const precision = identity(FEATURE_COUNT, 0).map((row, i) =>
    row.map((_, j) => (i === j ? PRIOR_PRECISION[FEATURE_ORDER[i]] : 0)),
  );
  return {
    meanWeights: FEATURE_ORDER.map((feature) => PRIOR_MEANS[feature]),
    precision,
    shape: PRIOR_SHAPE,
    rate: PRIOR_RATE,
    observationCount: 0,
  };
}

export interface Observation {
  readonly doses: Partial<Record<LoadDomain, number>>;
  /** Points of increase over the pre-activity value, on the 0-10 scale. */
  readonly deltaPoints: number;
}

/**
 * One exact conjugate update. Treating the current posterior as the prior for
 * the next observation is exact for this model, so daily online updating and a
 * batch fit over the same data agree.
 */
export function update(prior: Posterior, observation: Observation): Posterior {
  const x = featureVector(observation.doses);
  const y = observation.deltaPoints;

  const precision = addMatrices(prior.precision, outer(x));
  const priorTerm = matVec(prior.precision, prior.meanWeights);
  const target = priorTerm.map((value, i) => value + x[i] * y);
  const meanWeights = solveSpd(precision, target);

  // bₙ = b + ½(y² + μᵀΛμ − μₙᵀΛₙμₙ)
  const quadraticPrior = dot(prior.meanWeights, matVec(prior.precision, prior.meanWeights));
  const quadraticPosterior = dot(meanWeights, matVec(precision, meanWeights));
  const rate = prior.rate + 0.5 * (y * y + quadraticPrior - quadraticPosterior);

  return {
    meanWeights,
    precision,
    shape: prior.shape + 0.5,
    // Rounding can push this a hair negative when the fit is near-exact. The
    // rate is a scale parameter and must stay positive.
    rate: Math.max(rate, 1e-9),
    observationCount: prior.observationCount + 1,
  };
}

/**
 * Shrinks accumulated evidence back toward the prior.
 *
 * Kept separate from `update` on purpose: `update` stays an exact conjugate
 * step, which is what lets the test suite check daily updating against a direct
 * batch fit. Forgetting is a modelling choice layered on top, not part of the
 * mathematics.
 */
export function discount(posterior: Posterior, factor = POSTERIOR_FORGETTING_FACTOR.value): Posterior {
  const prior = priorPosterior();
  const keep = factor;
  const revert = 1 - factor;

  const precision = posterior.precision.map((row, i) =>
    row.map((value, j) => keep * value + revert * prior.precision[i][j]),
  );

  // Blend the information-form mean (Λμ) rather than μ itself, so the shrinkage
  // is toward the prior belief rather than toward an arbitrary midpoint.
  const information = matVec(posterior.precision, posterior.meanWeights);
  const priorInformation = matVec(prior.precision, prior.meanWeights);
  const blended = information.map((value, i) => keep * value + revert * priorInformation[i]);

  return {
    meanWeights: solveSpd(precision, blended),
    precision,
    shape: keep * posterior.shape + revert * prior.shape,
    rate: keep * posterior.rate + revert * prior.rate,
    observationCount: posterior.observationCount,
  };
}

/**
 * One day of evidence, with forgetting applied first. This is what the daily
 * loop should call; `update` alone is the exact conjugate step.
 */
export function observe(posterior: Posterior, observation: Observation): Posterior {
  return update(discount(posterior), observation);
}

export function updateAll(prior: Posterior, observations: readonly Observation[]): Posterior {
  return observations.reduce(update, prior);
}

export interface Predictive {
  readonly mean: number;
  readonly scale: number;
  readonly degreesOfFreedom: number;
}

/** Posterior predictive for a proposed day. Student-t, not normal. */
export function predict(posterior: Posterior, doses: Partial<Record<LoadDomain, number>>): Predictive {
  return predictFeatures(posterior, featureVector(doses));
}

export function predictFeatures(posterior: Posterior, x: Vector): Predictive {
  const mean = dot(posterior.meanWeights, x);
  const variance = (posterior.rate / posterior.shape) * (1 + quadraticForm(posterior.precision, x));
  return {
    mean,
    scale: Math.sqrt(variance),
    degreesOfFreedom: 2 * posterior.shape,
  };
}

/** P(Δ > limit) under the posterior predictive. */
export function exceedanceProbability(predictive: Predictive, limit: number): number {
  return studentTSurvival((limit - predictive.mean) / predictive.scale, predictive.degreesOfFreedom);
}

export function isPersonalized(posterior: Posterior): boolean {
  return posterior.observationCount >= MIN_CHECK_INS_FOR_PERSONALIZATION.value;
}

/** Weight for one feature, for attribution and for display. */
export function weightOf(posterior: Posterior, feature: Feature): number {
  return posterior.meanWeights[FEATURE_ORDER.indexOf(feature)];
}
