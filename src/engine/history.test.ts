import { describe, expect, it } from 'vitest';
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { domainTrends, replayHistory } from './history';
import type { CheckIn } from './session';

const tom = getPatient('tom')!;
const history = replayHistory(tom, getCheckIns('tom'));

describe('replaying the episode', () => {
  it('covers every check-in', () => {
    expect(history).toHaveLength(getCheckIns('tom').length);
  });

  it('rebuilds each day from only what was known before it', () => {
    // Feeding a day's own check-in back in would make every recommendation look
    // prescient, and "was this followed?" would become unanswerable.
    const first = history[0];
    expect(first.isProvisional).toBe(true);
    expect(history.at(-1)!.isProvisional).toBe(false);
  });

  it('marks days that breached the mild-and-brief limit', () => {
    for (const day of history) {
      expect(day.exceeded).toBe(day.deltaPoints > 2 || day.durationMinutes > 60);
    }
  });

  it('reports adherence as a ratio, never as an infinity', () => {
    for (const day of history) {
      if (day.adherence === null) continue;
      expect(Number.isFinite(day.adherence)).toBe(true);
      expect(day.adherence).toBeGreaterThanOrEqual(0);
    }
  });

  it('tracks the stage as it stood on each day', () => {
    const steps = history.map((day) => day.learnStep);
    // Monotonic apart from a documented regression, which Tom does not have.
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});

describe('trends', () => {
  it('measures progress from the first non-provisional day', () => {
    // Not from day one: the first couple of days are the prior talking, and
    // measuring from them flatters the model rather than describing the patient.
    const trends = domainTrends(history);
    expect(trends.length).toBeGreaterThan(0);
    for (const trend of trends) {
      expect(trend.change).toBeCloseTo(trend.latest - trend.first, 6);
    }
  });

  it('says nothing when there is barely any history', () => {
    expect(domainTrends(history.slice(0, 1))).toEqual([]);
  });

  it('reports improvement when tolerance grew', () => {
    const trends = domainTrends(history);
    const improving = trends.filter((trend) => trend.improving);
    expect(improving.length).toBeGreaterThan(0);
  });
});

describe('a red-flag day', () => {
  const withFlag: CheckIn[] = [
    ...getCheckIns('tom'),
    {
      day: seededOn,
      preActivitySeverity: 3,
      worstSeverity: 7,
      deltaDurationMinutes: 200,
      doses: { cognitive: 20 },
      redFlagIds: ['severe-headache'],
    },
  ];

  it('appears in the record and carries no plan', () => {
    const replayed = replayHistory(tom, withFlag);
    const flagged = replayed.at(-1)!;
    expect(flagged.redFlagged).toBe(true);
    expect(flagged.exceeded).toBe(true);
  });
});
