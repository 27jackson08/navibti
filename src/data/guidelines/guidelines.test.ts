import { describe, expect, it } from 'vitest';
import {
  CITATIONS,
  EXACERBATION_MINUTE_LIMIT,
  EXACERBATION_POINT_LIMIT,
  PROTOCOLS,
  RED_FLAGS,
  RETURN_TO_LEARN,
  RETURN_TO_SPORT,
  isMildAndBrief,
  stepOf,
  type Sourced,
} from './index';
import * as thresholds from './thresholds';

describe('protocol shape', () => {
  it('return-to-learn has exactly four steps', () => {
    expect(RETURN_TO_LEARN.steps).toHaveLength(4);
  });

  it('return-to-sport has exactly six steps', () => {
    expect(RETURN_TO_SPORT.steps).toHaveLength(6);
  });

  it.each(Object.values(PROTOCOLS))('$id numbers its steps contiguously from 1', (protocol) => {
    expect(protocol.steps.map((s) => s.step)).toEqual(
      protocol.steps.map((_, index) => index + 1),
    );
  });

  it.each(Object.values(PROTOCOLS))('$id waits at least 24 hours per step', (protocol) => {
    for (const step of protocol.steps) {
      expect(step.minHoursBeforeAdvance).toBeGreaterThanOrEqual(
        thresholds.MIN_HOURS_BETWEEN_STEPS.value,
      );
    }
  });

  it('caps relative rest at 48 hours in both protocols', () => {
    expect(stepOf(RETURN_TO_LEARN, 1).maxHoursAtStep).toBe(48);
    expect(stepOf(RETURN_TO_SPORT, 1).maxHoursAtStep).toBe(48);
  });
});

describe('the clearance asymmetry', () => {
  it('never requires medical clearance to return to school', () => {
    for (const step of RETURN_TO_LEARN.steps) {
      expect(step.requiresMedicalClearance).toBe(false);
    }
  });

  it('requires medical clearance from sport step 4 onward, and not before', () => {
    for (const step of RETURN_TO_SPORT.steps) {
      expect(step.requiresMedicalClearance).toBe(step.step >= 4);
    }
  });

  it('gates sport step 4 on full return to school as well as clearance', () => {
    const prerequisites = stepOf(RETURN_TO_SPORT, 4).additionalPrerequisites.join(' ');
    expect(prerequisites).toMatch(/full return to school/i);
    expect(prerequisites).toMatch(/clearance/i);
  });
});

describe('exceedance handling differs by protocol, as published', () => {
  it('sport steps 1-3 stop and retry the next day', () => {
    for (const step of [1, 2, 3]) {
      expect(stepOf(RETURN_TO_SPORT, step).onExceedance.kind).toBe('stop-and-retry-next-day');
    }
  });

  it('sport steps 4-6 drop back to step 3', () => {
    for (const step of [4, 5, 6]) {
      expect(stepOf(RETURN_TO_SPORT, step).onExceedance).toMatchObject({
        kind: 'return-to-step',
        step: 3,
      });
    }
  });

  it('learn slows progression rather than withdrawing the student', () => {
    for (const step of [1, 2, 3]) {
      expect(stepOf(RETURN_TO_LEARN, step).onExceedance.kind).toBe('slow-progression');
    }
  });
});

describe('provenance is honest', () => {
  const sourced = Object.entries(thresholds).filter(
    (entry): entry is [string, Sourced<number>] =>
      typeof entry[1] === 'object' && entry[1] !== null && 'provenance' in entry[1],
  );

  it('finds every threshold constant', () => {
    expect(sourced.length).toBeGreaterThan(8);
  });

  it.each(sourced)('%s cites a citation that exists', (_name, value) => {
    expect(CITATIONS).toHaveProperty(value.citation);
  });

  it.each(sourced.filter(([, v]) => v.provenance === 'guideline'))(
    '%s is quoted, because it claims to be from a guideline',
    (_name, value) => {
      expect(value.quote?.length ?? 0).toBeGreaterThan(20);
    },
  );

  it.each(sourced.filter(([, v]) => v.provenance === 'product-default'))(
    '%s explains itself, because it is our choice and not the literature\'s',
    (_name, value) => {
      expect(value.rationale?.length ?? 0).toBeGreaterThan(20);
    },
  );
});

describe('isMildAndBrief', () => {
  it('accepts the boundary: exactly 2 points for exactly 60 minutes', () => {
    expect(isMildAndBrief({ deltaPoints: 2, durationMinutes: 60 })).toBe(true);
  });

  it('rejects a rise above 2 points however short', () => {
    expect(isMildAndBrief({ deltaPoints: 2.5, durationMinutes: 5 })).toBe(false);
  });

  it('rejects a small rise that outlasts an hour', () => {
    expect(isMildAndBrief({ deltaPoints: 1, durationMinutes: 90 })).toBe(false);
  });

  it('uses the published limits rather than its own', () => {
    expect(EXACERBATION_POINT_LIMIT.value).toBe(2);
    expect(EXACERBATION_MINUTE_LIMIT.value).toBe(60);
  });
});

describe('red flags', () => {
  it('carries the full CRT6 list', () => {
    expect(RED_FLAGS).toHaveLength(10);
  });

  it('has unique ids', () => {
    expect(new Set(RED_FLAGS.map((f) => f.id)).size).toBe(RED_FLAGS.length);
  });

  it('attributes every flag to CRT6', () => {
    for (const flag of RED_FLAGS) {
      expect(flag.citation).toBe('crt6-2023');
    }
  });

  it('asks about each flag in plain second person', () => {
    for (const flag of RED_FLAGS) {
      expect(flag.prompt.length).toBeGreaterThan(10);
      expect(flag.prompt).toMatch(/\?$/);
    }
  });
});
