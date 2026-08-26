'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/auth/actor';
import { z } from 'zod';
import { LOAD_DOMAINS, RED_FLAG_IDS } from '@/data/guidelines';
import { saveCheckIn } from '@/db/store';
import { isoDay, type CheckIn } from '@/engine/session';

/**
 * Validated at the boundary rather than trusted. A check-in is the only input
 * that moves the model, so a malformed one would quietly distort every
 * recommendation that follows it.
 */
const checkInSchema = z.object({
  patientId: z.string().min(1),
  preActivitySeverity: z.number().min(0).max(10),
  worstSeverity: z.number().min(0).max(10),
  deltaDurationMinutes: z.number().min(0).max(1440),
  sleepDebtHours: z.number().min(0).max(12),
  // Validated as a loose map and then narrowed to known domains below, so an
  // unexpected key is dropped rather than becoming a feature the model fits.
  doses: z.record(z.string(), z.number().min(0).max(1440)),
  redFlagIds: z.array(z.enum(RED_FLAG_IDS as [string, ...string[]])),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export async function submitCheckIn(input: CheckInInput): Promise<void> {
  const parsed = checkInSchema.parse(input);

  // Before anything is written: is this session actually acting as this patient?
  await requireActor(parsed.patientId);

  const doses: CheckIn['doses'] = { sleepFatigue: parsed.sleepDebtHours };
  for (const domain of LOAD_DOMAINS) {
    const dose = parsed.doses[domain];
    if (dose !== undefined) doses[domain] = dose;
  }

  const checkIn: CheckIn = {
    day: isoDay(new Date()),
    preActivitySeverity: parsed.preActivitySeverity,
    // The worst point of the day cannot be milder than the starting point.
    worstSeverity: Math.max(parsed.preActivitySeverity, parsed.worstSeverity),
    deltaDurationMinutes: parsed.deltaDurationMinutes,
    doses,
    redFlagIds: parsed.redFlagIds,
  };

  saveCheckIn(parsed.patientId, checkIn);
  revalidatePath(`/${parsed.patientId}/today`);
}
