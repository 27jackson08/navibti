/**
 * Workplace accommodations.
 *
 * Adults mostly do not have a Return-to-Learn stage, but the same cognitive
 * load ladder applies, so these are keyed to the Return-to-Learn steps with
 * "school" read as "work". The distinction that matters is that nothing here
 * touches head-impact risk, so no clearance gate applies.
 */

import type { Accommodation } from './types';

export const EMPLOYER_ACCOMMODATIONS: readonly Accommodation[] = [
  {
    id: 'work-phased-hours',
    role: 'employer',
    domain: 'sleepFatigue',
    text: 'Phase hours back in: {{hours}} per day this week, reviewed weekly.',
    rationale:
      'A phased return that holds is faster than a full return that fails and restarts.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 1,
  },
  {
    // Below an hour of concentration the meeting budget rounds to none, and the
    // numeric version of this item becomes "at 0 per day and 10 minutes each".
    id: 'work-meetings-none',
    role: 'employer',
    domain: 'cognitive',
    text:
      'No live meetings for now. Put decisions in writing; if something genuinely needs a ' +
      'conversation, keep it short and in the morning.',
    rationale:
      'A live meeting means listening, keeping track, and answering all at once, with no way to ' +
      'pause. There is not enough concentration to spend on one today.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 2,
    maxAttendanceHours: 1,
  },
  {
    id: 'work-meeting-cap',
    role: 'employer',
    domain: 'cognitive',
    text:
      'Cap live meetings at {{meetingCount}} per day and {{meetingMinutes}} minutes each. ' +
      'Everything else goes async.',
    rationale:
      'Live meetings are the densest cognitive load in a knowledge job: listening, tracking, ' +
      'and responding at once, with no ability to pause.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 2,
    // Only where the budget actually allows a meeting; see work-meetings-none.
    minAttendanceHours: 1,
  },
  {
    id: 'work-no-back-to-back',
    role: 'employer',
    domain: 'cognitive',
    text: 'No back-to-back meetings. Leave at least {{gapMinutes}} minutes between any two.',
    rationale:
      'Recovery between blocks is what keeps a symptom rise brief. Consecutive calls remove it.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 3,
    minAttendanceHours: 1.5,
    // Recovery between meetings is what keeps a symptom rise brief.
    supportsLoad: { domain: 'cognitive', withoutIt: 0.8 },
  },
  {
    id: 'work-camera-off',
    role: 'employer',
    domain: 'visualVestibular',
    text: 'Camera off by default on all calls, with no expectation of explaining why.',
    rationale:
      'Video grids are constant visual motion, and self-view adds a monitoring load on top.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 4,
  },
  {
    id: 'work-screen-breaks',
    role: 'employer',
    domain: 'visualVestibular',
    text:
      'Expect a {{breakMinutes}}-minute screen break every {{workMinutes}} minutes. Do not ' +
      'treat these as time off task.',
    rationale: 'Scheduled breaks prevent the crash that costs the rest of the day.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 5,
    // Scheduled breaks are what make sustained screen work tolerable.
    supportsLoad: { domain: 'visualVestibular', withoutIt: 0.75 },
  },
  {
    id: 'work-deep-focus-budget',
    role: 'employer',
    domain: 'cognitive',
    text:
      'Budget at most {{deepWorkMinutes}} minutes of sustained analytical work per day, ' +
      'scheduled in the morning.',
    rationale: 'Concentration capacity is a daily budget that does not refill by pushing harder.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 6,
    // Below an hour of concentration there is no deep-work budget to allocate,
    // and the template would read "budget at most 0 minutes".
    minAttendanceHours: 1,
  },
  {
    id: 'work-defer-high-stakes',
    role: 'employer',
    domain: 'cognitive',
    text:
      'Defer high-stakes and irreversible decisions, and reassign work with hard external ' +
      'deadlines for now.',
    rationale:
      'Judgment and processing speed recover more slowly than the ability to look fine in a ' +
      'meeting.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low'],
    priority: 7,
  },
  {
    id: 'work-written-summaries',
    role: 'employer',
    domain: 'cognitive',
    text: 'Follow every verbal decision with a short written summary.',
    rationale:
      'Working memory is affected. This removes the need to hold decisions in mind and to ask ' +
      'twice.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 8,
  },
  {
    id: 'work-quiet-space',
    role: 'employer',
    domain: 'emotionalAutonomic',
    text: 'Provide a quiet, low-light place to work, or approve working from home.',
    rationale: 'Open-plan noise and lighting are a continuous load with no natural breaks.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 9,
    // Open-plan noise is a continuous load with no natural breaks.
    supportsLoad: { domain: 'emotionalAutonomic', withoutIt: 0.8 },
  },
  {
    id: 'work-flexible-start',
    role: 'employer',
    domain: 'sleepFatigue',
    text: 'Allow a flexible start time and avoid scheduling anything before {{earliestHour}}.',
    rationale: 'Sleep is commonly disrupted after concussion, and mornings are the cost of that.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low'],
    priority: 10,
  },
  {
    id: 'work-no-driving',
    role: 'employer',
    domain: 'physical',
    text:
      'Do not require driving or operating equipment on days when symptoms are present. ' +
      'Approve travel alternatives.',
    rationale:
      'Reaction time and divided attention are affected, and the person is often the last to ' +
      'notice.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate'],
    priority: 11,
  },
];
