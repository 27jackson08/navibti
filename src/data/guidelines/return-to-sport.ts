/**
 * Return to Activity / Sport protocol — SIX steps.
 *
 * Transcribed from the PedsConcussion Living Guideline table (Sept 2023), which
 * is harmonised with and modified with permission from Amsterdam 2023.
 *
 * NaviTBI never advances a patient into steps 4-6 and never issues clearance.
 * The clearance gate is transcribed here so the app can *display* the
 * requirement and refuse; see `src/engine/stage`.
 */

import type { Protocol } from './types';

export const RETURN_TO_SPORT: Protocol = {
  id: 'return-to-sport',
  name: 'Return to Activity / Sport',
  citation: 'pedsconcussion-2023',
  instructions:
    'Begin Step 1 (relative rest) within 24 hours of injury, with progression through each ' +
    'subsequent step taking a minimum of 24 hours. If more than mild exacerbation (worsening) ' +
    'of symptoms (more than 2 points on a 0-10 scale) occurs during Steps 1-3, stop the ' +
    'activity and attempt to exercise the next day. People experiencing concussion-related ' +
    'symptoms during Steps 4-6 should return to Step 3 to establish full resolution of symptoms ' +
    'with exertion before engaging in at-risk activities. Written determination of medical ' +
    'clearance should be provided before unrestricted Return to Sport as directed by local laws ' +
    'and/or sporting regulations.',
  steps: [
    {
      step: 1,
      title: 'Daily activities and relative rest',
      activity: 'Activities of daily living and relative rest (maximum of 24-48 hours)',
      examples:
        'Activities at home such as social interactions and light walking that do not result ' +
        'in more than mild and brief exacerbation (worsening) of concussion symptoms. ' +
        'Minimize screentime.',
      maxHoursAtStep: 48,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: { kind: 'stop-and-retry-next-day' },
    },
    {
      step: 2,
      title: 'Aerobic exercise',
      activity:
        'Aerobic exercise. Step 2A: light effort, up to approximately 55% of maximum heart ' +
        'rate. Step 2B: moderate effort, up to approximately 70% of maximum heart rate.',
      examples:
        'Start with stationary cycling or walking at slow to medium pace. Take a break and ' +
        'modify activities as needed with the aim of gradually increasing tolerance and the ' +
        'intensity of aerobic activities. Light resistance training that does not result in ' +
        'more than mild and brief exacerbation (worsening) of concussion symptoms.',
      goal: 'Increase the heart rate.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: { kind: 'stop-and-retry-next-day' },
    },
    {
      step: 3,
      title: 'Individual sport-specific activity',
      activity:
        'Individual sport-specific activities that do not have a risk of inadvertent head impact',
      examples:
        'Sport-specific training away from the team sport environment (for example running, ' +
        'change of direction, individual training drills, and individual gym class activities ' +
        'that do not have a risk of head impact and are supervised by a teacher or coach).',
      goal:
        'Increase the intensity of aerobic activities and introduce low-risk sport-specific ' +
        'movements and changes of direction.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: { kind: 'stop-and-retry-next-day' },
    },
    {
      step: 4,
      title: 'Non-contact training drills',
      activity: 'Non-contact training drills and activities',
      examples:
        'Exercise to high intensity including more challenging training drills and activities ' +
        '(for example passing drills, multiplayer training, high-intensity exercises, ' +
        'supervised non-contact gym class activities, and practices without body contact).',
      goal:
        'Resume usual intensity of exercise, coordination, and activity-related cognitive skills.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: true,
      additionalPrerequisites: [
        'Medical clearance is required to progress to Step 4.',
        'A full return to school is required to progress to Step 4.',
      ],
      onExceedance: {
        kind: 'return-to-step',
        step: 3,
        reason:
          'Establish full resolution of symptoms with exertion before engaging in at-risk ' +
          'activities.',
      },
    },
    {
      step: 5,
      title: 'Full-contact practice',
      activity:
        'Return to all non-competitive activities, all gym class activities, and full-contact ' +
        'practices',
      examples:
        'Participate in higher-risk activities including normal training activities, all school ' +
        'gym-class activities, and full-contact sports practices and scrimmages. Avoid ' +
        'competitive gameplay.',
      goal:
        'Return to activities that have a risk of falling or body contact, restore game-play ' +
        'confidence, and have coaches assess functional skills.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: true,
      additionalPrerequisites: ['Reached only after the Step 4 clearance gate.'],
      onExceedance: {
        kind: 'return-to-step',
        step: 3,
        reason:
          'Establish full resolution of symptoms with exertion before engaging in at-risk ' +
          'activities.',
      },
    },
    {
      step: 6,
      title: 'Return to sport',
      activity: 'Return to sport',
      examples:
        'Normal, unrestricted competitive gameplay, school gym class, and physical activities.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: true,
      additionalPrerequisites: [
        'Written determination of medical clearance should be provided before unrestricted ' +
          'Return to Sport, as directed by local laws and/or sporting regulations.',
      ],
      onExceedance: {
        kind: 'return-to-step',
        step: 3,
        reason:
          'Establish full resolution of symptoms with exertion before engaging in at-risk ' +
          'activities.',
      },
    },
  ],
};
