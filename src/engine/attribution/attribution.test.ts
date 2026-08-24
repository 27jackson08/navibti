import { describe, expect, it } from 'vitest';
import { gaussian, seededRng } from '@/data/synthetic/random';
import { priorPosterior, updateAll, type Observation } from '@/engine/tolerance/posterior';
import {
  FORBIDDEN_ATTRIBUTION_LANGUAGE,
  attribute,
  findConfounded,
  separationOf,
  weightCorrelation,
  type AttributionInput,
} from './attribution';

const FLARE = { deltaPoints: 4.2, durationMinutes: 150 };
const CALM = { deltaPoints: 0.8, durationMinutes: 25 };

/** A patient whose screens hurt and whose walking does not. */
function screenSensitive(days = 60, seed = 17) {
  const rng = seededRng(seed);
  return updateAll(
    priorPosterior(),
    Array.from({ length: days }, (): Observation => {
      const doses = {
        cognitive: rng() * 240,
        visualVestibular: rng() * 300,
        physical: rng() * 60,
        sleepFatigue: rng() * 3,
        emotionalAutonomic: rng() * 240,
      };
      const delta =
        0.2 +
        0.4 * (doses.cognitive / 240) +
        3.2 * (doses.visualVestibular / 240) +
        0.1 * (doses.physical / 60) +
        0.9 * (doses.sleepFatigue / 3) +
        0.3 * (doses.emotionalAutonomic / 240);
      return { doses, deltaPoints: delta + gaussian(rng) * 0.2 };
    }),
  );
}

function input(overrides: Partial<AttributionInput> = {}): AttributionInput {
  return {
    posterior: screenSensitive(),
    doses: { cognitive: 120, visualVestibular: 280, physical: 20, sleepFatigue: 1 },
    observed: FLARE,
    ...overrides,
  };
}

