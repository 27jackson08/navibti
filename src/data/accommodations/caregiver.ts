/**
 * Caregiver and family guidance.
 *
 * These read differently from the school and work packets on purpose. A parent
 * is not implementing a policy, they are deciding minute to minute whether to
 * push or hold back — and the guidance that matters most is that both errors
 * are real. Hovering slows recovery; so does letting someone lie in a dark room
 * for a week.
 */

import type { Accommodation } from './types';

export const CAREGIVER_ACCOMMODATIONS: readonly Accommodation[] = [
  {
    id: 'care-both-errors',
    role: 'caregiver',
    domain: 'cognitive',
    text:
      'There are two ways to get this wrong, not one. Pushing through symptoms sets recovery ' +
      'back — and so does resting in a dark room past the first day or two.',
    rationale:
      'Extended strict rest is no longer recommended. Light activity within the first 24-48 ' +
      'hours is.',
    citation: 'amsterdam-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 1,
  },
  {
    id: 'care-check-in-script',
    role: 'caregiver',
    domain: 'emotionalAutonomic',
    text:
      'Ask once, at a set time: "Where are your symptoms right now, 0 to 10?" Then let it go ' +
      'until the next check-in.',
    rationale:
      'Repeated asking is its own load, and it teaches the person to under-report to end the ' +
      'conversation.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 2,
  },
  {
    id: 'care-dont-quiz',
    role: 'caregiver',
    domain: 'cognitive',
    text: 'Do not test their memory or quiz them on what they remember.',
    rationale: 'It adds cognitive load and it is frightening for both of you without informing anything.',
    citation: 'crt6-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 3,
  },
  {
    id: 'care-take-logistics',
    role: 'caregiver',
    domain: 'cognitive',
    text:
      'Take over scheduling, forms, and phone calls. Leave them the decisions that are actually ' +
      'theirs.',
    rationale:
      'Admin is pure cognitive load with no recovery value, and it is the easiest thing to lift.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 4,
  },
  {
    id: 'care-daily-walk',
    role: 'caregiver',
    domain: 'physical',
    text:
      'Get out for a short walk most days, at a pace that lets you hold a conversation. Stop if ' +
      'symptoms climb more than slightly, and go again tomorrow rather than pushing today.',
    rationale:
      'Light aerobic activity below the symptom threshold is part of the treatment now, not a ' +
      'reward for having recovered. A walk is the easiest version of it to actually do.',
    citation: 'amsterdam-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 2,
  },
  {
    id: 'care-quiet-home',
    role: 'caregiver',
    domain: 'visualVestibular',
    text:
      'Keep the household quieter and dimmer than usual for now — lamps rather than overhead ' +
      'lights, television off unless someone is actually watching it.',
    rationale:
      'Home is the one environment nobody else can adjust. Background screens and light are load ' +
      'even when they are not being attended to.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 3,
  },
  {
    id: 'care-busy-places',
    role: 'caregiver',
    domain: 'visualVestibular',
    text:
      'Leave the supermarket, the shopping centre and the car journeys that can wait until later ' +
      'in recovery. If one is unavoidable, go at the quietest hour and keep it short.',
    rationale:
      'Busy visual environments and passive motion draw on the same systems as screen time, and ' +
      'an hour in a supermarket can cost more than an hour of homework.',
    citation: 'lumba-brown-2020',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 2,
    bands: ['very-low', 'low'],
    priority: 4,
  },
  {
    id: 'care-protect-sleep',
    role: 'caregiver',
    domain: 'sleepFatigue',
    text:
      'Protect a consistent bedtime and wake time. Short daytime naps are fine; long ones that ' +
      'wreck the night are not.',
    rationale: 'Sleep debt is one of the strongest day-to-day predictors of a symptom flare.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 5,
  },
  {
    id: 'care-emotional-lability',
    role: 'caregiver',
    domain: 'emotionalAutonomic',
    text:
      'Expect irritability, tearfulness, and a shorter fuse. These are symptoms of the injury, ' +
      'not a change in who they are.',
    rationale:
      'Families consistently report this as the hardest part, and the part nobody warned them about.',
    citation: 'onf-living-adults',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 6,
  },
  {
    id: 'care-plan-together',
    role: 'caregiver',
    domain: 'cognitive',
    text:
      'Plan the day together in the morning, then stop renegotiating it. Decide once, when ' +
      'they are freshest.',
    rationale: 'Decision-making late in the day is unreliable, and re-litigating the plan is a load of its own.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 1,
    maxStep: 4,
    bands: ['very-low', 'low', 'moderate', 'near-full'],
    priority: 7,
  },
  {
    id: 'care-school-contact',
    role: 'caregiver',
    domain: 'cognitive',
    text:
      'Give the school the accommodation letter and name one point of contact there. Medical ' +
      'clearance is not required to return to school.',
    rationale:
      'Schools frequently ask for a doctor’s note before readmitting. The guideline does not ' +
      'require one, and waiting for it keeps students out longer than recommended.',
    citation: 'pedsconcussion-2023',
    protocol: 'return-to-learn',
    minStep: 2,
    maxStep: 3,
    bands: ['very-low', 'low', 'moderate'],
    priority: 8,
  },
];
