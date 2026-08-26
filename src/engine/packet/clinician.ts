/**
 * The clinician summary.
 *
 * Unlike the other packets this one is not composed from the accommodation
 * library, because a clinician does not need instructions — they need the
 * record, compactly, in the order they would ask for it. It is built to be read
 * in about ninety seconds during an appointment that is already too short.
 *
 * Two things it deliberately includes that the patient-facing screens do not:
 * how closely the plan was actually followed, and how confident the model was
 * on the day each recommendation was acted on. A clinician looking at a stalled
 * recovery needs to be able to tell "the plan was wrong" apart from "the plan
 * was not followed", and no amount of trend line answers that.
 */

import { LOAD_DOMAINS, isMildAndBrief, type LoadDomain } from '@/data/guidelines';
import {
  buildSession,
  deltaPointsOf,
  type CheckIn,
  type Patient,
  type Session,
  type SessionOptions,
} from '@/engine/session';
import type { UnmetSupport } from './environment';
import { isPersonalized } from '@/engine/tolerance/posterior';
import { normalizeDose } from '@/engine/tolerance/units';

export interface TrajectoryPoint {
  readonly day: string;
  readonly dayIndex: number;
  readonly preActivitySeverity: number;
  readonly worstSeverity: number;
  readonly deltaPoints: number;
  readonly durationMinutes: number;
  /** Breached the guideline's mild-and-brief limit. */
  readonly exceeded: boolean;
  readonly redFlagged: boolean;
}

export interface AdherencePoint {
  readonly day: string;
  /** Actual load as a fraction of what was recommended, averaged across domains. */
  readonly ratio: number;
  readonly overshot: boolean;
}

export interface ToleranceLine {
  readonly domain: LoadDomain;
  readonly dose: number;
  readonly unit: string;
  readonly band: string;
  readonly binding: string;
}

export interface ClinicianSummary {
  readonly patientName: string;
  readonly isMinor: boolean;
  readonly injuryDate: string;
  readonly daysSinceInjury: number;
  readonly generatedOn: string;
  readonly learn: { readonly step: number; readonly total: number; readonly title: string };
  readonly sport: { readonly step: number; readonly total: number; readonly title: string } | null;
  readonly trajectory: readonly TrajectoryPoint[];
  readonly flareDays: readonly TrajectoryPoint[];
  readonly redFlagDays: readonly TrajectoryPoint[];
  readonly adherence: readonly AdherencePoint[];
  readonly currentTolerance: readonly ToleranceLine[];
  readonly observations: number;
  readonly isPersonalized: boolean;
  readonly escalations: readonly string[];
  readonly openQuestions: readonly string[];
  /**
   * Support the school or workplace has reported it cannot provide.
   *
   * A clinician looking at a plateau needs to be able to tell "the plan is
   * wrong" from "the plan was never actually available", and nothing in the
   * symptom record distinguishes those.
   */
  readonly unmetSupports: readonly UnmetSupport[];
}

export function clinicianSummary(
  patient: Patient,
  checkIns: readonly CheckIn[],
  today: string,
  options: SessionOptions = {},
): ClinicianSummary {
  const session = buildSession(patient, checkIns, today, options);
  const ordered = session.checkIns;

  const trajectory: TrajectoryPoint[] = ordered.map((checkIn, index) => {
    const deltaPoints = deltaPointsOf(checkIn);
    return {
      day: checkIn.day,
      dayIndex: index,
      preActivitySeverity: checkIn.preActivitySeverity,
      worstSeverity: checkIn.worstSeverity,
      deltaPoints,
      durationMinutes: checkIn.deltaDurationMinutes,
      exceeded: !isMildAndBrief({
        deltaPoints,
        durationMinutes: checkIn.deltaDurationMinutes,
      }),
      redFlagged: checkIn.redFlagIds.length > 0,
    };
  });

  return {
    patientName: patient.displayName,
    isMinor: patient.isMinor,
    injuryDate: patient.injuryDate,
    daysSinceInjury: session.daysSinceInjury,
    generatedOn: today,
    learn: describeStage(session, 'learn'),
    sport: patient.protocol === 'return-to-sport' ? describeStage(session, 'sport') : null,
    trajectory,
    flareDays: trajectory.filter((point) => point.exceeded && !point.redFlagged),
    redFlagDays: trajectory.filter((point) => point.redFlagged),
    adherence: computeAdherence(patient, ordered),
    currentTolerance:
      session.plan?.recommendations.map((item) => ({
        domain: item.domain,
        dose: item.dose,
        unit: item.unit,
        band: item.band,
        binding: item.binding,
      })) ?? [],
    observations: session.posterior.observationCount,
    isPersonalized: isPersonalized(session.posterior),
    escalations: session.escalations,
    openQuestions: openQuestions(session),
    unmetSupports: session.unmetSupports,
  };
}

