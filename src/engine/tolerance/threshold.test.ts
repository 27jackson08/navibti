import { describe, expect, it } from 'vitest';
import { EXACERBATION_POINT_LIMIT, TOLERANCE_EXCEEDANCE_QUANTILE } from '@/data/guidelines';
import { gaussian, seededRng } from '@/data/synthetic/random';
import { exceedanceProbability, predict, priorPosterior, updateAll } from './posterior';
import {
  detectUnderExposure,
  minimumDay,
  planDay,
  rampCap,
  recommendDomain,
  solveTolerance,
  toBand,
  type PlanInput,
} from './threshold';
import { stageCap, stageFloor } from './stage-caps';
import { REFERENCE_DOSES, denormalizeDose, normalizeDose } from './units';

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
      input({ posterior: settledPosterior(), step: 2, yesterday: { cognitive: 30 } }),
      'cognitive',
    );
    expect(recommendation.binding).toBe('ramp');
    expect(recommendation.dose).toBeLessThan(recommendation.modelTolerance);
  });

  it('lets the guideline floor beat a ramp that would hold a patient back', () => {
    // At step 4 the guidance expects full days. A 54-minute ramp derived from
    // one quiet yesterday is not a reason to keep someone there.
    const recommendation = recommendDomain(
      input({ posterior: settledPosterior(), step: 4, yesterday: { cognitive: 30 } }),
      'cognitive',
    );
    expect(recommendation.binding).toBe('floor');
    expect(recommendation.dose).toBeGreaterThan(recommendation.rampCap);
  });

  it('reports the model as binding when the guideline and the ramp allow more', () => {
    const recommendation = recommendDomain(
      input({ posterior: priorPosterior(), step: 4, yesterday: { cognitive: 240 } }),
      'cognitive',
    );
    expect(recommendation.binding).toBe('model');
  });

  it('recommends the smallest of the three, then lifts to the floor', () => {
    for (const step of [1, 2, 3, 4]) {
      for (const yesterday of [0, 45, 200, 400]) {
        const recommendation = recommendDomain(
          input({ posterior: settledPosterior(), step, yesterday: { cognitive: yesterday } }),
          'cognitive',
        );
        const capped = Math.min(
          recommendation.modelTolerance,
          recommendation.rampCap,
          recommendation.stageCap,
        );
        const floor = denormalizeDose(
          'cognitive',
          stageFloor('return-to-learn', step, 'cognitive').floor,
        );
        expect(recommendation.dose).toBeCloseTo(Math.max(capped, floor), 6);
      }
    }
  });

  it('keeps every recommended dose inside the guideline risk target', () => {
    // The safety invariant. Holds because the solver takes the first crossing,
    // so anything at or below the model tolerance is inside the target.
    const posterior = settledPosterior();
    for (const step of [1, 2, 3, 4]) {
      for (const recommendation of planDay(input({ posterior, step, yesterday: { cognitive: 180 } }))
        .recommendations) {
        // The floor is the one constraint allowed to exceed the model's
        // estimate, and when it does the plan says so and escalates.
        if (recommendation.modelTolerance === 0 || recommendation.binding === 'floor') continue;
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
    expect(planDay(input()).recommendations.map((r) => r.domain)).toEqual([
      'cognitive',
      'visualVestibular',
      'physical',
      'sleepFatigue',
      'emotionalAutonomic',
    ]);
  });

  it("explains the stage ceiling in the guideline's own words", () => {
    const screens = planDay(input({ step: 1 })).recommendations.find(
      (r) => r.domain === 'visualVestibular',
    );
    expect(screens?.stageCapReadingOf).toMatch(/screentime/i);
  });
});

