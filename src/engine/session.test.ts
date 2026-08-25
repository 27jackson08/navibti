import { describe, expect, it } from 'vitest';
import { isMildAndBrief } from '@/data/guidelines';
import { buildSession, daysBetween, deltaPointsOf, isoDay, type CheckIn } from './session';

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

describe('clinician escalation', () => {
  const patient = {
    id: 'p',
    displayName: 'Sam',
    isMinor: false,
    injuryDate: '2026-08-01',
    protocol: 'return-to-learn' as const,
    roles: ['employer' as const],
  };

  function symptomaticOn(day: string): CheckIn {
    return {
      day,
      preActivitySeverity: 2,
      worstSeverity: 3.5,
      deltaDurationMinutes: 30,
      doses: { cognitive: 60, visualVestibular: 40, physical: 10, emotionalAutonomic: 40 },
      redFlagIds: [],
    };
  }

  const messagesOn = (today: string, day: string) =>
    buildSession(patient, [symptomaticOn(day)], today).escalations.join(' ');

  it('says nothing in the first fortnight', () => {
    expect(messagesOn('2026-08-08', '2026-08-08')).not.toMatch(/clinician|medical advice/i);
  });

  it('suggests a conversation at two weeks, without alarming', () => {
    const message = messagesOn('2026-08-16', '2026-08-16');
    expect(message).toMatch(/reasonable point to mention it/i);
    // Recovery genuinely often takes this long, and saying so is the difference
    // between a useful nudge and a frightening one.
    expect(message).toMatch(/not a warning sign on its own/i);
  });

  it('quotes the guideline at four weeks', () => {
    const message = messagesOn('2026-09-01', '2026-09-01');
    expect(message).toMatch(/beyond 28 days/);
    expect(message).toMatch(/referral/i);
  });

  it('does not escalate for someone whose symptoms have settled', () => {
    const settled: CheckIn = { ...symptomaticOn('2026-09-01'), worstSeverity: 2 };
    expect(buildSession(patient, [settled], '2026-09-01').escalations.join(' ')).not.toMatch(
      /medical advice/i,
    );
  });

  it('uses the same window whatever the patient’s age', () => {
    // The previous age split gave adults a 14-day window and children 28, which
    // was not grounded in anything. Amsterdam applies 28 days uniformly.
    const child = { ...patient, isMinor: true };
    expect(buildSession(child, [symptomaticOn('2026-09-01')], '2026-09-01').escalations).toEqual(
      buildSession(patient, [symptomaticOn('2026-09-01')], '2026-09-01').escalations,
    );
  });
});
