import { describe, expect, it } from 'vitest';
import { gaussian, seededRng } from '@/data/synthetic/random';
import { addMatrices, dot, matVec, outer, solveSpd } from './matrix';
import {
  exceedanceProbability,
  isPersonalized,
  predict,
  priorPosterior,
  update,
  updateAll,
  weightOf,
  type Observation,
} from './posterior';
import { FEATURE_ORDER, featureVector, type Feature } from './units';

const DOMAIN_FEATURES = FEATURE_ORDER.filter((f): f is Feature => f !== 'intercept');

describe('the prior', () => {
  const prior = priorPosterior();

  it('believes every kind of load plausibly raises symptoms', () => {
    // A zero-mean prior would encode "load does nothing", which is clinically
    // wrong and most dangerous precisely when the model knows least.
    for (const feature of DOMAIN_FEATURES) {
      expect(weightOf(prior, feature), feature).toBeGreaterThan(0);
    }
  });

  it('believes sleep debt matters most, per reference unit', () => {
    const sleep = weightOf(prior, 'sleepFatigue');
    for (const feature of DOMAIN_FEATURES.filter((f) => f !== 'sleepFatigue')) {
      expect(sleep).toBeGreaterThanOrEqual(weightOf(prior, feature));
    }
  });

  it('starts with no observations and is not personalized', () => {
    expect(prior.observationCount).toBe(0);
    expect(isPersonalized(prior)).toBe(false);
  });
});

describe('conjugate updating', () => {
  const rng = seededRng(7);
  const observations: Observation[] = Array.from({ length: 12 }, () => ({
    doses: {
      cognitive: 60 + rng() * 240,
      visualVestibular: 30 + rng() * 200,
      physical: rng() * 60,
      sleepFatigue: rng() * 3,
      emotionalAutonomic: rng() * 180,
    },
    deltaPoints: rng() * 4,
  }));

  it('matches a direct batch fit, so daily updating loses nothing', () => {
    const prior = priorPosterior();
    const online = updateAll(prior, observations);

    let precision = prior.precision;
    let target = matVec(prior.precision, prior.meanWeights);
    let sumSquares = 0;
    for (const observation of observations) {
      const x = featureVector(observation.doses);
      precision = addMatrices(precision, outer(x));
      target = target.map((value, i) => value + x[i] * observation.deltaPoints);
      sumSquares += observation.deltaPoints ** 2;
    }
    const batchMean = solveSpd(precision, target);

    for (let i = 0; i < batchMean.length; i += 1) {
      expect(online.meanWeights[i]).toBeCloseTo(batchMean[i], 9);
    }

    const quadPrior = dot(prior.meanWeights, matVec(prior.precision, prior.meanWeights));
    const quadPosterior = dot(batchMean, matVec(precision, batchMean));
    const batchRate = prior.rate + 0.5 * (sumSquares + quadPrior - quadPosterior);
    expect(online.rate).toBeCloseTo(batchRate, 8);
    expect(online.shape).toBeCloseTo(prior.shape + observations.length / 2, 12);
  });

  it('does not mutate the posterior it was given', () => {
    const prior = priorPosterior();
    const snapshot = JSON.stringify(prior);
    update(prior, observations[0]);
    expect(JSON.stringify(prior)).toBe(snapshot);
  });

  it('keeps the rate positive even when the fit is near-exact', () => {
    let posterior = priorPosterior();
    for (let i = 0; i < 30; i += 1) {
      posterior = update(posterior, { doses: { cognitive: 120 }, deltaPoints: 0.8 });
    }
    expect(posterior.rate).toBeGreaterThan(0);
  });

  it('becomes personalized on the third observation', () => {
    let posterior = priorPosterior();
    for (const count of [1, 2, 3]) {
      posterior = update(posterior, observations[0]);
      expect(isPersonalized(posterior)).toBe(count >= 3);
    }
  });
});

