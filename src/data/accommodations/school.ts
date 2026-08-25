/**
 * School accommodations, keyed to Return-to-Learn steps 2-3.
 *
 * Step 4 is by definition "no concussion-related accommodations", so nothing
 * here applies at step 4 — that is the goal state, not a state needing a packet.
 */

import type { Accommodation } from './types';

export const SCHOOL_ACCOMMODATIONS: readonly Accommodation[] = [
  {
    id: 'school-shortened-day',
    role: 'school',
    domain: 'cognitive',
    text: 'Schedule a shortened day: {{hours}} of class, ideally in the morning.',
    rationale:
      'Cognitive stamina is the limiting factor and it is lowest late in the day. Attending ' +
      'part of the day is better than staying home.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low'],
    priority: 1,
  },
  {
    id: 'school-scheduled-breaks',
    role: 'school',
    domain: 'cognitive',
    text:
      'Give a {{breakMinutes}}-minute rest break in a quiet, dimly lit space after every ' +
      '{{workMinutes}} minutes of class work. The break should be scheduled, not requested.',
    rationale:
      'Breaks the student has to ask for in front of peers are breaks the student will skip.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 2,
  },
  {
    // Separate from the numeric cap because at the lowest band that cap reads
    // "no more than 0 minutes", which is not an instruction anyone can follow
    // and is not what the guideline means by minimising screen time.
    id: 'school-screen-minimal',
    role: 'school',
    domain: 'visualVestibular',
    text:
      'Avoid screen-based work for now. Provide printed materials, and read aloud or use audio ' +
      'where the lesson would normally use a screen.',
    rationale: 'Screens load the visual and vestibular systems harder than paper does.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low'],
    priority: 3,
  },
  {
    id: 'school-screen-cap',
    role: 'school',
    domain: 'visualVestibular',
    text:
      'Cap screen work at {{screenMinutes}} minutes per class period, and no more than ' +
      '{{screenDailyMinutes}} minutes across the school day.',
    rationale: 'Screens load the visual and vestibular systems harder than paper does.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['low', 'moderate'],
    priority: 3,
  },
  {
    id: 'school-print-over-screen',
    role: 'school',
    domain: 'visualVestibular',
    text: 'Provide printed copies of anything the class reads on a screen.',
    rationale: 'Removes a source of load without removing the student from the lesson.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    // Not at the lowest band, where school-screen-minimal already says this and
    // says it better. Two items making the same request reads as padding.
    bands: ['low', 'moderate'],
    priority: 4,
  },
  {
    id: 'school-no-timed-tests',
    role: 'school',
    domain: 'cognitive',
    text: 'No timed tests. Allow extra time, or assess understanding another way.',
    rationale:
      'Processing speed recovers more slowly than knowledge. A timed test measures the injury, ' +
      'not the learning.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 5,
  },
  {
    id: 'school-one-assessment-per-day',
    role: 'school',
    domain: 'cognitive',
    text: 'No more than one test or major assignment per day.',
    rationale: 'Concentrated assessment days are the most common trigger for a setback.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 6,
    minAttendanceHours: 1.5,
  },
  {
    id: 'school-no-makeup-backlog',
    role: 'school',
    domain: 'cognitive',
    text:
      'Excuse, rather than defer, work missed during the acute period. Identify the few ' +
      'assessments that are genuinely essential and drop the rest.',
    rationale:
      'A backlog waiting at the end of recovery re-creates exactly the overload that caused ' +
      'the setback.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 7,
  },
  {
    id: 'school-peer-notes',
    role: 'school',
    domain: 'cognitive',
    text: 'Provide teacher notes or a peer note-taker so the student does not write and listen at once.',
    rationale: 'Note-taking is dual-tasking, which is disproportionately hard after concussion.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 8,
  },
  {
    id: 'school-early-hallway-pass',
    role: 'school',
    domain: 'visualVestibular',
    text: 'Let the student leave class five minutes early to avoid crowded hallways.',
    rationale: 'Crowds, noise and visual motion between classes are a load nobody schedules for.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 9,
    minAttendanceHours: 1.5,
  },
  {
    id: 'school-leave-without-explaining',
    role: 'school',
    domain: 'emotionalAutonomic',
    text:
      'Allow the student to leave the room without explaining why, using an agreed silent signal.',
    rationale:
      'Having to justify the exit in front of the class is why students push through instead.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 10,
  },
  {
    id: 'school-light-sensitivity',
    role: 'school',
    domain: 'visualVestibular',
    text:
      'Permit sunglasses or a brimmed hat indoors, and seat the student away from windows and ' +
      'directly under-lit areas.',
    rationale: 'Light sensitivity is common and cheap to accommodate.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 11,
  },
  {
    id: 'school-quiet-lunch',
    role: 'school',
    domain: 'emotionalAutonomic',
    text: 'Offer an alternative quiet space for lunch and free periods.',
    rationale: 'Cafeterias are the loudest environment in the building and the least supervised.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 12,
    minAttendanceHours: 2.5,
  },
  {
    id: 'school-rest-period',
    role: 'school',
    domain: 'sleepFatigue',
    text: 'Provide one scheduled rest period per day in a quiet room, not the busy nurse station.',
    rationale: 'Fatigue accumulates through the day; a planned reset extends how much is tolerated.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 13,
    minAttendanceHours: 2,
  },
  {
    id: 'school-late-start',
    role: 'school',
    domain: 'sleepFatigue',
    text: 'Allow a later start time and excuse first period if sleep is disrupted.',
    rationale: 'Sleep disruption is one of the strongest predictors of a bad day.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low'],
    priority: 14,
    minAttendanceHours: 1.5,
  },
  {
    id: 'school-pe-restriction',
    role: 'school',
    domain: 'physical',
    text:
      'No gym class participation with any risk of head impact, and no competitive play. ' +
      'Supervised individual activity without impact risk is appropriate.',
    rationale:
      'Gym class activities with head-impact risk sit at Return-to-Sport Step 4 and above, ' +
      'which requires written medical clearance that this document does not provide.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 15,
  },
];