describe('naming the likely driver', () => {
  it('picks the domain that actually drives this patient', () => {
    const result = attribute(input());
    expect(result.outcome).toBe('attributed');
    expect(result.leading[0].domain).toBe('visualVestibular');
  });

  it('ranks contributions by points, not by raw dose', () => {
    // Cognitive load is the bigger number of minutes here; screens are the
    // bigger problem. Attribution must follow the weight, not the units.
    const result = attribute(
      input({
        doses: { cognitive: 240, visualVestibular: 150, physical: 10, sleepFatigue: 0.5 },
        // Consistent with what the fixture's generating model implies for these
        // doses, so the surprise check is not what this test ends up measuring.
        observed: { deltaPoints: 2.8, durationMinutes: 105 },
      }),
    );
    expect(result.outcome).toBe('attributed');
    expect(result.leading[0].domain).toBe('visualVestibular');
  });

  it('reports shares that sum to one across contributing domains', () => {
    const result = attribute(input());
    const total = result.contributions.reduce((sum, item) => sum + item.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('separates the unexplained baseline from the logged activities', () => {
    expect(attribute(input()).baseline).toBeGreaterThan(0);
  });
});

describe('the counterfactual', () => {
  it('compares against what the plan asked for', () => {
    const result = attribute(
      input({ recommended: { cognitive: 120, visualVestibular: 90, physical: 20, sleepFatigue: 1 } }),
    );
    expect(result.counterfactual).not.toBeNull();
    expect(result.counterfactual?.domain).toBe('visualVestibular');
    expect(result.counterfactual?.alternativePrediction).toBeLessThan(
      result.counterfactual?.actualPrediction ?? 0,
    );
    expect(result.explanation).toMatch(/instead of/);
  });

  it('offers none when the patient already stayed within the plan', () => {
    const result = attribute(
      input({ recommended: { cognitive: 200, visualVestibular: 300, physical: 60, sleepFatigue: 3 } }),
    );
    expect(result.counterfactual).toBeNull();
  });

  it('offers none when there was no plan to compare against', () => {
    expect(attribute(input()).counterfactual).toBeNull();
  });
});

describe('refusing to guess', () => {
  it('says nothing when symptoms stayed mild', () => {
    const result = attribute(input({ observed: CALM }));
    expect(result.outcome).toBe('nothing-to-explain');
    expect(result.leading).toHaveLength(0);
  });

  it('waits for enough data before naming anything', () => {
    const result = attribute(input({ posterior: priorPosterior() }));
    expect(result.outcome).toBe('not-enough-data');
    expect(result.leading).toHaveLength(0);
  });

  it('declines when the day does not match the pattern at all', () => {
    // Predicting a mild day and seeing a severe one means the model does not
    // understand this day. Naming a cause anyway would be confabulation.
    const result = attribute(
      input({ doses: { cognitive: 5, visualVestibular: 5 }, observed: { deltaPoints: 9, durationMinutes: 400 } }),
    );
    expect(result.outcome).toBe('day-does-not-match-pattern');
    expect(result.explanation).toMatch(/clinician/i);
  });

  it('refuses to pick between two loads that always move together', () => {
    // Screens and cognitive load are identical every single day here, so the
    // data genuinely cannot separate them and neither can we.
    const rng = seededRng(4);
    const lockstep = updateAll(
      priorPosterior(),
      Array.from({ length: 40 }, (): Observation => {
        const shared = rng() * 240;
        return {
          doses: { cognitive: shared, visualVestibular: shared, physical: 20, sleepFatigue: 1 },
          deltaPoints: 0.3 + 2.6 * (shared / 240) + gaussian(rng) * 0.15,
        };
      }),
    );

    const result = attribute({
      posterior: lockstep,
      doses: { cognitive: 230, visualVestibular: 230, physical: 20, sleepFatigue: 1 },
      // Consistent with the fixture's own generating model, so the surprise
      // check does not fire first and mask what this test is about.
      observed: { deltaPoints: 2.9, durationMinutes: 110 },
    });

    expect(result.outcome).toBe('confounded');
    expect(result.confounded.length).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/no way to tell yet which one matters more/);
  });

  it('does not cry confounding when the domains vary independently', () => {
    expect(attribute(input()).confounded).toHaveLength(0);
  });
});

describe('separability', () => {
  const lockstepDoses = { cognitive: 230, visualVestibular: 230, physical: 20, sleepFatigue: 1 };

  function lockstep(days = 30, seed = 8) {
    const rng = seededRng(seed);
    return updateAll(
      priorPosterior(),
      Array.from({ length: days }, () => {
        const shared = rng() * 240;
        return {
          doses: { cognitive: shared, visualVestibular: shared, physical: rng() * 60 },
          deltaPoints: 0.3 + 2.6 * (shared / 240) + gaussian(rng) * 0.15,
        };
      }),
    );
  }

  it('cannot separate two loads that never vary apart', () => {
    expect(
      separationOf(lockstep(), 'cognitive', 'visualVestibular', lockstepDoses),
    ).toBeLessThan(1);
  });

  it('separates a dominant driver from a minor one', () => {
    expect(
      separationOf(screenSensitive(), 'visualVestibular', 'physical', {
        visualVestibular: 280,
        physical: 20,
      }),
    ).toBeGreaterThan(1);
  });

  it('stays cautious early, when the prior is doing the separating', () => {
    // With few days the prior, not the data, is what tells two collinear
    // domains apart. The gate should not be fooled by that.
    expect(separationOf(lockstep(8), 'cognitive', 'visualVestibular', lockstepDoses)).toBeLessThan(1);
  });

  it('finds no confounded pairs in a well-varied history', () => {
    expect(
      findConfounded(screenSensitive(), ['cognitive', 'visualVestibular', 'physical'], {
        cognitive: 120,
        visualVestibular: 280,
        physical: 20,
      }),
    ).toEqual([]);
  });

  it('still exposes weight correlation as a diagnostic', () => {
    expect(Math.abs(weightCorrelation(lockstep(80), 'cognitive', 'visualVestibular'))).toBeGreaterThan(
      Math.abs(weightCorrelation(screenSensitive(), 'cognitive', 'physical')),
    );
  });
});

describe('language discipline', () => {
  const everyOutcome = [
    attribute(input()),
    attribute(input({ observed: CALM })),
    attribute(input({ posterior: priorPosterior() })),
    attribute(input({ doses: { cognitive: 5 }, observed: { deltaPoints: 9, durationMinutes: 400 } })),
    attribute(
      input({ recommended: { cognitive: 120, visualVestibular: 90, physical: 20, sleepFatigue: 1 } }),
    ),
  ];

  it('never claims causation, in any outcome', () => {
    for (const result of everyOutcome) {
      for (const pattern of FORBIDDEN_ATTRIBUTION_LANGUAGE) {
        expect(pattern.test(result.explanation), `"${result.explanation}"`).toBe(false);
      }
    }
  });

  it('hedges every explanation it does give', () => {
    const attributed = everyOutcome.filter((result) => result.outcome === 'attributed');
    expect(attributed.length).toBeGreaterThan(0);
    for (const result of attributed) {
      expect(result.explanation).toMatch(/most consistent with/i);
    }
  });

  it('always says something, whatever the outcome', () => {
    for (const result of everyOutcome) {
      expect(result.explanation.length).toBeGreaterThan(30);
    }
  });
});
