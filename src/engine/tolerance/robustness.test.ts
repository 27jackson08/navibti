import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS, type LoadDomain } from '@/data/guidelines';
import { seededRng } from '@/data/synthetic/random';
import {
  discount,
  exceedanceProbability,
  observe,
  predict,
  priorPosterior,
  type Observation,
  type Posterior,
} from './posterior';
import { invertSpd } from './matrix';

/**
 * What the model does when the data is nothing like the demo cohort.
 *
 * The posterior is a closed-form conjugate update, which is exactly why this
 * matters: there is no solver to fail loudly. A precision matrix that drifts
 * out of positive-definiteness, or a rate that reaches zero, produces a NaN
 * that propagates silently through every dose, every packet and every stage
 * decision — and NaN comparisons are false, so a guard written as
 * `dose > cap` waves it through.
 *
 * Nothing here checks that the model is *right*; the evaluation harness does
 * that against a simulated cohort. This checks it stays a model at all.
 *
 * One hazard it does not reach, stated rather than implied. `update` clamps the
 * rate with `Math.max(rate, 1e-9)` against floating-point cancellation when the
 * fit is near-exact. Removing that clamp breaks nothing in this suite — not
 * these extremes, and not the existing test named for it — so the case it
 * defends is one nothing here constructs. It is cheap insurance against an
 * arithmetic coincidence, and it is untested. Treat it as unverified rather
 * than as covered.
 */
const EXTREMES: readonly Observation[] = [
  { doses: {}, deltaPoints: 0 },
  { doses: Object.fromEntries(LOAD_DOMAINS.map((d) => [d, 0])), deltaPoints: 0 },
  { doses: Object.fromEntries(LOAD_DOMAINS.map((d) => [d, 1440])), deltaPoints: 10 },
  { doses: { cognitive: 1e6 }, deltaPoints: 10 },
  { doses: { cognitive: 1e-9 }, deltaPoints: 1e-9 },
  { doses: { physical: 0, sleepFatigue: 12 }, deltaPoints: 10 },
  // A patient who flares identically every day gives the fit nothing to
  // separate, which is where a rate collapses to zero.
  ...Array.from({ length: 30 }, () => ({ doses: { cognitive: 60 }, deltaPoints: 2 })),
];

function assertUsable(posterior: Posterior, where: string): void {
  expect(Number.isFinite(posterior.shape), `${where}: shape`).toBe(true);
  expect(Number.isFinite(posterior.rate), `${where}: rate`).toBe(true);
  expect(posterior.rate, `${where}: rate must stay positive`).toBeGreaterThan(0);
  expect(posterior.shape, `${where}: shape must stay positive`).toBeGreaterThan(0);

  for (const value of posterior.meanWeights) {
    expect(Number.isFinite(value), `${where}: a coefficient is not a number`).toBe(true);
  }
  for (const row of posterior.precision) {
    for (const value of row) {
      expect(Number.isFinite(value), `${where}: precision has a non-number`).toBe(true);
    }
  }

  // Symmetry, and invertibility. The covariance is read directly for the
  // attribution separation test, so a precision matrix that cannot be inverted
  // does not fail here — it names a cause it has no basis to name.
  const size = posterior.precision.length;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      expect(
        Math.abs(posterior.precision[i][j] - posterior.precision[j][i]),
        `${where}: precision is not symmetric at ${i},${j}`,
      ).toBeLessThan(1e-6);
    }
  }

  const covariance = invertSpd(posterior.precision);
  for (const row of covariance) {
    for (const value of row) {
      expect(Number.isFinite(value), `${where}: covariance has a non-number`).toBe(true);
    }
  }
  for (let i = 0; i < size; i++) {
    expect(covariance[i][i], `${where}: negative variance at ${i}`).toBeGreaterThan(0);
  }
}

describe('the posterior survives data unlike anything in the cohort', () => {
  it('starts usable', () => {
    assertUsable(priorPosterior(), 'prior');
  });

  it.each(EXTREMES.map((o, i) => [i, o] as const).slice(0, 6))(
    'stays usable after extreme observation %i',
    (_i, observation) => {
      assertUsable(observe(priorPosterior(), observation), 'after one extreme');
    },
  );

  it('stays usable through every extreme in sequence', () => {
    let posterior = priorPosterior();
    for (const [index, observation] of EXTREMES.entries()) {
      posterior = observe(posterior, observation);
      assertUsable(posterior, `after ${index + 1} observations`);
    }
  });

  it('stays usable under repeated discounting', () => {
    // Forgetting is applied every day, so it compounds. A factor applied
    // hundreds of times is the arithmetic that drives a rate toward zero.
    let posterior = priorPosterior();
    for (let day = 0; day < 400; day++) {
      posterior = discount(observe(posterior, { doses: { cognitive: 60 }, deltaPoints: 1 }));
      if (day % 50 === 0) assertUsable(posterior, `day ${day}`);
    }
    assertUsable(posterior, 'day 400');
  });

  it('stays usable on random noise', () => {
    const rng = seededRng(7);
    let posterior = priorPosterior();

    for (let day = 0; day < 200; day++) {
      posterior = observe(posterior, {
        doses: Object.fromEntries(
          LOAD_DOMAINS.map((domain) => [domain, rng() * 600]),
        ) as Partial<Record<LoadDomain, number>>,
        deltaPoints: rng() * 10,
      });
    }
    assertUsable(posterior, 'after 200 random days');
  });
});

describe('what the posterior is asked for downstream', () => {
  const posteriors = [
    priorPosterior(),
    EXTREMES.reduce((p, o) => observe(p, o), priorPosterior()),
  ];

  it.each(posteriors.map((p, i) => [i, p] as const))(
    'gives a probability, not a number outside zero and one (%i)',
    (_i, posterior) => {
      for (const dose of [0, 1, 60, 1440, 1e6]) {
        const probability = exceedanceProbability(predict(posterior, { cognitive: dose }), 2);
        expect(Number.isFinite(probability), `dose ${dose}`).toBe(true);
        expect(probability, `dose ${dose}`).toBeGreaterThanOrEqual(0);
        expect(probability, `dose ${dose}`).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each(posteriors.map((p, i) => [i, p] as const))(
    'predicts a finite mean and a positive spread (%i)',
    (_i, posterior) => {
      const predictive = predict(posterior, { cognitive: 120, physical: 30 });
      expect(Number.isFinite(predictive.mean)).toBe(true);
      expect(predictive.scale).toBeGreaterThan(0);
      expect(predictive.degreesOfFreedom).toBeGreaterThan(0);
    },
  );
});
