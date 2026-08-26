'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireActor } from '@/auth/actor';
import { getPatient } from '@/db/store';
import { withdrawFlag } from '@/db/responses';

/**
 * Withdrawing a report that an accommodation is unavailable.
 *
 * The counterpart to the recipient's own undo, which stops working the moment
 * their link expires. This one is the patient's, and it does not expire.
 *
 * It restores the plan to what the guideline floor and the tolerance model
 * already said — it cannot raise anything above that, because the accommodation
 * only ever subtracted. So the failure mode of getting this wrong is a plan
 * that assumes a support which is not there, which the recipient can report
 * again, rather than a plan that exceeds what the evidence supports.
 */
const schema = z.object({
  patientId: z.string().min(1),
  accommodationId: z.string().min(1),
});

export async function withdrawUnavailable(input: z.infer<typeof schema>): Promise<void> {
  const { patientId, accommodationId } = schema.parse(input);

  if (!getPatient(patientId)) throw new Error('No such patient.');

  // Every mutation scoped to a patient passes through here. This one did not
  // when it was written, which meant a crafted request could withdraw somebody
  // else's unavailability report and raise their limits — the exact hole the
  // actor seam exists to close, reopened by the newest thing to use it.
  await requireActor(patientId);

  withdrawFlag(patientId, accommodationId);

  revalidatePath(`/${patientId}/today`);
  revalidatePath(`/${patientId}/history`);
  revalidatePath(`/${patientId}/clinician`);
}
