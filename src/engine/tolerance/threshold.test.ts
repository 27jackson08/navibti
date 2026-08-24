import { describe, expect, it } from 'vitest';
import { EXACERBATION_POINT_LIMIT, TOLERANCE_EXCEEDANCE_QUANTILE } from '@/data/guidelines';
import { gaussian, seededRng } from '@/data/synthetic/random';
import { exceedanceProbability, predict, priorPosterior, updateAll } from './posterior';
import { stageCap } from './stage-caps';
import {
  detectUnderExposure,
  planDay,
  rampCap,
  recommendDomain,
  solveTolerance,
  toBand,
  type PlanInput,
} from './threshold';
import { REFERENCE_DOSES, normalizeDose } from './units';

const LIMIT = EXACERBATION_POINT_LIMIT.value;
const TARGET = TOLERANCE_EXCEEDANCE_QUANTILE.value;

/** A patient who reliably handles about 200 focused minutes with a small rise. */
function settledPosterior(seed = 4, days = 40) {
  const rng = seededRng(seed);
  return updateAll(
    priorPosterior(),
    Array.from({ length: days }, () => {
      const cognitive = 120 + rng() * 160;
      return {
        doses: { cognitive },
        deltaPoints: 0.4 + (cognitive / 240) * 0.6 + gaussian(rng) * 0.15,
      };
    }),
  );
}

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    posterior: priorPosterior(),
    protocol: 'return-to-learn',
    step: 3,
    context: {},
    yesterday: {},
    ...overrides,
  };
}

describe('solveTolerance', () => {
  it('never names a dose whose predicted risk exceeds the target', () => {
    const posterior = settledPosterior();
    const tolerance = solveTolerance(posterior, 'cognitive', {});
    const dose = tolerance * REFERENCE_DOSES.cognitive.reference;
    expect(exceedanceProbability(predict(posterior, { cognitive: dose }), LIMIT)).toBeLessThanOrEqual(
      TARGET + 1e-6,
    );
  });

  it('returns zero when even no load is predicted to breach the limit', () => {
    const rng = seededRng(9);
    const alwaysFlaring = updateAll(
      priorPosterior(),
      Array.from({ length: 30 }, () => ({
        doses: { cognitive: 10 },
        deltaPoints: 6 + gaussian(rng) * 0.2,
      })),
    );
    expect(solveTolerance(alwaysFlaring, 'cognitive', {})).toBe(0);
  });

  it('is smaller when the model has seen nothing', () => {
    // The headline conservatism claim, tested directly: uncertainty alone
    // lowers the recommendation, with no new-user special case in the code.
    const cold = solveTolerance(priorPosterior(), 'cognitive', {});
    const warm = solveTolerance(settledPosterior(), 'cognitive', {});
    expect(cold).toBeLessThan(warm);
  });

  it('shrinks as the rest of the day gets heavier', () => {
    const posterior = settledPosterior();
    const quietDay = solveTolerance(posterior, 'cognitive', { emotionalAutonomic: 0 });
    const loudDay = solveTolerance(posterior, 'cognitive', {
      emotionalAutonomic: 240,
      sleepFatigue: 3,
    });
    expect(loudDay).toBeLessThan(quietDay);
  });

  it('never searches past a day and a half of ordinary load', () => {
    const rng = seededRng(2);
    const bulletproof = updateAll(
      priorPosterior(),
      Array.from({ length: 60 }, () => ({
        doses: { cognitive: 400 },
        deltaPoints: 0.05 + Math.abs(gaussian(rng)) * 0.02,
      })),
    );
    expect(solveTolerance(bulletproof, 'cognitive', {})).toBeLessThanOrEqual(1.5);
  });
});

describe('the three-way clamp', () => {
  it('reports the stage as binding at the tightest step', () => {
    const recommendation = recommendDomain(
      input({ posterior: settledPosterior(), step: 1, yesterday: { visualVestibular: 240 } }),
      'visualVestibular',
    );
    expect(recommendation.binding).toBe('stage');
    expect(recommendation.dose).toBeCloseTo(
      stageCap('return-to-learn', 1, 'visualVestibular').cap * 240,
      6,
    );
  });

  it('reports the ramp as binding after a very light day', () => {
    const recommendation = recommendDomain(
      input({ posterior: settledPosterior(), step: 4, yesterday: { cognitive: 30 } }),
      'cognitive',
    );
    expect(recommendation.binding).toBe('ramp');
    expect(recommendation.dose).toBeLessThan(recommendation.modelTolerance);
  });

  it('reports the model as binding when the guideline and the ramp allow more', () => {
    const recommendation = recommendDomain(
      input({ posterior: priorPosterior(), step: 4, yesterday: { cognitive: 240 } }),
      'cognitive',
    );
    expect(recommendation.binding).toBe('model');
  });

  it('always recommends the smallest of the three', () => {
    for (const step of [1, 2, 3, 4]) {
      for (const yesterday of [0, 45, 200, 400]) {
        const recommendation = recommendDomain(
          input({ posterior: settledPosterior(), step, yesterday: { cognitive: yesterday } }),
          'cognitive',
        );
        expect(recommendation.dose).toBeCloseTo(
          Math.min(
            recommendation.modelTolerance,
            recommendation.rampCap,
            recommendation.stageCap,
          ),
          6,
        );
      }
    }
  });

  it('keeps every recommended dose inside the guideline risk target', () => {
    // The safety invariant. Holds because the solver takes the first crossing,
    // so anything at or below the model tolerance is inside the target.
    const posterior = settledPosterior();
    for (const step of [1, 2, 3, 4]) {
      for (const recommendation of planDay(input({ posterior, step, yesterday: { cognitive: 180 } }))) {
        if (recommendation.modelTolerance === 0) continue;
        expect(
          recommendation.exceedanceProbability,
          `${recommendation.domain} at step ${step}`,
        ).toBeLessThanOrEqual(TARGET + 1e-6);
      }
    }
  });
});

