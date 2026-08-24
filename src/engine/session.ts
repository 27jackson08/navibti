/**
 * The composition root: everything the app shows, derived from one log.
 *
 * There is no stored posterior, no stored stage, no stored plan. All of it is
 * replayed from the check-in log on demand. That is affordable at this scale
 * (a concussion episode is tens of days, not millions of rows) and it buys
 * three things worth more than the microseconds it costs: the displayed state
 * can never drift from the record it claims to summarise, a clinician can be
 * shown exactly why the app said what it said on any past day, and the demo
 * resets by deleting rows.
 */

import {
  CLINICIAN_PROMPT_DAYS_ADULT,
  FULL_DAY_COGNITIVE_FRACTION,
  CLINICIAN_PROMPT_DAYS_CHILD,
  RED_FLAG_INSTRUCTION,
  type LoadDomain,
  type ProtocolId,
} from '@/data/guidelines';
import { attribute, type Attribution } from '@/engine/attribution/attribution';
import { applyDecision, evaluate, schoolAbsenceWarning } from '@/engine/stage/machine';
import type { MedicalClearance, StageDecision, StageState } from '@/engine/stage/types';
import { observe, priorPosterior, type Posterior } from '@/engine/tolerance/posterior';
import {
  detectUnderExposure,
  floorDayRisk,
  planDay,
  type DayPlan,
  type UnderExposure,
} from '@/engine/tolerance/threshold';
import { TOLERANCE_EXCEEDANCE_QUANTILE } from '@/data/guidelines';
import { normalizeDose } from '@/engine/tolerance/units';

export type DoseMap = Partial<Record<LoadDomain, number>>;

export interface Patient {
  readonly id: string;
  readonly displayName: string;
  readonly isMinor: boolean;
  /** ISO date, YYYY-MM-DD. */
  readonly injuryDate: string;
  readonly protocol: ProtocolId;
  readonly clearance?: MedicalClearance;
  readonly fullReturnToSchool?: boolean;
  /** Which packets this patient's situation calls for. */
  readonly roles: readonly ('school' | 'employer' | 'caregiver')[];
}

export interface CheckIn {
  /** ISO date, YYYY-MM-DD. */
  readonly day: string;
  readonly preActivitySeverity: number;
  readonly worstSeverity: number;
  readonly deltaDurationMinutes: number;
  readonly doses: DoseMap;
  readonly redFlagIds: readonly string[];
  readonly note?: string;
}

export function deltaPointsOf(checkIn: CheckIn): number {
  return Math.max(0, checkIn.worstSeverity - checkIn.preActivitySeverity);
}

