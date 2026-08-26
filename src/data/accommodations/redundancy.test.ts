import { describe, expect, it } from 'vitest';
import {
  ACCOMMODATIONS_BY_ROLE,
  ACCOMMODATION_LIBRARY,
  TOLERANCE_BANDS,
  type Accommodation,
  type ToleranceBand,
} from './index';

/**
 * Two items making the same request in one letter reads as padding and
 * undermines the rest of the document. These pairs must never co-occur.
 */
const MUTUALLY_EXCLUSIVE: readonly (readonly [string, string])[] = [
  ['school-screen-minimal', 'school-screen-cap'],
  ['school-screen-minimal', 'school-print-over-screen'],
  ['work-meetings-none', 'work-meeting-cap'],
];

function coOccurs(items: readonly Accommodation[], a: string, b: string): boolean {
  const first = items.find((item) => item.id === a);
  const second = items.find((item) => item.id === b);
  if (!first || !second) return false;

  const sharesBand = TOLERANCE_BANDS.some(
    (band) => first.bands.includes(band) && second.bands.includes(band),
  );
  const sharesStep = first.minStep <= second.maxStep && second.minStep <= first.maxStep;

  // A pair split by attendance can share every band and still never co-occur,
  // which is exactly how work-meetings-none and work-meeting-cap are separated.
  const overlapLow = Math.max(first.minAttendanceHours ?? 0, second.minAttendanceHours ?? 0);
  const overlapHigh = Math.min(
    first.maxAttendanceHours ?? Number.POSITIVE_INFINITY,
    second.maxAttendanceHours ?? Number.POSITIVE_INFINITY,
  );
  const sharesAttendance = overlapLow < overlapHigh;

  return sharesBand && sharesStep && sharesAttendance;
}

describe('no two items say the same thing', () => {
  it.each(MUTUALLY_EXCLUSIVE)('%s and %s never appear together', (a, b) => {
    for (const items of Object.values(ACCOMMODATIONS_BY_ROLE)) {
      expect(coOccurs(items, a, b), `${a} + ${b}`).toBe(false);
    }
  });
});

/**
 * Every item in the library has to be reachable.
 *
 * Attendance and tolerance band both derive from the same cognitive dose, so an
 * attendance gate set too high can never co-occur with the band the item is
 * written for — the item then sits in the library looking correct and never
 * appears in a packet. That happened to five school items the first time these
 * gates were added.
 */
describe('every accommodation can actually be selected', () => {
  const REFERENCE_COGNITIVE_MINUTES = 240;

  function bandAt(hours: number): ToleranceBand {
    const normalized = (hours * 60) / REFERENCE_COGNITIVE_MINUTES;
    if (normalized < 0.25) return 'very-low';
    if (normalized < 0.5) return 'low';
    if (normalized < 0.85) return 'moderate';
    return 'near-full';
  }

  const ATTENDANCE_STEPS = Array.from({ length: 27 }, (_, i) => 0.5 + i * 0.25);

  it.each(ACCOMMODATION_LIBRARY.filter((item) => item.minAttendanceHours !== undefined))(
    '$id has an attendance where its band still applies',
    (item) => {
      const reachable = ATTENDANCE_STEPS.some(
        (hours) =>
          hours >= (item.minAttendanceHours ?? 0) &&
          item.bands.includes(bandAt(hours)) &&
          // Cognitive items are gated by the cognitive band; other domains vary
          // independently and are always reachable.
          true,
      );
      expect(reachable, `${item.id} can never appear in a packet`).toBe(true);
    },
  );
});