describe('the ramp', () => {
  it('allows a fifth more than yesterday', () => {
    expect(rampCap('cognitive', 200)).toBeCloseTo(normalizeDose('cognitive', 200) * 1.2, 10);
  });

  it('does not pin the patient at zero after a fully rested day', () => {
    // Without a floor, one zero day would make every later recommendation zero,
    // which is the opposite of what the anti-strict-rest guidance asks for.
    expect(rampCap('cognitive', 0)).toBeGreaterThan(0);
    expect(rampCap('cognitive', undefined)).toBeGreaterThan(0);
  });

  it('uses the floor rather than the fraction when yesterday was tiny', () => {
    expect(rampCap('cognitive', 12)).toBeCloseTo(normalizeDose('cognitive', 12) + 0.1, 10);
  });
});

describe('bands', () => {
  it.each([
    [0, 'very-low'],
    [0.24, 'very-low'],
    [0.25, 'low'],
    [0.49, 'low'],
    [0.5, 'moderate'],
    [0.84, 'moderate'],
    [0.85, 'near-full'],
    [1.2, 'near-full'],
  ])('%f is %s', (value, expected) => {
    expect(toBand(value)).toBe(expected);
  });
});

describe('provisional labelling', () => {
  it('marks recommendations provisional until three days are in', () => {
    expect(recommendDomain(input(), 'cognitive').isProvisional).toBe(true);
    expect(
      recommendDomain(input({ posterior: settledPosterior(1, 3) }), 'cognitive').isProvisional,
    ).toBe(false);
  });
});

describe('planDay', () => {
  it('covers every load domain', () => {
    expect(planDay(input()).map((r) => r.domain)).toEqual([
      'cognitive',
      'visualVestibular',
      'physical',
      'sleepFatigue',
      'emotionalAutonomic',
    ]);
  });

  it("explains the stage ceiling in the guideline's own words", () => {
    const screens = planDay(input({ step: 1 })).find((r) => r.domain === 'visualVestibular');
    expect(screens?.stageCapReadingOf).toMatch(/screentime/i);
  });
});

describe('under-exposure detection', () => {
  const tolerances = {
    cognitive: 240,
    visualVestibular: 240,
    physical: 60,
    sleepFatigue: 3,
    emotionalAutonomic: 240,
  };

  it('names sustained avoidance while symptoms are steady', () => {
    const findings = detectUnderExposure(
      [
        { doses: { cognitive: 30 }, deltaPoints: 0.5 },
        { doses: { cognitive: 25 }, deltaPoints: 0.4 },
      ],
      tolerances,
    );
    expect(findings.map((f) => f.domain)).toContain('cognitive');
    expect(findings[0].message).toMatch(/room to do a little more/i);
  });

  it('stays quiet when symptoms actually rose', () => {
    expect(
      detectUnderExposure(
        [
          { doses: { cognitive: 30 }, deltaPoints: 0.5 },
          { doses: { cognitive: 25 }, deltaPoints: 4 },
        ],
        tolerances,
      ),
    ).toEqual([]);
  });

  it('stays quiet about a domain the patient is already near tolerance in', () => {
    const findings = detectUnderExposure(
      [
        { doses: { cognitive: 200 }, deltaPoints: 0.5 },
        { doses: { cognitive: 210 }, deltaPoints: 0.6 },
      ],
      tolerances,
    );
    expect(findings.map((f) => f.domain)).not.toContain('cognitive');
  });

  it('surfaces at most two prompts, so guidance does not read as pressure', () => {
    const quiet = { cognitive: 10, visualVestibular: 10, physical: 2, emotionalAutonomic: 10 };
    const findings = detectUnderExposure(
      [
        { doses: quiet, deltaPoints: 0.2 },
        { doses: quiet, deltaPoints: 0.2 },
      ],
      tolerances,
    );
    expect(findings.length).toBe(2);
  });

  it('ignores a domain the check-in never asked about', () => {
    const findings = detectUnderExposure(
      [
        { doses: { cognitive: 20 }, deltaPoints: 0.2 },
        { doses: { cognitive: 20 }, deltaPoints: 0.2 },
      ],
      tolerances,
    );
    expect(findings.map((f) => f.domain)).toEqual(['cognitive']);
  });

  it('never tells anyone to sleep less', () => {
    const findings = detectUnderExposure(
      [
        { doses: { sleepFatigue: 0 }, deltaPoints: 0.2 },
        { doses: { sleepFatigue: 0 }, deltaPoints: 0.2 },
      ],
      tolerances,
    );
    expect(findings.map((f) => f.domain)).not.toContain('sleepFatigue');
  });

  it('needs a full window before saying anything', () => {
    expect(detectUnderExposure([{ doses: { cognitive: 10 }, deltaPoints: 0.3 }], tolerances)).toEqual(
      [],
    );
  });
});
