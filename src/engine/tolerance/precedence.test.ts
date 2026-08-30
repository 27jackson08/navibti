import { describe, expect, it } from 'vitest';
import { LOAD_DOMAINS, PROTOCOLS, type LoadDomain, type ProtocolId } from '@/data/guidelines';
import { seededRng } from '@/data/synthetic/random';
import { priorPosterior, updateAll } from './posterior';
import { ladderFor, recommendDomain, type PlanInput } from './threshold';
import { stageCap, stageFloor } from './stage-caps';
import { denormalizeDose } from './units';

/**
 * The invariant the whole product rests on, tested as a property.
 *
 * AGENTS.md states it: "The model may never widen what the guideline permits.
 * The stage machine decides what is allowed; the tolerance model only picks a
 * dose inside it." Until now that was checked on one domain, one protocol and
 * sixteen combinations of step and yesterday, with a single settled posterior.
 * Sixteen cases is a sample; this is the claim.
 *
 * The order the engine applies, and therefore what has to hold:
 *
 *   1. the smallest of model tolerance, ramp cap and stage cap
 *   2. scaled down by what the environment can actually deliver
 *   3. lifted to the guideline floor — the one constraint that raises
 *   4. cut to a clinician's ceiling, which outranks everything including the
 *      floor, because a general default has no business overriding someone who
 *      has examined this patient
 *
 * So a dose may exceed the stage cap only by being the floor, and may never
 * exceed a clinician's ceiling for any reason at all.
 */
const TOLERANCE = 1e-9;

function posteriorFor(seed: number) {
  const rng = seededRng(seed);
  const observations = Array.from({ length: 12 }, () => ({
    doses: Object.fromEntries(
      LOAD_DOMAINS.map((domain) => [domain, rng() * 200]),
    ) as Partial<Record<LoadDomain, number>>,
    deltaPoints: rng() * 6,
  }));
  return updateAll(priorPosterior(), observations);
}

/** Every step of both ladders, against every domain. */
const GRID: readonly (readonly [ProtocolId, number, LoadDomain])[] = (
  ['return-to-learn', 'return-to-sport'] as const
).flatMap((protocol) =>
  Array.from({ length: PROTOCOLS[protocol].steps.length }, (_, i) => i + 1).flatMap((step) =>
    LOAD_DOMAINS.map((domain) => [protocol, step, domain] as const),
  ),
);

describe('the guideline floor never exceeds its own stage ceiling', () => {
  // If it did, the floor would be widening what the stage permits — the exact
  // thing the model is forbidden to do — and it would do it invisibly, because
  // the floor is applied last and reported as the binding constraint.
  it.each(GRID)('%s step %i, %s', (protocol, step, domain) => {
    expect(stageFloor(protocol, step, domain).floor).toBeLessThanOrEqual(
      stageCap(protocol, step, domain).cap + TOLERANCE,
    );
  });

  it('holds for the pairing the engine actually uses, too', () => {
    // Physical follows the primary protocol and everything else follows
    // Return-to-Learn, so a floor and a cap can come from different ladders.
    // The pairing above is the one the data declares; this is the one a patient
    // is judged against.
    for (const [protocol, step, domain] of GRID) {
      const plan = { protocol, step, context: {}, yesterday: {} } as PlanInput;
      const ladder = ladderFor(plan, domain);

      expect(
        stageFloor(ladder.protocol, ladder.step, domain).floor,
        `${protocol} step ${step} ${domain}`,
      ).toBeLessThanOrEqual(stageCap(ladder.protocol, ladder.step, domain).cap + TOLERANCE);
    }
  });
});

describe('no recommendation escapes the constraints above it', () => {
  const CEILINGS = [undefined, 0, 1, 15, 90, 100_000];
  const ENVIRONMENTS = [undefined, 1, 0.75, 0.4];

  const cases = GRID.flatMap(([protocol, step, domain], index) =>
    [0, 60, 400].map((yesterday) => {
      const cap = CEILINGS[index % CEILINGS.length];
      const factor = ENVIRONMENTS[index % ENVIRONMENTS.length];
      return [protocol, step, domain, yesterday, cap, factor] as const;
    }),
  );

  it('covers the whole grid', () => {
    expect(cases.length).toBeGreaterThan(100);
  });

  it.each(cases)(
    '%s step %i %s, yesterday %i, ceiling %s, environment %s',
    (protocol, step, domain, yesterday, ceiling, factor) => {
      for (const seed of [3, 17, 41]) {
        const plan: PlanInput = {
          posterior: posteriorFor(seed),
          protocol,
          step,
          context: {},
          yesterday: { [domain]: yesterday },
          ...(ceiling === undefined ? {} : { clinicianCaps: { [domain]: ceiling } }),
          ...(factor === undefined ? {} : { environmentFactor: { [domain]: factor } }),
        };

        const r = recommendDomain(plan, domain);
        const where = `${protocol} step ${step} ${domain} seed ${seed}`;

        expect(Number.isFinite(r.dose), `${where}: dose is not a number`).toBe(true);
        expect(r.dose, `${where}: negative dose`).toBeGreaterThanOrEqual(0);

        // A clinician's ceiling outranks everything, including the floor.
        if (ceiling !== undefined) {
          expect(r.dose, `${where}: exceeds the clinician ceiling`).toBeLessThanOrEqual(
            ceiling + TOLERANCE,
          );
        }

        // Via the same ladder the engine uses. Physical follows the patient's
        // primary protocol; everything else follows Return-to-Learn, because the
        // two run in parallel and a student athlete is on both at once.
        // Computing the floor from the sport ladder made this test report the
        // engine as broken when it was the test reading the wrong column.
        const ladder = ladderFor(plan, domain);
        const floor = denormalizeDose(
          domain,
          stageFloor(ladder.protocol, ladder.step, domain).floor,
        );
        const smallest = Math.min(r.modelTolerance, r.rampCap, r.stageCap);

        // Above the smallest constraint only by being the floor — and not even
        // then, if a clinician has capped below it.
        const liftedToFloor = Math.abs(r.dose - Math.min(floor, ceiling ?? floor)) < 1e-6;
        expect(
          r.dose <= smallest + TOLERANCE || liftedToFloor,
          `${where}: dose ${r.dose} exceeds min(model ${r.modelTolerance}, ramp ${r.rampCap}, ` +
            `stage ${r.stageCap}) without being the floor ${floor}`,
        ).toBe(true);

        // And never above the stage ceiling except as the floor, which is
        // asserted never to sit above it in the block before this one.
        expect(
          r.dose <= r.stageCap + TOLERANCE || liftedToFloor,
          `${where}: dose ${r.dose} is above the stage cap ${r.stageCap}`,
        ).toBe(true);
      }
    },
  );
});
