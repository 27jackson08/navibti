/**
 * The check-in has to be completable in about a minute by someone who is
 * fatigued, light-sensitive and possibly nauseated. That rules out sliders,
 * free text and precise recall.
 *
 * So load is collected as a handful of large, plainly-worded choices that map
 * to minutes behind the scenes. The estimate is coarser than a stopwatch and
 * far more likely to actually get filled in — and a coarse answer every day
 * beats a precise answer three times a week.
 */

import type { LoadDomain } from '@/data/guidelines';

export interface Preset {
  readonly label: string;
  readonly detail?: string;
  readonly value: number;
}

export interface DomainQuestion {
  readonly domain: LoadDomain;
  readonly question: string;
  readonly help: string;
  readonly presets: readonly Preset[];
}

export const DOMAIN_QUESTIONS: readonly DomainQuestion[] = [
  {
    domain: 'cognitive',
    question: 'How much concentrating did you do?',
    help: 'Classes, meetings, reading, work that needed real focus.',
    presets: [
      { label: 'None', value: 0 },
      { label: 'A little', detail: 'about 30 minutes', value: 30 },
      { label: 'An hour or so', value: 60 },
      { label: 'Half a day', detail: 'around 3 hours', value: 180 },
      { label: 'A full day', detail: '5 hours or more', value: 330 },
    ],
  },
  {
    domain: 'visualVestibular',
    question: 'How much screen time and motion?',
    help: 'Phones, laptops, TV, travelling, busy or crowded places.',
    presets: [
      { label: 'Almost none', value: 10 },
      { label: 'A little', detail: 'about 30 minutes', value: 30 },
      { label: 'An hour or two', value: 90 },
      { label: 'Most of the day', detail: 'around 4 hours', value: 240 },
      { label: 'Constant', detail: '6 hours or more', value: 380 },
    ],
  },
  {
    domain: 'physical',
    question: 'How much moving around?',
    help: 'Walking, cycling, exercise. Count anything that raised your heart rate.',
    presets: [
      { label: 'None', value: 0 },
      { label: 'A short walk', detail: 'about 10 minutes', value: 10 },
      { label: 'A proper walk', detail: 'around 30 minutes', value: 30 },
      { label: 'Light exercise', detail: 'around 45 minutes', value: 45 },
      { label: 'Hard exercise', value: 75 },
    ],
  },
  {
    domain: 'emotionalAutonomic',
    question: 'How demanding was the day socially?',
    help: 'Noise, crowds, people needing things from you, stress.',
    presets: [
      { label: 'Quiet', value: 20 },
      { label: 'Fairly calm', value: 60 },
      { label: 'Busy', value: 150 },
      { label: 'Very busy', value: 260 },
      { label: 'Overwhelming', value: 360 },
    ],
  },
];

/** Sleep is collected as shortfall against the person's own usual night. */
export const SLEEP_PRESETS: readonly Preset[] = [
  { label: 'Slept well', detail: 'about my usual', value: 0 },
  { label: 'A bit short', detail: 'an hour less than usual', value: 1 },
  { label: 'Poorly', detail: 'two hours less', value: 2 },
  { label: 'Barely slept', detail: 'three hours less or more', value: 3.5 },
];

export const DURATION_PRESETS: readonly Preset[] = [
  { label: 'A few minutes', value: 10 },
  { label: 'Under an hour', value: 40 },
  { label: 'An hour or two', value: 90 },
  { label: 'Most of the day', value: 300 },
];
