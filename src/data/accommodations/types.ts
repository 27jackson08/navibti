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
}
