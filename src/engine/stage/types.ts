/**
 * Stage machine vocabulary.
 *
 * This module decides what a patient is *permitted* to do. It is deterministic
 * and derives entirely from the transcribed protocols — no personalization, no
 * model, no learned parameters. The tolerance model decides *how much* inside
 * whatever this permits, and can only ever narrow it.
 *
 * Two things this machine will never do: issue medical clearance, and advance a
 * patient into a step that requires clearance it has not been shown.
 */

import type { CitationId, Exacerbation, ProtocolId } from '@/data/guidelines';

/**
 * Clearance is always recorded from something that happened outside NaviTBI —
 * a clinician's note, a form, a conversation. `recordedBy` is who told us, not
 * who authorised it, and we never infer it.
 */
export interface MedicalClearance {
  readonly recordedBy: string;
  readonly recordedAt: Date;
  /** Highest protocol step this clearance covers. */
  readonly coversUpToStep: number;
}

export interface StageState {
  readonly protocol: ProtocolId;
  readonly step: number;
  readonly enteredAt: Date;
  readonly clearance?: MedicalClearance;
  /**
   * Required alongside clearance to enter Return-to-Sport step 4. Tracked
   * separately because it is a different gate with a different owner: the
   * school, not the clinician.
   */
  readonly fullReturnToSchool?: boolean;
}

export interface DayObservation {
  readonly at: Date;
  readonly exacerbation: Exacerbation;
  readonly redFlagIds: readonly string[];
  /**
   * Whether exertion produced no concussion-related symptoms. Only consulted
   * when leaving Return-to-Sport step 3, where the guideline requires full
   * resolution of symptoms with exertion before at-risk activity.
   */
  readonly symptomFreeWithExertion?: boolean;
}

interface DecisionBase {
  readonly reason: string;
  readonly citation: CitationId;
}

/** Red flags. No plan, no dose, no packet — one screen and an instruction. */
export interface HaltDecision extends DecisionBase {
  readonly kind: 'halt';
  readonly redFlagIds: readonly string[];
  readonly instruction: string;
}

export interface HoldDecision extends DecisionBase {
  readonly kind: 'hold';
  readonly step: number;
}

export interface AdvanceDecision extends DecisionBase {
  readonly kind: 'advance';
  readonly from: number;
  readonly to: number;
  /**
   * True when the advance is driven by the relative-rest ceiling rather than by
   * demonstrated tolerance. The step changes; the dose should stay small.
   */
  readonly cautious: boolean;
}

/** A gate we cannot open. The app displays the requirement and stops. */
export interface BlockedDecision extends DecisionBase {
  readonly kind: 'blocked';
  readonly step: number;
  readonly blockedFrom: number;
  readonly requirements: readonly string[];
}

export interface RegressDecision extends DecisionBase {
  readonly kind: 'regress';
  readonly from: number;
  readonly to: number;
}

export type StageDecision =
  | HaltDecision
  | HoldDecision
  | AdvanceDecision
  | BlockedDecision
  | RegressDecision;