export interface Session {
  readonly patient: Patient;
  readonly checkIns: readonly CheckIn[];
  readonly today: string;
  readonly hasCheckedInToday: boolean;
  readonly daysSinceInjury: number;
  readonly posterior: Posterior;
  /** The ladder governing physical progression — the patient's primary protocol. */
  readonly stage: StageState;
  /**
   * The Return-to-Learn ladder, replayed in parallel. For a patient whose
   * primary protocol is Return-to-Learn these are the same object.
   */
  readonly learnStage: StageState;
  readonly lastDecision: StageDecision | null;
  /** Non-null only when the most recent check-in reported a red flag. */
  readonly redFlag: { readonly ids: readonly string[]; readonly instruction: string } | null;
  readonly plan: DayPlan | null;
  readonly attribution: Attribution | null;
  readonly underExposure: readonly UnderExposure[];
  readonly escalations: readonly string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function buildSession(
  patient: Patient,
  checkIns: readonly CheckIn[],
  today: string,
): Session {
  const ordered = [...checkIns].sort((a, b) => a.day.localeCompare(b.day));
  const latest = ordered.at(-1) ?? null;

  const injuredAt = new Date(`${patient.injuryDate}T08:00:00Z`);
  const onSport = patient.protocol === 'return-to-sport';

  let posterior = priorPosterior();
  let learnStage: StageState = { protocol: 'return-to-learn', step: 1, enteredAt: injuredAt };
  let sportStage: StageState = {
    protocol: 'return-to-sport',
    step: 1,
    enteredAt: injuredAt,
    clearance: patient.clearance,
    fullReturnToSchool: patient.fullReturnToSchool,
  };
  let lastDecision: StageDecision | null = null;
  const floorRiskHistory: boolean[] = [];

  for (const checkIn of ordered) {
    const delta = deltaPointsOf(checkIn);
    const at = new Date(`${checkIn.day}T20:00:00Z`);
    const exacerbation = { deltaPoints: delta, durationMinutes: checkIn.deltaDurationMinutes };

    // A red-flag day contributes no evidence and produces no plan. It is a
    // record that something happened, not a data point about tolerance.
    if (checkIn.redFlagIds.length > 0) {
      lastDecision = evaluate(onSport ? sportStage : learnStage, {
        at,
        exacerbation,
        redFlagIds: checkIn.redFlagIds,
      });
      continue;
    }

    posterior = observe(posterior, { doses: checkIn.doses, deltaPoints: delta });

    floorRiskHistory.push(
      floorDayRisk({
        posterior,
        protocol: onSport ? sportStage.protocol : learnStage.protocol,
        step: onSport ? sportStage.step : learnStage.step,
        learnStep: learnStage.step,
        context: checkIn.doses,
        yesterday: checkIn.doses,
      }) > TOLERANCE_EXCEEDANCE_QUANTILE.value,
    );

    const learnDecision = evaluate(learnStage, {
      at,
      exacerbation,
      redFlagIds: [],
      demonstratedFullDay:
        normalizeDose('cognitive', checkIn.doses.cognitive ?? 0) >=
        FULL_DAY_COGNITIVE_FRACTION.value,
    });
    learnStage = applyDecision(learnStage, learnDecision, at);

    if (onSport) {
      // Evaluated after the learn ladder, because the step-4 gate depends on
      // whether the patient is actually back at school full time. Deriving it
      // beats carrying a flag someone has to remember to set.
      sportStage = {
        ...sportStage,
        fullReturnToSchool: patient.fullReturnToSchool ?? learnStage.step >= 4,
      };
      const sportDecision = evaluate(sportStage, {
        at,
        exacerbation,
        redFlagIds: [],
        symptomFreeWithExertion: delta < 0.5,
      });
      sportStage = applyDecision(sportStage, sportDecision, at);
      lastDecision = sportDecision;
    } else {
      lastDecision = learnDecision;
    }
  }

  const stage = onSport ? sportStage : learnStage;

  const redFlagged = latest !== null && latest.redFlagIds.length > 0;
  const context: DoseMap = latest && !redFlagged ? latest.doses : {};

  const plan = redFlagged
    ? null
    : planDay({
        posterior,
        protocol: stage.protocol,
        step: stage.step,
        learnStep: learnStage.step,
        context,
        yesterday: context,
      });

  const attribution =
    latest && !redFlagged
      ? attribute({
          posterior,
          doses: latest.doses,
          observed: {
            deltaPoints: deltaPointsOf(latest),
            durationMinutes: latest.deltaDurationMinutes,
          },
        })
      : null;

  const tolerances = plan
    ? (Object.fromEntries(
        plan.recommendations.map((item) => [item.domain, item.modelTolerance]),
      ) as Record<LoadDomain, number>)
    : null;

  return {
    patient,
    checkIns: ordered,
    today,
    hasCheckedInToday: latest?.day === today,
    daysSinceInjury: daysBetween(patient.injuryDate, today),
    posterior,
    stage,
    learnStage,
    lastDecision,
    redFlag: redFlagged
      ? { ids: latest.redFlagIds, instruction: RED_FLAG_INSTRUCTION }
      : null,
    plan,
    attribution,
    underExposure: tolerances
      ? detectUnderExposure(
          ordered
            .filter((checkIn) => checkIn.redFlagIds.length === 0)
            .map((checkIn) => ({ doses: checkIn.doses, deltaPoints: deltaPointsOf(checkIn) })),
          tolerances,
        )
      : [],
    escalations: collectEscalations(patient, ordered, floorRiskHistory, today),
  };
}

/**
 * How many days in a row the model must judge a guideline-minimum day risky
 * before we say so out loud.
 *
 * One day of disagreement between the model and the guideline floor is not a
 * clinical event, it is noise — and a banner that fires on four days in ten
 * teaches people to scroll past it. Requiring persistence turns the same signal
 * into something worth reading.
 */
const FLOOR_RISK_DAYS_BEFORE_ESCALATING = 3;

function collectEscalations(
  patient: Patient,
  checkIns: readonly CheckIn[],
  floorRiskHistory: readonly boolean[],
  today: string,
): string[] {
  const escalations: string[] = [];
  const elapsed = daysBetween(patient.injuryDate, today);

  const window = patient.isMinor
    ? CLINICIAN_PROMPT_DAYS_CHILD.value
    : CLINICIAN_PROMPT_DAYS_ADULT.value;

  const stillSymptomatic = checkIns.at(-1) && deltaPointsOf(checkIns.at(-1)!) > 0;
  if (elapsed >= window && stillSymptomatic) {
    escalations.push(
      `It has been ${elapsed} days since the injury and symptoms are still rising with ` +
        'activity. This is a good point to check in with a clinician.',
    );
  }

  const recentFloorRisk = floorRiskHistory.slice(-FLOOR_RISK_DAYS_BEFORE_ESCALATING);
  const persistently =
    recentFloorRisk.length === FLOOR_RISK_DAYS_BEFORE_ESCALATING &&
    recentFloorRisk.every(Boolean);

  if (persistently) {
    escalations.push(
      `For ${FLOOR_RISK_DAYS_BEFORE_ESCALATING} days running, even a very light day looks ` +
        'likely to raise your symptoms. That is worth talking through with a clinician rather ' +
        'than adjusting on your own.',
    );
  }

  const absence = schoolAbsenceWarning(consecutiveAbsentDays(checkIns));
  if (absence) escalations.push(absence);

  return escalations;
}

/** Days in a row with essentially no cognitive load logged. */
function consecutiveAbsentDays(checkIns: readonly CheckIn[]): number {
  let count = 0;
  for (let i = checkIns.length - 1; i >= 0; i -= 1) {
    if (normalizeDose('cognitive', checkIns[i].doses.cognitive ?? 0) > 0.05) break;
    count += 1;
  }
  return count;
}
