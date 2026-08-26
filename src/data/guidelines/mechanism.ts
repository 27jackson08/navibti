/**
 * Why these five load domains, and what each one is actually tracking.
 *
 * The domains are the neuroscience content of this product, and for most of its
 * life they existed only as labels on a dose. This file is the explanation:
 * what a domain loads, why an injured brain has less room for it, and what the
 * guidance says about putting it back.
 *
 * The through-line is the neurometabolic cascade. After concussion the brain
 * goes through an ionic flux and a period of increased energy demand at exactly
 * the moment its ability to meet that demand is reduced — a metabolic crisis
 * rather than a structural one. That is why capacity is finite, why it is a
 * budget rather than a matter of effort, and why exceeding it produces symptoms
 * without producing damage. It is also why sub-threshold exposure works: the
 * budget recovers, and using it up to but not beyond its limit is how it is
 * rebuilt.
 */

import type { CitationId } from './citations';
import type { LoadDomain } from './types';

/**
 * Clinical subtypes from Concussion Guidelines Step 2.
 *
 * Used to describe what a pattern resembles, never to assign a patient one.
 * Subtyping is a clinical judgement made by a clinician with an examination in
 * front of them; NaviTBI has self-reported daily minutes.
 */
export type ClinicalSubtype =
  | 'cognitive'
  | 'ocular-motor'
  | 'vestibular'
  | 'headache-migraine'
  | 'anxiety-mood'
  | 'sleep-disturbance'
  | 'cervical-strain';

export const SUBTYPE_LABELS: Record<ClinicalSubtype, string> = {
  cognitive: 'cognitive',
  'ocular-motor': 'ocular-motor',
  vestibular: 'vestibular',
  'headache-migraine': 'headache/migraine',
  'anxiety-mood': 'anxiety/mood',
  'sleep-disturbance': 'sleep disturbance',
  'cervical-strain': 'cervical strain',
};

export interface DomainMechanism {
  readonly domain: LoadDomain;
  /** What this domain is measuring, in the patient's terms. */
  readonly loads: string;
  /** Why an injured brain has less room for it. */
  readonly mechanism: string;
  /** Why graded exposure is the treatment rather than avoidance. */
  readonly reexposure: string;
  /** Subtypes a strong signal here resembles. Resemblance, not diagnosis. */
  readonly resembles: readonly ClinicalSubtype[];
  readonly citations: readonly CitationId[];
}

export const DOMAIN_MECHANISMS: Record<LoadDomain, DomainMechanism> = {
  cognitive: {
    domain: 'cognitive',
    loads: 'Sustained attention — following a lesson, tracking a meeting, reading for meaning.',
    mechanism:
      'Concentration is metabolically expensive, and after concussion the brain is in a period ' +
      'of increased energy demand with a reduced ability to meet it. Capacity is a budget that ' +
      'runs down through the day rather than a level of effort that can be raised by trying ' +
      'harder, which is why the same task is manageable at nine in the morning and impossible ' +
      'at three.',
    reexposure:
      'Guidance is explicit that a complete absence from school beyond about a week is not ' +
      'recommended. Cognitive load is reintroduced up to tolerance, not withheld until symptoms ' +
      'are gone.',
    resembles: ['cognitive'],
    citations: ['giza-hovda-2014', 'pedsconcussion-2023', 'lumba-brown-2020'],
  },
  visualVestibular: {
    domain: 'visualVestibular',
    loads: 'Screens, scrolling, travel, crowds, and rooms full of motion.',
    mechanism:
      'Two systems that concussion commonly disturbs are doing continuous work here: the ' +
      'oculomotor system holding gaze steady and converging on near targets, and the vestibular ' +
      'system reconciling head movement with what the eyes report. A scrolling screen and a ' +
      'busy corridor both demand constant re-reconciliation, which is why they feel harder than ' +
      'their apparent difficulty suggests.',
    reexposure:
      'Persisting symptoms in these systems respond to targeted rehabilitation rather than to ' +
      'avoidance, which is one reason a pattern concentrated here is worth naming to a clinician.',
    resembles: ['ocular-motor', 'vestibular'],
    citations: ['lumba-brown-2020', 'amsterdam-2023'],
  },
  physical: {
    domain: 'physical',
    loads: 'Walking, cycling, exercise — anything raising heart rate.',
    mechanism:
      'Exercise intolerance after concussion is partly autonomic: the systems regulating heart ' +
      'rate, blood pressure and cerebral blood flow during exertion are themselves affected, so ' +
      'symptoms appear at a lower workload than usual.',
    reexposure:
      'This is the domain where the guidance changed most. Strict rest beyond the first day or ' +
      'two is no longer recommended, and light aerobic activity below the symptom threshold is ' +
      'now part of treatment rather than something to be earned once symptoms resolve.',
    resembles: ['vestibular'],
    citations: ['amsterdam-2023', 'pedsconcussion-2023'],
  },
  sleepFatigue: {
    domain: 'sleepFatigue',
    loads: 'Sleep shortfall against this person’s own usual night.',
    mechanism:
      'Sleep is when the metabolic recovery this whole model is about actually happens, and ' +
      'concussion frequently disrupts it. That makes disrupted sleep both a symptom and a cause: ' +
      'a short night reduces the next day’s capacity, a reduced day is harder to fill, and the ' +
      'loop closes.',
    reexposure:
      'Sleep is the one domain here that is never restricted. It is a resource, and it is ' +
      'treated as an input to the day rather than a dose to be spent.',
    resembles: ['sleep-disturbance'],
    citations: ['lumba-brown-2020', 'onf-living-adults'],
  },
  emotionalAutonomic: {
    domain: 'emotionalAutonomic',
    loads: 'Noise, crowds, social demand and sustained stress.',
    mechanism:
      'Sensory and social environments impose a continuous load with no natural breaks, and the ' +
      'stress response draws on the same autonomic systems already disturbed by the injury. ' +
      'Irritability and a shorter fuse are common features of the injury rather than a change in ' +
      'character — which matters more to families than almost anything else here.',
    reexposure:
      'Withdrawal is understandable and unhelpful. Social contact is part of relative rest as ' +
      'the guidance describes it, and connecting with peers is named as a goal of returning to ' +
      'school rather than a reward for it.',
    resembles: ['anxiety-mood'],
    citations: ['lumba-brown-2020', 'pedsconcussion-2023'],
  },
};

/**
 * Conditions NaviTBI does not track as a load, stated plainly because leaving
 * them out silently would imply the five domains are the whole picture.
 */
export const UNTRACKED_PRESENTATIONS: readonly {
  readonly subtype: ClinicalSubtype;
  readonly why: string;
}[] = [
  {
    subtype: 'headache-migraine',
    why:
      'A headache/migraine presentation is a symptom pattern rather than an activity that can ' +
      'be dosed, so it shows up here in the daily severity score rather than as a load domain ' +
      'of its own.',
  },
  {
    subtype: 'cervical-strain',
    why:
      'Neck injury frequently accompanies concussion and needs a physical examination to find. ' +
      'Nothing in a daily check-in can detect it, and new neck pain is a red flag that stops ' +
      'this app rather than something it plans around.',
  },
];
