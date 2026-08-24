export * from './types';
export { SCHOOL_ACCOMMODATIONS } from './school';
export { EMPLOYER_ACCOMMODATIONS } from './employer';
export { CAREGIVER_ACCOMMODATIONS } from './caregiver';

import { SCHOOL_ACCOMMODATIONS } from './school';
import { EMPLOYER_ACCOMMODATIONS } from './employer';
import { CAREGIVER_ACCOMMODATIONS } from './caregiver';
import type { Accommodation, AccommodationRole } from './types';

export const ACCOMMODATION_LIBRARY: readonly Accommodation[] = [
  ...SCHOOL_ACCOMMODATIONS,
  ...EMPLOYER_ACCOMMODATIONS,
  ...CAREGIVER_ACCOMMODATIONS,
];

export const ACCOMMODATIONS_BY_ROLE: Record<AccommodationRole, readonly Accommodation[]> = {
  school: SCHOOL_ACCOMMODATIONS,
  employer: EMPLOYER_ACCOMMODATIONS,
  caregiver: CAREGIVER_ACCOMMODATIONS,
};

/**
 * The set an LLM tone pass is allowed to draw from for a given packet. Anything
 * outside this set appearing in generated prose is a validation failure.
 */
export function allowedClaimIds(items: readonly Accommodation[]): ReadonlySet<string> {
  return new Set(items.map((item) => item.id));
}
export * from './placeholders';
