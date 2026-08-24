/**
 * Return to School / Learn protocol — FOUR steps.
 *
 * Transcribed from the PedsConcussion Living Guideline table (Sept 2023), which
 * is harmonised with and modified with permission from Amsterdam 2023.
 *
 * The common mistake this file exists to prevent: Return-to-Learn is four steps.
 * The six-step ladder is Return-to-Sport, and it is a different document with a
 * different clearance rule. See ./return-to-sport.ts.
 */

import type { Protocol } from './types';

export const RETURN_TO_LEARN: Protocol = {
  id: 'return-to-learn',
  name: 'Return to School / Learn',
  citation: 'pedsconcussion-2023',
  instructions:
    'Students should begin a gradual increase in their cognitive load with the goal of ' +
    'minimizing time away from the school environment. The return to school should not be ' +
    'restricted if the student is tolerating full days. Progression through the strategy may ' +
    'be slowed when there is more than a mild and brief symptom exacerbation; however, missing ' +
    'more than one week of school is not generally recommended.',
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
      onExceedance: {
        kind: 'slow-progression',
        reason:
          'Relative rest is capped at 24-48 hours. Extending it is not supported by the ' +
          'guideline, so reduce the load rather than the timeline.',
      },
    },
    {
      step: 2,
      title: 'School activities, as tolerated',
      activity:
        'School activities with encouragement to return to school as soon as possible ' +
        '(as tolerated)',
      examples:
        'Reading or other cognitive activities at school or at home. Take breaks and adapt ' +
        'activities if concussion symptom exacerbation (worsening) is more than mild and brief. ' +
        'Clearance from your doctor is not required to return to low-risk in-person or ' +
        'at-home school activities.',
      goal: 'Increase tolerance to cognitive work, and connect socially with peers.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: {
        kind: 'slow-progression',
        reason:
          'A complete absence from the school environment for more than one week is not ' +
          'generally recommended. Adapt the activity, do not withdraw the student.',
      },
    },
    {
      step: 3,
      title: 'Part-time or full days with accommodations',
      activity: 'Part-time or full days at school with academic accommodations if needed',
      examples:
        'Gradual reintroduction of school work. May require partial school days with access to ' +
        'breaks throughout the day, or with academic accommodations to tolerate the classroom ' +
        'or school environment. Gradually reduce accommodations and increase workload until ' +
        'full days without concussion-related accommodations are tolerated.',
      goal: 'Rebuild a full school day by trading accommodations away one at a time.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: {
        kind: 'slow-progression',
        reason:
          'Restore the accommodation that was most recently removed before reducing school ' +
          'attendance.',
      },
    },
    {
      step: 4,
      title: 'Full-time, no accommodations',
      activity: 'Return to school full-time. No academic accommodations related to concussion.',
      examples:
        'Return to full days at school and academic activities without requiring ' +
        'concussion-related accommodations. Medical clearance is NOT required to return to school.',
      maxHoursAtStep: null,
      minHoursBeforeAdvance: 24,
      requiresMedicalClearance: false,
      additionalPrerequisites: [],
      onExceedance: {
        kind: 'return-to-step',
        step: 3,
        reason:
          'Reinstate accommodations rather than reducing attendance. Full-day tolerance is the ' +
          'goal, and a student tolerating full days should not be restricted.',
      },
    },
  ],
};
