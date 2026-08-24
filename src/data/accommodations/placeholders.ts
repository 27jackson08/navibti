/**
 * The complete set of slots the packet composer knows how to fill.
 *
 * An accommodation containing a placeholder outside this list would render as
 * literal `{{mustache}}` text in a letter sent to a school. The test suite
 * enforces the contract so that cannot ship.
 */
export const ACCOMMODATION_PLACEHOLDERS = [
  'hours',
  'breakMinutes',
  'workMinutes',
  'screenMinutes',
  'screenDailyMinutes',
  'meetingCount',
  'meetingMinutes',
  'gapMinutes',
  'deepWorkMinutes',
  'earliestHour',
] as const;

export type AccommodationPlaceholder = (typeof ACCOMMODATION_PLACEHOLDERS)[number];

export const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
