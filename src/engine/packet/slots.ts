/**
 * The translation layer.
 *
 * This is the part of NaviTBI that does not exist anywhere else. A tolerance
 * estimate of "107 focused minutes" is meaningful to the model and useless to a
 * school office, which schedules in periods, breaks and half days. These
 * functions turn one into the other.
 *
 * Every conversion is a product default, and every one is stated with its
 * reasoning, because a reader who disagrees with "a meeting costs about
 * 45 minutes of concentration" should be able to find and argue with that
 * specific claim rather than distrust the whole document.
 */

import type { LoadDomain } from '@/data/guidelines';
import type { AccommodationPlaceholder } from '@/data/accommodations';
import type { DayPlan } from '@/engine/tolerance/threshold';

export type SlotValues = Record<AccommodationPlaceholder, string>;

function doseOf(plan: DayPlan, domain: LoadDomain): number {
  return plan.recommendations.find((item) => item.domain === domain)?.dose ?? 0;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A schedulable block: never shorter than 10 minutes, never longer than a class period. */
function blockLength(cognitiveMinutes: number): number {
  // Three working blocks a day is a cadence a timetable can actually hold, and
  // it leaves room for the breaks between them. Below ten minutes a "block" is
  // not a unit anyone can schedule around.
  return clamp(roundTo(cognitiveMinutes / 3, 5), 10, 45);
}

export function deriveSlots(plan: DayPlan): SlotValues {
  const cognitive = doseOf(plan, 'cognitive');
  const visual = doseOf(plan, 'visualVestibular');
  const sleepDebtTolerance = doseOf(plan, 'sleepFatigue');

  const workMinutes = blockLength(cognitive);

  // A longer break for someone with very little capacity: the shorter their
  // working block, the more recovery each one needs to be worth taking. Capped
  // at the block itself, because "a 15-minute break after every 10 minutes of
  // work" is not an instruction a timetable can carry out.
  const breakMinutes = Math.min(workMinutes, workMinutes <= 20 ? 15 : 10);

  // Attendance is capped by concentration, not by willingness. Half an hour is
  // the smallest visit worth arranging; seven hours is a full day, at which
  // point the accommodation is no longer needed.
  const attendanceHours = clamp(roundTo(cognitive / 60, 0.5), 0.5, 7);

  // A live meeting is roughly forty-five minutes of dense, unpausable
  // concentration -- listening, tracking and responding at once. Budgeting them
  // against the cognitive allowance is what stops a "light day" from being four
  // back-to-back calls.
  const meetingCount = clamp(Math.floor(cognitive / 45), 0, 6);

  // Not all concentration is interchangeable. Sustained analytical work is the
  // most expensive kind, so it gets a share of the budget rather than all of it.
  const deepWorkMinutes = clamp(roundTo(cognitive * 0.6, 15), 0, 240);

  // Sleep is the strongest day-to-day predictor of a bad day, so a patient with
  // little room for sleep debt should not be starting at eight in the morning.
  const earliestHour = sleepDebtTolerance < 1.5 ? '10am' : '9am';

  return {
    hours: formatHours(attendanceHours),
    breakMinutes: String(breakMinutes),
    workMinutes: String(workMinutes),
    screenMinutes: String(clamp(roundTo(visual / 4, 5), 0, 90)),
    screenDailyMinutes: String(roundTo(visual, 5)),
    meetingCount: String(meetingCount),
    meetingMinutes: String(Math.min(45, workMinutes)),
    gapMinutes: String(breakMinutes),
    deepWorkMinutes: String(deepWorkMinutes),
    earliestHour,
  };
}

/**
 * Includes the unit, so templates read "1 hour" rather than "1 hours". The
 * alternative is pluralisation logic scattered through the library, which is
 * how a document that goes to a school ends up saying "1 hours of class".
 */
function formatHours(hours: number): string {
  const rendered = hours === Math.floor(hours) ? String(hours) : hours.toFixed(1);
  if (hours === 1) return '1 hour';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  return `${rendered.replace(/\.0$/, '')} hours`;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Fills a template. Throws on an unknown slot rather than leaving `{{mustache}}`
 * in a letter that goes to a school — the test suite checks the library against
 * the slot list, so reaching this error means the two have drifted apart.
 */
export function fillSlots(template: string, slots: SlotValues): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = slots[name as AccommodationPlaceholder];
    if (value === undefined) {
      throw new Error(`accommodation template uses unknown slot "${name}"`);
    }
    return value;
  });
}
