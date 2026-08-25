'use server';

import { revalidatePath } from 'next/cache';
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

  // Authorisation, such as it is in a demo: the patient must exist. A real
  // deployment checks that the caller owns this record, which is exactly the
  // gap that keeps this out of production.
  if (!getPatient(parsed.patientId)) throw new Error('unknown patient');

  createShareLink(parsed);
  revalidatePath(`/${parsed.patientId}/sharing`);
}

const revokeSchema = z.object({ patientId: z.string().min(1), linkId: z.string().min(1) });

export async function revokeLink(input: z.infer<typeof revokeSchema>): Promise<void> {
  const parsed = revokeSchema.parse(input);
  revokeShareLink(parsed.patientId, parsed.linkId);
  revalidatePath(`/${parsed.patientId}/sharing`);
}