function describeStage(session: Session, which: 'learn' | 'sport') {
  const stage = which === 'learn' ? session.learnStage : session.stage;
  const protocol = which === 'learn' ? 'return-to-learn' : 'return-to-sport';
  const steps = protocol === 'return-to-learn' ? 4 : 6;
  return {
    step: stage.step,
    total: steps,
    title: `Step ${stage.step} of ${steps}`,
  };
}

/**
 * How closely each day's actual load matched what was recommended for it.
 *
 * Replays the plan as it stood on each day rather than comparing against
 * today's, because a clinician asking "was this followed?" means followed at
 * the time, not measured against a recommendation that did not exist yet.
 */
function computeAdherence(patient: Patient, checkIns: readonly CheckIn[]): AdherencePoint[] {
  const points: AdherencePoint[] = [];

  for (let index = 0; index < checkIns.length; index += 1) {
    const checkIn = checkIns[index];
    if (checkIn.redFlagIds.length > 0) continue;

    const priorSession = buildSession(patient, checkIns.slice(0, index), checkIn.day);
    const plan = priorSession.plan;
    if (!plan) continue;

    const ratios: number[] = [];
    for (const domain of LOAD_DOMAINS) {
      if (domain === 'sleepFatigue') continue;
      const recommended = plan.recommendations.find((item) => item.domain === domain)?.dose ?? 0;
      const actual = checkIn.doses[domain];
      if (actual === undefined) continue;

      const normalizedRecommended = normalizeDose(domain, recommended);
      // A near-zero recommendation makes the ratio meaningless rather than
      // infinite, so it is left out rather than reported as a huge overshoot.
      if (normalizedRecommended < 0.02) continue;
      ratios.push(normalizeDose(domain, actual) / normalizedRecommended);
    }

    if (ratios.length === 0) continue;
    const ratio = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    points.push({ day: checkIn.day, ratio, overshot: ratio > 1.25 });
  }

  return points;
}

/**
 * What a clinician might reasonably want to ask about, phrased as questions
 * rather than conclusions. NaviTBI has no business telling a clinician what is
 * going on; it can point at where the record is unusual.
 */
function openQuestions(session: Session): string[] {
  const questions: string[] = [];

  if (!isPersonalized(session.posterior)) {
    questions.push(
      'Fewer than three check-ins so far, so the estimates below are close to the population ' +
        'prior rather than personal to this patient.',
    );
  }

  if (session.plan?.floorOverrodeModel) {
    questions.push(
      'The model would currently recommend less activity than the guideline minimum. The ' +
        'minimum is being shown instead — worth asking whether the reported loads match what is ' +
        'actually happening.',
    );
  }

  if (session.attribution?.outcome === 'confounded') {
    questions.push(
      'Two kinds of load have moved together on nearly every day, so their effects cannot be ' +
        'separated from this record alone.',
    );
  }

  if (session.unmetSupports.length > 0) {
    const domains = [...new Set(session.unmetSupports.map((item) => item.domain))].length;
    questions.push(
      `The ${session.unmetSupports[0].role} has reported ${session.unmetSupports.length} ` +
        `accommodation${session.unmetSupports.length === 1 ? '' : 's'} they cannot provide, ` +
        `affecting ${domains} load domain${domains === 1 ? '' : 's'}. Today's limits have been ` +
        'lowered accordingly — a plateau here may reflect what was available rather than what ' +
        'was tolerated.',
    );
  }

  if (session.underExposure.length > 0) {
    questions.push(
      'Logged activity has sat well below estimated tolerance for several days with stable ' +
        'symptoms, which may indicate avoidance rather than intolerance.',
    );
  }

  return questions;
}
