/**
 * The whole episode, replayed day by day.
 *
 * Each day is rebuilt from only the check-ins that existed at the time, so what
 * this returns is what NaviTBI actually recommended on that date — not what it
 * would recommend now with hindsight. That distinction is the entire value of
 * the view: "was this followed?" and "was this improving?" both mean *at the
 * time*, and a smoothed retrospective line answers neither.
 */

import { LOAD_DOMAINS, isMildAndBrief, type LoadDomain } from '@/data/guidelines';
import {
  buildSession,
  deltaPointsOf,
  type CheckIn,
  type DoseMap,
  type Patient,
  type SessionOptions,
} from '@/engine/session';
import { normalizeDose } from '@/engine/tolerance/units';

export interface HistoryDay {
  readonly day: string;
  readonly dayIndex: number;
  readonly sportStep: number;
  readonly learnStep: number;
  readonly recommended: DoseMap;
  readonly actual: DoseMap;
  readonly deltaPoints: number;
  readonly durationMinutes: number;
  readonly exceeded: boolean;
  readonly redFlagged: boolean;
  readonly isProvisional: boolean;
  /** Actual over recommended, averaged across logged domains. Null when there is no plan. */
  readonly adherence: number | null;
}

export function replayHistory(
  patient: Patient,
  checkIns: readonly CheckIn[],
  options: SessionOptions = {},
): HistoryDay[] {
  const ordered = [...checkIns].sort((a, b) => a.day.localeCompare(b.day));

  return ordered.map((checkIn, index) => {
    // Only what was known before this day. Feeding the day's own check-in back
    // in would make every recommendation look prescient.
    const before = buildSession(patient, ordered.slice(0, index), checkIn.day, options);
    const plan = before.plan;

    const recommended: DoseMap = {};
    if (plan) {
      for (const item of plan.recommendations) recommended[item.domain] = item.dose;
    }

    return {
      day: checkIn.day,
      dayIndex: index,
      sportStep: before.stage.step,
      learnStep: before.learnStage.step,
      recommended,
      actual: checkIn.doses,
      deltaPoints: deltaPointsOf(checkIn),
      durationMinutes: checkIn.deltaDurationMinutes,
      exceeded: !isMildAndBrief({
        deltaPoints: deltaPointsOf(checkIn),
        durationMinutes: checkIn.deltaDurationMinutes,
      }),
      redFlagged: checkIn.redFlagIds.length > 0,
      isProvisional: plan?.isProvisional ?? true,
      adherence: plan ? adherenceRatio(recommended, checkIn.doses) : null,
    };
  });
}

/**
 * Actual over recommended, averaged over domains that were both planned and
 * logged. A near-zero recommendation is left out rather than reported as an
 * enormous overshoot — the ratio stops being meaningful there.
 */
function adherenceRatio(recommended: DoseMap, actual: DoseMap): number | null {
  const ratios: number[] = [];

  for (const domain of LOAD_DOMAINS) {
    if (domain === 'sleepFatigue') continue;

    const planned = recommended[domain];
    const did = actual[domain];
    if (planned === undefined || did === undefined) continue;
    if (normalizeDose(domain, planned) < 0.02) continue;

    ratios.push(normalizeDose(domain, did) / normalizeDose(domain, planned));
  }

  if (ratios.length === 0) return null;
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
}

export interface DomainTrend {
  readonly domain: LoadDomain;
  readonly first: number;
  readonly latest: number;
  readonly change: number;
  readonly improving: boolean;
}

/**
 * How much more a patient can manage now than when they started.
 *
 * Compared against the first day the estimate was no longer provisional, not
 * against day one — the first couple of days are the prior talking, and
 * measuring progress from them would flatter the model rather than describe the
 * patient.
 */
export function domainTrends(history: readonly HistoryDay[]): DomainTrend[] {
  const settled = history.filter((day) => !day.isProvisional);
  if (settled.length < 2) return [];

  const first = settled[0];
  const latest = settled.at(-1)!;

  return LOAD_DOMAINS.filter((domain) => domain !== 'sleepFatigue')
    .map((domain) => {
      const from = first.recommended[domain] ?? 0;
      const to = latest.recommended[domain] ?? 0;
      return { domain, first: from, latest: to, change: to - from, improving: to > from };
    })
    .filter((trend) => trend.first > 0 || trend.latest > 0);
}
