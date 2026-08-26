'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/auth/actor';
import { z } from 'zod';
import { createShareLink, revokeShareLink } from '@/db/share';
import { getPatient } from '@/db/store';

const createSchema = z.object({
  patientId: z.string().min(1),
  role: z.enum(['school', 'employer', 'caregiver', 'clinician']),
  includesRawSymptoms: z.boolean(),
  expiresInDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  label: z.string().min(1).max(120),
});

export async function createLink(input: z.infer<typeof createSchema>): Promise<void> {
  const parsed = createSchema.parse(input);
  await requireActor(parsed.patientId);

  // Authorisation, such as it is in a demo: the patient must exist. A real
  // deployment checks that the caller owns this record, which is exactly the
  // gap that keeps this out of production.
  const patient = getPatient(parsed.patientId);
  if (!patient) throw new Error('unknown patient');

  // The form only offers roles this patient has, but the form is not the
  // boundary. A crafted request must not be able to mint an employer link for a
  // schoolchild.
  const allowed: string[] = [...patient.roles, 'clinician'];
  if (!allowed.includes(parsed.role)) {
    throw new Error(`${patient.displayName} has no ${parsed.role} context to share`);
  }

  createShareLink(parsed);
  revalidatePath(`/${parsed.patientId}/sharing`);
}

const revokeSchema = z.object({ patientId: z.string().min(1), linkId: z.string().min(1) });

export async function revokeLink(input: z.infer<typeof revokeSchema>): Promise<void> {
  const parsed = revokeSchema.parse(input);
  await requireActor(parsed.patientId);
  revokeShareLink(parsed.patientId, parsed.linkId);
  revalidatePath(`/${parsed.patientId}/sharing`);
}
