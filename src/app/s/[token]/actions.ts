'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { AccommodationRole } from '@/data/accommodations';
import { resolveToken } from '@/db/share';
import { getCheckIns, getPatient } from '@/db/store';
import {
  FLAG_REASONS,
  acknowledge,
  clearFlag,
  flagAccommodation,
  unavailableAccommodations,
} from '@/db/responses';
import { composePacket } from '@/engine/packet/compose';
import { buildSession, isoDay } from '@/engine/session';

/**
 * What a recipient is allowed to send back.
 *
 * Holding the token is the authorisation — there are no accounts on this side,
 * which is the whole point of a share link. So everything here re-resolves the
 * token rather than trusting anything the client says, and every input is a
 * fixed choice. An unauthenticated party must not be able to put prose into a
 * clinical document.
 */

const acknowledgeSchema = z.object({ token: z.string().min(1) });

const flagSchema = z.object({
  token: z.string().min(1),
  accommodationId: z.string().min(1),
  reason: z.enum(FLAG_REASONS),
});

const unflagSchema = z.object({
  token: z.string().min(1),
  accommodationId: z.string().min(1),
});

/**
 * Resolves the token and confirms the accommodation is one this packet actually
 * contains. Without the second check, a link holder could file opinions about
 * accommodations belonging to a different audience entirely.
 */
async function packetContext(token: string, accommodationId?: string) {
  const link = resolveToken(token);
  if (!link) throw new Error('This link is no longer active.');

  const patient = getPatient(link.patientId);
  if (!patient) throw new Error('This link is no longer active.');

  if (accommodationId !== undefined) {
    if (link.role === 'clinician') throw new Error('Clinician summaries have no items to flag.');

    const session = buildSession(patient, getCheckIns(patient.id), isoDay(new Date()), {
      unavailableSupports: unavailableAccommodations(patient.id),
    });
    const packet = composePacket(session, link.role as AccommodationRole);
    const inPacket = packet?.items.some((item) => item.id === accommodationId);
    const alreadyFlagged = unavailableAccommodations(patient.id).has(accommodationId);

    if (!inPacket && !alreadyFlagged) throw new Error('That is not part of this document.');
  }

  return link;
}

export async function acknowledgePacket(input: z.infer<typeof acknowledgeSchema>): Promise<void> {
  const { token } = acknowledgeSchema.parse(input);
  const link = await packetContext(token);

  acknowledge(link.patientId, link.id, link.role);
  revalidatePath(`/s/${token}`);
  revalidatePath(`/${link.patientId}/today`);
}

export async function flagItem(input: z.infer<typeof flagSchema>): Promise<void> {
  const { token, accommodationId, reason } = flagSchema.parse(input);
  const link = await packetContext(token, accommodationId);

  flagAccommodation(link.patientId, link.id, link.role, accommodationId, reason);
  revalidatePath(`/s/${token}`);
  revalidatePath(`/${link.patientId}/today`);
}

export async function unflagItem(input: z.infer<typeof unflagSchema>): Promise<void> {
  const { token, accommodationId } = unflagSchema.parse(input);
  const link = await packetContext(token, accommodationId);

  clearFlag(link.id, accommodationId);
  revalidatePath(`/s/${token}`);
  revalidatePath(`/${link.patientId}/today`);
}
