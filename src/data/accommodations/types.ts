/**
 * The accommodation library.
 *
 * Packets are composed by querying this library — they are never written by a
 * language model. An LLM may rephrase a selected item for tone, behind a
 * validator that rejects any output introducing a recommendation absent from
 * the selected set. The model can rewrite a sentence; it cannot invent a
 * clinical claim.
 *
 * Every item therefore carries its own citation, the protocol steps it applies
 * to, and the tolerance bands it belongs in.
 */

import type { CitationId, LoadDomain, ProtocolId } from '../guidelines';

export type AccommodationRole = 'school' | 'employer' | 'caregiver';

/**
 * Coarse bands rather than raw numbers, because a school office cannot act on
 * "47 minutes of tolerated focused work" but can act on "half days".
 */
export type ToleranceBand = 'very-low' | 'low' | 'moderate' | 'near-full';

export const TOLERANCE_BANDS: readonly ToleranceBand[] = [
  'very-low',
  'low',
  'moderate',
  'near-full',
];

export interface Accommodation {
  readonly id: string;
  readonly role: AccommodationRole;
  readonly domain: LoadDomain;
  /**
   * Addressed to the recipient, not the patient. Imperative and specific enough
   * to act on without interpretation.
   */
  readonly text: string;
  /** One plain line explaining why, so the recipient complies rather than guesses. */
  readonly rationale: string;
  readonly citation: CitationId;
  readonly protocol: ProtocolId;
  readonly minStep: number;
  readonly maxStep: number;
  readonly bands: readonly ToleranceBand[];
  /** Lower sorts first within a section. */
  readonly priority: number;
  /**
   * Hours of attendance below which this item makes no sense.
   *
   * An accommodation about lunch, free periods or first period presupposes a
   * school day with those things in it. Without this gate a letter can ask for
   * a one-hour day and then, four items later, offer a quiet space for lunch —
   * which is how a document that is right in every particular reads as
   * boilerplate nobody checked.
   */
  readonly minAttendanceHours?: number;
  /**
   * Hours of attendance at or above which this item no longer applies.
   *
   * The pair exists so a domain can have a worded variant for the smallest
   * days and a numeric one for the rest. "Cap live meetings at 0 per day and 10
   * minutes each" is not an instruction, and a clinician capping concentration
   * to nothing can produce exactly that.
   */
  readonly maxAttendanceHours?: number;
  /**
   * The load this accommodation is what makes safe.
   *
   * Some adjustments are comfort; others are load-bearing. Forty minutes of
   * class is tolerable *because* there is a break after it, and if the school
   * reports it cannot provide the break, the forty minutes stops being a safe
   * recommendation. `withoutIt` is the multiplier applied to that domain when a
   * recipient has reported this support unavailable.
   *
   * This is what turns a recipient's reply into coordination rather than a
   * comment box: the plan adapts to what the environment can actually deliver.
   * Product defaults, all of them — no guideline quantifies the cost of a
   * missing accommodation.
   */
  /**
   * A name for this accommodation, without its numbers.
   *
   * Required wherever `text` carries a quantity, because the numbers in that
   * sentence belong to the day it was issued. Echoing a declined accommodation
   * back — "you told us these aren't possible" on the recipient's copy, and
   * "reported unavailable" on the patient's plan — re-rendered the template
   * with *today's* figures, so a school that declined a cap of one meeting saw
   * "Cap live meetings at 0 per day" once a clinician had restricted the
   * domain. The record is of which adjustment was declined; the number is
   * noise there, and wrong.
   *
   * Authored rather than derived. Truncating the sentence at its first
   * placeholder yields "Cap live meetings at", which is not a phrase, and this
   * project does not generate accommodation prose.
   */
  readonly shortLabel?: string;

  readonly supportsLoad?: {
    readonly domain: LoadDomain;
    readonly withoutIt: number;
  };
}
