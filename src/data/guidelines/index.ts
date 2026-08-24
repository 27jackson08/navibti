/**
 * The guideline layer: published clinical guidance, transcribed and typed.
 *
 * Read-only by design. Nothing in here depends on a patient, a model, or a
 * database. If a value in this directory changes, it should be because the
 * underlying guideline changed.
 */

export * from './citations';
export * from './types';
export * from './thresholds';
export * from './red-flags';
export { RETURN_TO_LEARN } from './return-to-learn';
export { RETURN_TO_SPORT } from './return-to-sport';

import { RETURN_TO_LEARN } from './return-to-learn';
import { RETURN_TO_SPORT } from './return-to-sport';
import type { Protocol, ProtocolId } from './types';

export const PROTOCOLS: Record<ProtocolId, Protocol> = {
  'return-to-learn': RETURN_TO_LEARN,
  'return-to-sport': RETURN_TO_SPORT,
};

/**
 * The asymmetry most tools get wrong: school does not require clearance, sport
 * does. Exposed as a function so the UI can state it rather than imply it.
 */
export function clearanceRequirement(protocol: ProtocolId): string {
  return protocol === 'return-to-learn'
    ? 'Medical clearance is not required to return to school.'
    : 'Written medical clearance is required before non-contact drills (Step 4) and before ' +
        'unrestricted return to sport.';
}
