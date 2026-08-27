import { describe, expect, it } from 'vitest';
import { getCheckIns, getPatient, seededOn } from '@/db/store';
import { domainTrends, replayHistory, type DomainTrend, type HistoryDay } from './history';
import type { CheckIn, DoseMap } from './session';

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
      // Rounded, not raw: `change` is the difference between the two figures as
      // the page prints them, so a caption cannot contradict the pair beside it.
      expect(trend.change).toBe(Math.round(trend.latest) - Math.round(trend.first));
      expect(trend.change).toBeCloseTo(trend.latest - trend.first, 0);
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

describe('what the progress figures are captioned', () => {
  /**
   * The caption is generated from the same rounded numbers the page prints, so
   * it cannot contradict the pair beside it. It used to be derived from the raw
   * values, with only two states — which captioned an unchanged domain "down 0"
   * and coloured it as a decline.
   *
   * None of the four demo patients happened to produce that, which is a fact
   * about those seeds rather than about the code. These construct it.
   */
  function trendsFor(first: DoseMap, latest: DoseMap): DomainTrend[] {
    const day = (recommended: DoseMap, index: number): HistoryDay => ({
      day: `2026-01-0${index + 1}`,
      dayIndex: index,
      sportStep: 1,
      learnStep: 2,
      recommended,
      actual: {},
      deltaPoints: 0,
      durationMinutes: 0,
      exceeded: false,
      redFlagged: false,
      isProvisional: false,
      adherence: null,
    });
    return domainTrends([day(first, 0), day(latest, 1)]);
  }

  const cognitiveIn = (trends: DomainTrend[]) =>
    trends.find((trend) => trend.domain === 'cognitive')!;

  it('calls an unchanged domain unchanged, not a decline', () => {
    const trend = cognitiveIn(trendsFor({ cognitive: 60 }, { cognitive: 60 }));
    expect(trend.direction).toBe('unchanged');
    expect(trend.change).toBe(0);
    expect(trend.improving).toBe(false);
  });

  it('does not report movement the printed figures do not show', () => {
    // Both render as 30. A raw difference would caption this "up 0".
    const trend = cognitiveIn(trendsFor({ cognitive: 30.2 }, { cognitive: 30.4 }));
    expect(Math.round(trend.first)).toBe(Math.round(trend.latest));
    expect(trend.direction).toBe('unchanged');
  });

  it('reports movement the printed figures do show', () => {
    // 30.6 renders as 31, so there is a visible change to describe.
    const trend = cognitiveIn(trendsFor({ cognitive: 29.6 }, { cognitive: 30.6 }));
    expect(trend.direction).toBe('up');
    expect(trend.change).toBe(1);
  });

  it.each([
    [120, 60, 'down', -60],
    [60, 120, 'up', 60],
  ] as const)('captions %i to %i as %s', (from, to, direction, change) => {
    const trend = cognitiveIn(trendsFor({ cognitive: from }, { cognitive: to }));
    expect(trend.direction).toBe(direction);
    expect(trend.change).toBe(change);
  });

  it('never captions a direction the two numbers contradict', () => {
    // Not [0, 0]: a domain with nothing at either end is filtered out rather
    // than reported as an unchanged trend, which is the right call — there is
    // no progress to describe about something never recommended.
    for (const [from, to] of [
      [10, 10.4],
      [10.6, 10.4],
      [1, 100],
      [100, 1],
      [0, 45],
    ] as const) {
      const trend = cognitiveIn(trendsFor({ cognitive: from }, { cognitive: to }));
      const shown = Math.round(trend.latest) - Math.round(trend.first);

      expect(trend.change, `${from} -> ${to}`).toBe(shown);
      expect(trend.direction, `${from} -> ${to}`).toBe(
        shown > 0 ? 'up' : shown < 0 ? 'down' : 'unchanged',
      );
    }
  });
});
