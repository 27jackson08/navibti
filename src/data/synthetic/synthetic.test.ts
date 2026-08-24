import { describe, expect, it } from 'vitest';
import { isMildAndBrief } from '@/data/guidelines';
import {
  expectedDelta,
  makeCohort,
  makePatient,
  sampleSleepDebt,
  simulateDay,
  trueTolerance,
  trueWeightsOn,
} from './patient';
import { seededRng } from './random';
import { simulatePatient, summarize } from './simulate';

describe('reproducibility', () => {
  it('gives the same patient for the same seed', () => {
    expect(makePatient(12)).toEqual(makePatient(12));
  });

  it('gives different patients for different seeds', () => {
    expect(makePatient(12).baselineWeights).not.toEqual(makePatient(13).baselineWeights);
  });

  it('runs an identical simulation twice', () => {
    const patient = makePatient(5);
    expect(simulatePatient(patient, 10)).toEqual(simulatePatient(patient, 10));
  });

  it('builds a cohort of distinct patients', () => {
    const cohort = makeCohort(20);
    expect(new Set(cohort.map((patient) => patient.id)).size).toBe(20);
  });
});

describe('recovery', () => {
  const patient = makePatient(8);

  it('reduces sensitivity as days pass', () => {
    const early = trueWeightsOn(patient, 0).cognitive;
    const later = trueWeightsOn(patient, 14).cognitive;
    expect(later).toBeLessThan(early);
  });

  it('never decays past the residual floor', () => {
    const baseline = patient.baselineWeights.cognitive;
    const veryLate = trueWeightsOn(patient, 500).cognitive;
    expect(veryLate).toBeGreaterThanOrEqual(baseline * patient.residualSensitivity * 0.999);
  });

  it('raises true tolerance over the course of recovery', () => {
    // Measured against a day with real competing load, so neither end of the
    // comparison is sitting at the search ceiling where differences vanish.
    const context = { visualVestibular: 180, sleepFatigue: 2, emotionalAutonomic: 120 };
    const early = trueTolerance(patient, 0, 'cognitive', context);
    const later = trueTolerance(patient, 14, 'cognitive', context);
    expect(early).toBeLessThan(1.5);
    expect(later).toBeGreaterThan(early);
  });

  it('leaves no headroom when the rest of the day already uses it', () => {
    const empty = trueTolerance(patient, 0, 'cognitive', {});
    const crowded = trueTolerance(patient, 0, 'cognitive', {
      visualVestibular: 240,
      sleepFatigue: 3,
      emotionalAutonomic: 240,
    });
    expect(crowded).toBeLessThan(empty);
  });

  it('reports the ceiling where a domain does not raise symptoms at all', () => {
    const helpedByExercise = {
      ...makePatient(2),
      baselineWeights: { ...makePatient(2).baselineWeights, physical: -0.5 },
    };
    expect(trueTolerance(helpedByExercise, 3, 'physical', {})).toBe(1.5);
  });
});

describe('symptom simulation', () => {
  const patient = makePatient(4);

  it('never produces a negative symptom increase', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 200; i += 1) {
      expect(simulateDay(patient, 3, { cognitive: 10 }, rng).deltaPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('scales duration with magnitude, so both limits fail together', () => {
    // Duration must not be the binding failure on its own -- a 2-point rise is
    // inside the guideline envelope and should usually resolve inside the hour.
    const rng = seededRng(2);
    const light = simulateDay(patient, 3, { cognitive: 5 }, rng);
    const heavy = simulateDay(patient, 0, { cognitive: 480, visualVestibular: 480 }, rng);
    expect(heavy.durationMinutes).toBeGreaterThan(light.durationMinutes);
    expect(isMildAndBrief({ deltaPoints: 2, durationMinutes: 12 + 2 * 18 })).toBe(true);
  });

  it('predicts more symptoms from more load', () => {
    expect(expectedDelta(patient, 2, { cognitive: 240 })).toBeGreaterThan(
      expectedDelta(patient, 2, { cognitive: 20 }),
    );
  });
});

describe('sleep is exogenous', () => {
  it('is never negative', () => {
    const rng = seededRng(3);
    const patient = makePatient(6);
    for (let i = 0; i < 100; i += 1) {
      expect(sampleSleepDebt(patient, rng)).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not scale with how closely the patient follows the plan', () => {
    // Sleep debt was previously derived from the plan, which made every
    // simulated patient accrue the maximum tolerated debt every night.
    const compliant = { ...makePatient(6), adherence: 0.9 };
    const overshooting = { ...makePatient(6), adherence: 1.6 };
    const a = simulatePatient(compliant, 8).days.map((day) => day.actual.sleepFatigue);
    const b = simulatePatient(overshooting, 8).days.map((day) => day.actual.sleepFatigue);
    expect(a).toEqual(b);
  });
});

describe('red flags end the simulation', () => {
  const flagged = makeCohort(400).find((patient) => patient.redFlagDay !== null);

  it('finds red-flag patients in a cohort of this size', () => {
    expect(flagged).toBeDefined();
  });

  it('halts on the flagged day and produces no plan for it', () => {
    if (!flagged) throw new Error('no red-flag patient generated');
    const result = simulatePatient(flagged, 21);
    expect(result.haltedOn).toBe(flagged.redFlagDay);
    expect(result.haltWasDetected).toBe(true);
    expect(result.days.every((day) => day.day < (flagged.redFlagDay ?? 0))).toBe(true);
  });
});

describe('summarize', () => {
  const results = makeCohort(25).map((patient) => simulatePatient(patient, 14));
  const metrics = summarize(results);

  it('counts every simulated day', () => {
    expect(metrics.simulatedDays).toBe(results.reduce((sum, r) => sum + r.days.length, 0));
  });

  it('reports rates as proportions', () => {
    for (const rate of [
      metrics.unsafeRecommendationRate,
      metrics.overEstimationRate,
      metrics.collapsedToleranceRate,
      metrics.redFlagRecall,
    ]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('has binding shares that sum to one', () => {
    const total = Object.values(metrics.bindingShare).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('detects every red flag it generates', () => {
    expect(metrics.redFlagRecall).toBe(1);
  });
});
