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

  /**
   * Constants whose quote states the value in a different unit.
   *
   * Each conversion is written out rather than waved at, because it is a step
   * of judgement sitting between the published sentence and the number the
   * engine uses — and "more than one week" in particular could be read as 7 or
   * as 8. It is read as 7 here, and the comparison is strictly greater than, so
   * the warning fires on day 8: more than a week, exactly as published.
   */
  const CONVERTED: Record<string, { readonly stated: string; readonly why: string }> = {
    EXACERBATION_MINUTE_LIMIT: {
      stated: '1 hour',
      why: '60 minutes is one hour',
    },
    MAX_SCHOOL_ABSENCE_DAYS: {
      stated: 'one week',
      why: '7 days is one week; the comparison is > so the warning starts on day 8',
    },
  };

  const NUMBER_WORDS: Record<number, string> = {
    1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven',
    8: 'eight', 9: 'nine', 10: 'ten', 24: 'twenty-four', 48: 'forty-eight',
  };

  it.each(
    sourced.filter(([, v]) => v.provenance === 'guideline' && typeof v.value === 'number'),
  )('%s appears in the sentence it claims to come from', (name, value) => {
    // A quote that exists proves nothing on its own. The damaging error in a
    // transcription layer is a correct quote beside the wrong number — a value
    // edited without its source, or a source pasted under the wrong constant —
    // and every check here passed while that was possible.
    const quote = (value.quote ?? '').toLowerCase();
    const word = NUMBER_WORDS[value.value];

    if (quote.includes(String(value.value)) || (word !== undefined && quote.includes(word))) {
      return;
    }

    const converted = CONVERTED[name];
    expect(
      converted,
      `${name} = ${value.value} does not appear in its own quote, and no conversion is recorded`,
    ).toBeDefined();
    expect(quote, `${name}: quote does not say "${converted.stated}"`).toContain(
      converted.stated.toLowerCase(),
    );
    expect(converted.why.length).toBeGreaterThan(10);
  });

  it('records no conversion for a constant that does not need one', () => {
    // A stale entry here would let a genuine mismatch through under cover of an
    // explanation that no longer applies.
    for (const name of Object.keys(CONVERTED)) {
      const entry = sourced.find(([key]) => key === name);
      expect(entry, `${name} is recorded as converted but is not a sourced constant`).toBeDefined();

      const quote = (entry![1].quote ?? '').toLowerCase();
      expect(
        quote.includes(String(entry![1].value)),
        `${name} states its value directly; the conversion entry is stale`,
      ).toBe(false);
    }
  });

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
