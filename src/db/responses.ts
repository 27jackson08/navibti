/**
 * What the people receiving a packet send back.
 *
 * Until now a share link was a broadcast: a school read the accommodations and
 * NaviTBI never learned whether they arrived, were acted on, or were impossible.
 * That made "coordinator" the aspirational half of the pitch.
 *
 * Two things can come back, and both are deliberately narrow. A recipient may
 * acknowledge the document, and may report that a specific accommodation is not
 * something they can provide. They cannot write prose into a clinical document,
 * and they cannot raise a limit — only report that they are unable to meet one.
 */

import { randomBytes } from 'node:crypto';
import type { ShareRole } from './share';

export const FLAG_REASONS = [
  'no-space-available',
  'timetable-cannot-change',
  'needs-approval',
  'not-enough-staff',
  'already-in-place',
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  'no-space-available': 'We do not have a suitable space',
  'timetable-cannot-change': 'The timetable cannot change this term',
  'needs-approval': 'This needs approval we do not have yet',
  'not-enough-staff': 'We do not have the staff to cover it',
  'already-in-place': 'Already in place — no change needed',
};

/**
 * A reason that reports something is *already handled* is not an unmet need.
 * Keeping the two apart matters: one should lower the plan, the other should not.
 */
export function isUnmet(reason: FlagReason): boolean {
  return reason !== 'already-in-place';
}

export interface RecipientResponse {
  readonly id: string;
  readonly patientId: string;
  readonly linkId: string;
  readonly role: ShareRole;
  readonly accommodationId: string | null;
  readonly reason: FlagReason | null;
  readonly at: string;
}

interface ResponseStore {
  readonly responses: RecipientResponse[];
}

const globalStore = globalThis as typeof globalThis & { __navitbiResponses?: ResponseStore };
const store: ResponseStore = (globalStore.__navitbiResponses ??= { responses: [] });

export function acknowledge(patientId: string, linkId: string, role: ShareRole): void {
  store.responses.push({
    id: randomBytes(8).toString('hex'),
    patientId,
    linkId,
    role,
    accommodationId: null,
    reason: null,
    at: new Date().toISOString(),
  });
}

export function flagAccommodation(
  patientId: string,
  linkId: string,
  role: ShareRole,
  accommodationId: string,
  reason: FlagReason,
): void {
  // One standing answer per accommodation per link — a recipient changing their
  // mind should replace what they said, not stack another opinion on top of it.
  const existing = store.responses.findIndex(
    (entry) => entry.linkId === linkId && entry.accommodationId === accommodationId,
  );
  const response: RecipientResponse = {
    id: randomBytes(8).toString('hex'),
    patientId,
    linkId,
    role,
    accommodationId,
    reason,
    at: new Date().toISOString(),
  };

  if (existing >= 0) store.responses[existing] = response;
  else store.responses.push(response);
}

export function clearFlag(linkId: string, accommodationId: string): void {
  const index = store.responses.findIndex(
    (entry) => entry.linkId === linkId && entry.accommodationId === accommodationId,
  );
  if (index >= 0) store.responses.splice(index, 1);
}

export function responsesFor(patientId: string): RecipientResponse[] {
  return store.responses
    .filter((entry) => entry.patientId === patientId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function responsesForLink(linkId: string): RecipientResponse[] {
  return store.responses.filter((entry) => entry.linkId === linkId);
}

/** Accommodations a recipient has said they cannot provide. */
export function unavailableAccommodations(patientId: string): Set<string> {
  return new Set(
    responsesFor(patientId)
      .filter((entry) => entry.accommodationId !== null && entry.reason !== null)
      .filter((entry) => isUnmet(entry.reason!))
      .map((entry) => entry.accommodationId!),
  );
}

export function acknowledgementsFor(patientId: string): RecipientResponse[] {
  return responsesFor(patientId).filter((entry) => entry.accommodationId === null);
}
