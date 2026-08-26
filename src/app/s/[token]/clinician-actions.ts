'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { LOAD_DOMAINS } from '@/data/guidelines';
import { resolveToken } from '@/db/share';
import { getPatient, recordClinicianDecision } from '@/db/store';

/**
 * Recording what a clinician has decided.
 *
 * Reachable only from a clinician share link. A patient cannot record clearance
 * on their own record — "my doctor cleared me" is exactly the unverified claim
 * that must not be able to unlock contact sport, and the person who made the
 * decision is the one who should be entering it.
 *
 * NaviTBI still issues nothing. It stores a decision, attributes it to a named
 * person, and stamps it.
 */

const decisionSchema = z.object({
  token: z.string().min(1),
  recordedBy: z.string().min(2).max(80),
  coversUpToStep: z.number().int().min(1).max(6),
});

const capsSchema = z.object({
  token: z.string().min(1),
  caps: z.record(z.string(), z.number().min(0).max(1440)),
});

function clinicianLink(token: string) {
  const link = resolveToken(token);
  if (!link) throw new Error('This link is no longer active.');
  if (link.role !== 'clinician') {
    throw new Error('Only a clinician link can record a clinical decision.');
  }
  if (!getPatient(link.patientId)) throw new Error('This link is no longer active.');
  return link;
}

export async function recordClearance(input: z.infer<typeof decisionSchema>): Promise<void> {
  const parsed = decisionSchema.parse(input);
  const link = clinicianLink(parsed.token);

  recordClinicianDecision(link.patientId, {
    clearance: { recordedBy: parsed.recordedBy, coversUpToStep: parsed.coversUpToStep },
  });
  revalidatePath(`/s/${parsed.token}`);
  revalidatePath(`/${link.patientId}/today`);
}

export async function recordCaps(input: z.infer<typeof capsSchema>): Promise<void> {
  const parsed = capsSchema.parse(input);
  const link = clinicianLink(parsed.token);

  // Narrowed to known domains, so an unexpected key cannot become a constraint
  // nothing in the system knows how to display.
  const caps: Record<string, number> = {};
  for (const domain of LOAD_DOMAINS) {
    const value = parsed.caps[domain];
    if (value !== undefined) caps[domain] = value;
  }

  recordClinicianDecision(link.patientId, { clinicianCaps: caps });
  revalidatePath(`/s/${parsed.token}`);
  revalidatePath(`/${link.patientId}/today`);
}
