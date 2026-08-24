import { describe, expect, it } from 'vitest';
import { ACCOMMODATIONS_BY_ROLE, TOLERANCE_BANDS, type Accommodation } from './index';

/**
 * Two items making the same request in one letter reads as padding and
 * undermines the rest of the document. These pairs must never co-occur.
 */
const MUTUALLY_EXCLUSIVE: readonly (readonly [string, string])[] = [
  ['school-screen-minimal', 'school-screen-cap'],
  ['school-screen-minimal', 'school-print-over-screen'],
];

function coOccurs(items: readonly Accommodation[], a: string, b: string): boolean {
  const first = items.find((item) => item.id === a);
  const second = items.find((item) => item.id === b);
  if (!first || !second) return false;

  const sharesBand = TOLERANCE_BANDS.some(
    (band) => first.bands.includes(band) && second.bands.includes(band),
  );
  const sharesStep = first.minStep <= second.maxStep && second.minStep <= first.maxStep;
  return sharesBand && sharesStep;
}

describe('no two items say the same thing', () => {
  it.each(MUTUALLY_EXCLUSIVE)('%s and %s never appear together', (a, b) => {
    for (const items of Object.values(ACCOMMODATIONS_BY_ROLE)) {
      expect(coOccurs(items, a, b), `${a} + ${b}`).toBe(false);
    }
  });
});