describe('recovering a known truth', () => {
  // A patient whose real sensitivities differ sharply from our prior: screens
  // hurt far more than the prior expects, exercise slightly helps.
  const TRUE_WEIGHTS: Record<Feature, number> = {
    intercept: 0.1,
    cognitive: 0.8,
    visualVestibular: 3.0,
    physical: -0.4,
    sleepFatigue: 1.0,
    emotionalAutonomic: 0.5,
  };

  function generate(count: number, seed: number, noiseSd = 0.35): Observation[] {
    const rng = seededRng(seed);
    return Array.from({ length: count }, () => {
      const doses = {
        cognitive: rng() * 300,
        visualVestibular: rng() * 300,
        physical: rng() * 90,
        sleepFatigue: rng() * 4,
        emotionalAutonomic: rng() * 300,
      };
      const x = featureVector(doses);
      const signal = FEATURE_ORDER.reduce(
        (sum, feature, i) => sum + TRUE_WEIGHTS[feature] * x[i],
        0,
      );
      return { doses, deltaPoints: signal + gaussian(rng) * noiseSd };
    });
  }

  it('overrules the prior and finds the real coefficients', () => {
    const posterior = updateAll(priorPosterior(), generate(120, 42));
    for (const feature of DOMAIN_FEATURES) {
      expect(weightOf(posterior, feature), feature).toBeCloseTo(TRUE_WEIGHTS[feature], 0);
    }
  });

  it('identifies the dominant driver as the dominant driver', () => {
    const posterior = updateAll(priorPosterior(), generate(60, 11));
    const ranked = DOMAIN_FEATURES.map((f) => [f, weightOf(posterior, f)] as const).sort(
      (a, b) => b[1] - a[1],
    );
    expect(ranked[0][0]).toBe('visualVestibular');
  });

  it('learns that exercise helps this patient, against a positive prior', () => {
    const posterior = updateAll(priorPosterior(), generate(120, 3));
    expect(weightOf(priorPosterior(), 'physical')).toBeGreaterThan(0);
    expect(weightOf(posterior, 'physical')).toBeLessThan(0);
  });

  it('gets closer to the truth as days accumulate', () => {
    const error = (count: number) => {
      const posterior = updateAll(priorPosterior(), generate(count, 99));
      return DOMAIN_FEATURES.reduce(
        (sum, f) => sum + Math.abs(weightOf(posterior, f) - TRUE_WEIGHTS[f]),
        0,
      );
    };
    expect(error(40)).toBeLessThan(error(4));
    expect(error(120)).toBeLessThan(error(40));
  });
});

describe('predictive uncertainty', () => {
  const doses = { cognitive: 180, visualVestibular: 150, sleepFatigue: 1 };
  const rng = seededRng(5);
  const consistentDays: Observation[] = Array.from({ length: 25 }, () => ({
    doses,
    deltaPoints: 1.2 + gaussian(rng) * 0.2,
  }));

  it('is wide before any data and narrower after', () => {
    const cold = predict(priorPosterior(), doses);
    const warm = predict(updateAll(priorPosterior(), consistentDays), doses);
    expect(warm.scale).toBeLessThan(cold.scale);
  });

  it('has fatter tails before any data, via degrees of freedom', () => {
    expect(predict(priorPosterior(), doses).degreesOfFreedom).toBeLessThan(
      predict(updateAll(priorPosterior(), consistentDays), doses).degreesOfFreedom,
    );
  });

  it('is less sure about a day unlike anything it has seen', () => {
    const posterior = updateAll(priorPosterior(), consistentDays);
    const familiar = predict(posterior, doses);
    const unfamiliar = predict(posterior, { physical: 600, emotionalAutonomic: 900 });
    expect(unfamiliar.scale).toBeGreaterThan(familiar.scale);
  });

  it('reports the mean as the weighted sum of the doses', () => {
    const posterior = updateAll(priorPosterior(), consistentDays);
    const x = featureVector(doses);
    expect(predict(posterior, doses).mean).toBeCloseTo(dot(posterior.meanWeights, x), 12);
  });
});

describe('exceedance probability', () => {
  it('rises with the dose', () => {
    const posterior = priorPosterior();
    const light = exceedanceProbability(predict(posterior, { cognitive: 30 }), 2);
    const heavy = exceedanceProbability(predict(posterior, { cognitive: 600 }), 2);
    expect(heavy).toBeGreaterThan(light);
  });

  it('is higher for the same dose when the model has seen little', () => {
    // This is the whole conservatism mechanism: uncertainty itself is a reason
    // to recommend less, with no special case for "new user" anywhere.
    const doses = { cognitive: 240, visualVestibular: 200 };
    const cold = exceedanceProbability(predict(priorPosterior(), doses), 2);

    const rng = seededRng(21);
    const settled = updateAll(
      priorPosterior(),
      Array.from({ length: 30 }, () => ({ doses, deltaPoints: 1.0 + gaussian(rng) * 0.15 })),
    );
    expect(cold).toBeGreaterThan(exceedanceProbability(predict(settled, doses), 2));
  });

  it('stays a probability', () => {
    for (const dose of [0, 100, 5000]) {
      const p = exceedanceProbability(predict(priorPosterior(), { cognitive: dose }), 2);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
