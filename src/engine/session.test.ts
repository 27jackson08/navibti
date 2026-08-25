import { describe, expect, it } from 'vitest';
import { isMildAndBrief } from '@/data/guidelines';
import { daysBetween, deltaPointsOf, isoDay, type CheckIn } from './session';

function checkIn(pre: number, worst: number): CheckIn {
  return {
    day: '2026-08-18',
    preActivitySeverity: pre,
    worstSeverity: worst,
    deltaDurationMinutes: 50,
    doses: {},
    redFlagIds: [],
  };
}

describe('deltaPointsOf', () => {
  it('does not manufacture a breach out of floating point', () => {
    // 4.4 - 2.4 is 2.0000000000000004 in binary floating point, which is over
    // the guideline's 2-point limit. It must not be.
    const rise = deltaPointsOf(checkIn(2.4, 4.4));
    expect(rise).toBe(2);
    expect(isMildAndBrief({ deltaPoints: rise, durationMinutes: 50 })).toBe(true);
  });

  it.each([
    [2.4, 4.4],
    [1.1, 3.1],
    [0.3, 2.3],
    [5.7, 7.7],
  ])('treats a rise from %f to %f as exactly two points', (pre, worst) => {
    expect(deltaPointsOf(checkIn(pre, worst))).toBe(2);
  });

  it('still reports a genuine breach', () => {
    expect(deltaPointsOf(checkIn(2.4, 4.7))).toBeCloseTo(2.3, 10);
    expect(isMildAndBrief({ deltaPoints: 2.3, durationMinutes: 50 })).toBe(false);
  });

  it('never returns a negative rise', () => {
    expect(deltaPointsOf(checkIn(5, 3))).toBe(0);
  });
});

describe('date helpers', () => {
  it('counts whole days between ISO dates', () => {
    expect(daysBetween('2026-08-14', '2026-08-25')).toBe(11);
    expect(daysBetween('2026-08-25', '2026-08-25')).toBe(0);
  });

  it('survives a daylight-saving boundary', () => {
    // Both UK and US clock changes fall inside these ranges.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('formats a date as an ISO day', () => {
    expect(isoDay(new Date('2026-08-25T23:30:00Z'))).toBe('2026-08-25');
  });
});