describe('the day as a whole', () => {
  it('checks joint risk, not just each domain in isolation', () => {
    // Five individually safe doses can add up to an unsafe day. Our own
    // evaluation caught exactly that: independent per-domain solving produced a
    // 60% unsafe rate before allocation was made sequential.
    const posterior = settledPosterior();
    for (const step of [1, 2, 3, 4]) {
      const plan = planDay(input({ posterior, step, yesterday: { cognitive: 150 } }));
      if (plan.floorOverrodeModel) continue;
      expect(plan.jointExceedanceProbability, `step ${step}`).toBeLessThanOrEqual(TARGET + 0.02);
    }
  });

  it('never plans a day of literally nothing at any step', () => {
    // The collapse-to-zero failure: recommend nothing, learn nothing, recommend
    // nothing again. The guideline floor exists to make this unreachable.
    const rng = seededRng(31);
    const catastrophizing = updateAll(
      priorPosterior(),
      Array.from({ length: 20 }, () => ({ doses: { cognitive: 5 }, deltaPoints: 7 })),
    );
    void rng;
    for (const step of [1, 2, 3, 4]) {
      const plan = planDay(input({ posterior: catastrophizing, step }));
      const physical = plan.recommendations.find((r) => r.domain === 'physical');
      expect(physical?.dose, `step ${step}`).toBeGreaterThan(0);
      expect(physical?.binding).toBe('floor');
    }
  });

  it('escalates when even a floor-only day is predicted to flare', () => {
    const catastrophizing = updateAll(
      priorPosterior(),
      Array.from({ length: 20 }, () => ({ doses: { cognitive: 5 }, deltaPoints: 7 })),
    );
    expect(planDay(input({ posterior: catastrophizing, step: 3 })).needsClinicianReview).toBe(true);
  });

  it('does not escalate for an ordinary patient', () => {
    expect(planDay(input({ posterior: settledPosterior(), step: 3 })).needsClinicianReview).toBe(
      false,
    );
  });

  it('says so when the floor had to override the model', () => {
    const catastrophizing = updateAll(
      priorPosterior(),
      Array.from({ length: 20 }, () => ({ doses: { cognitive: 5 }, deltaPoints: 7 })),
    );
    expect(planDay(input({ posterior: catastrophizing, step: 3 })).floorOverrodeModel).toBe(true);
  });
});

describe('what the guideline floor means once a clinician has set a ceiling', () => {
  /**
   * Everything here is one defect: signals that describe the floor being the
   * number on the page kept saying so after a clinician had capped below it.
   * The floor was not being shown; their number was.
   */
  const catastrophizing = () =>
    updateAll(
      priorPosterior(),
      Array.from({ length: 20 }, () => ({ doses: { cognitive: 5 }, deltaPoints: 7 })),
    );

  const capped = { cognitive: 0, visualVestibular: 0, physical: 0, emotionalAutonomic: 0 };

  it('stops claiming the minimum is being shown when it is not', () => {
    const posterior = catastrophizing();
    expect(planDay(input({ posterior, step: 3 })).floorOverrodeModel).toBe(true);
    expect(
      planDay(input({ posterior, step: 3, clinicianCaps: capped })).floorOverrodeModel,
    ).toBe(false);
  });

  it('counts the ceiling as part of the lightest available day', () => {
    // The escalation exists because there is no smaller number the guidance
    // supports. Once a clinician has named one there is — theirs — so the day
    // being judged has to be that one, not the guideline's.
    const plain = minimumDay(input({ step: 3 }));
    const withCeiling = minimumDay(input({ step: 3, clinicianCaps: { physical: 0 } }));

    expect(plain.physical).toBeGreaterThan(0);
    expect(withCeiling.physical).toBe(0);
    expect(withCeiling.cognitive).toBe(plain.cognitive);
  });

  it('does not raise a minimum to meet a ceiling set above it', () => {
    const plain = minimumDay(input({ step: 3 }));
    const roomy = minimumDay(input({ step: 3, clinicianCaps: { physical: 100_000 } }));
    expect(roomy.physical).toBe(plain.physical);
  });

  it('still escalates when even a zeroed day is predicted to flare', () => {
    // Sleep is the one load nobody can prescribe, so a ceiling on everything
    // else does not make this question go away — and it should not.
    expect(
      planDay(input({ posterior: catastrophizing(), step: 3, clinicianCaps: capped }))
        .needsClinicianReview,
    ).toBe(true);
  });

  it('still lets the floor speak where the clinician set no ceiling', () => {
    const posterior = catastrophizing();
    const plan = planDay(input({ posterior, step: 3, clinicianCaps: { cognitive: 0 } }));
    const physical = plan.recommendations.find((r) => r.domain === 'physical');

    expect(physical?.binding).toBe('floor');
    expect(physical?.dose).toBeGreaterThan(0);
    expect(plan.floorOverrodeModel).toBe(true);
  });

  it('names the clinician as the binding constraint, not the floor', () => {
    const plan = planDay(
      input({ posterior: catastrophizing(), step: 3, clinicianCaps: { physical: 0 } }),
    );
    const physical = plan.recommendations.find((r) => r.domain === 'physical');

    expect(physical?.binding).toBe('clinician');
    expect(physical?.dose).toBe(0);
  });

  it('leaves a ceiling above the plan making no difference', () => {
    const posterior = settledPosterior();
    const plain = planDay(input({ posterior, step: 3 }));
    const roomy = planDay(input({ posterior, step: 3, clinicianCaps: { cognitive: 100_000 } }));

    expect(roomy.doses).toEqual(plain.doses);
    expect(roomy.needsClinicianReview).toBe(plain.needsClinicianReview);
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
