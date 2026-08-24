/**
 * Per-step ceilings on load, by domain.
 *
 * IMPORTANT: every number in this file is a product default. The guidelines are
 * deliberately qualitative here — "minimize screentime", "light walking",
 * "gradual reintroduction of school work" — and inventing numbers and
 * attributing them to a consensus statement would be exactly the kind of
 * false precision the provenance system exists to prevent.
 *
 * What these caps *are* is our conservative reading of that qualitative text,
 * stated in the open so a clinician can disagree with a specific number rather
 * than with the whole system. They are expressed in reference units (see
 * units.ts), so 0.25 means a quarter of a demanding day.
 */

import type { LoadDomain, ProtocolId } from '@/data/guidelines';

export interface StageCap {
  readonly cap: number;
  /** The qualitative guideline text this number is our reading of. */
  readonly readingOf: string;
}

export interface StageFloor {
  readonly floor: number;
  readonly readingOf: string;
}

type CapTable = Record<number, Partial<Record<LoadDomain, StageCap>>>;

const RETURN_TO_LEARN_CAPS: CapTable = {
  1: {
    cognitive: { cap: 0.15, readingOf: 'Activities of daily living and relative rest.' },
    visualVestibular: { cap: 0.1, readingOf: 'Minimize screentime.' },
    physical: { cap: 0.3, readingOf: 'Light walking that does not worsen symptoms.' },
    emotionalAutonomic: { cap: 0.25, readingOf: 'Social interactions at home.' },
  },
  2: {
    cognitive: { cap: 0.45, readingOf: 'Reading or other cognitive activities at school or home.' },
    visualVestibular: { cap: 0.3, readingOf: 'Take breaks and adapt activities.' },
    physical: { cap: 0.6, readingOf: 'Light physical activity as tolerated.' },
    emotionalAutonomic: { cap: 0.5, readingOf: 'Connect socially with peers.' },
  },
  3: {
    cognitive: { cap: 0.8, readingOf: 'Part-time or full days with academic accommodations.' },
    visualVestibular: { cap: 0.65, readingOf: 'Gradual reintroduction of school work.' },
    physical: { cap: 0.85, readingOf: 'Activity without head-impact risk.' },
    emotionalAutonomic: { cap: 0.8, readingOf: 'Tolerating the classroom environment.' },
  },
  4: {
    cognitive: { cap: 1, readingOf: 'Full days without concussion-related accommodations.' },
    visualVestibular: { cap: 1, readingOf: 'Full days without concussion-related accommodations.' },
    physical: { cap: 1, readingOf: 'Full days without concussion-related accommodations.' },
    emotionalAutonomic: { cap: 1, readingOf: 'Full days without concussion-related accommodations.' },
  },
};

const RETURN_TO_SPORT_CAPS: CapTable = {
  1: {
    physical: { cap: 0.3, readingOf: 'Relative rest with light walking.' },
    visualVestibular: { cap: 0.1, readingOf: 'Minimize screentime.' },
  },
  2: { physical: { cap: 0.65, readingOf: 'Aerobic exercise at light to moderate effort.' } },
  3: { physical: { cap: 0.85, readingOf: 'Individual sport-specific activity, no impact risk.' } },
  4: { physical: { cap: 1, readingOf: 'Exercise to high intensity, non-contact.' } },
  5: { physical: { cap: 1, readingOf: 'Full-contact practice.' } },
  6: { physical: { cap: 1, readingOf: 'Unrestricted play.' } },
};

const TABLES: Record<ProtocolId, CapTable> = {
  'return-to-learn': RETURN_TO_LEARN_CAPS,
  'return-to-sport': RETURN_TO_SPORT_CAPS,
};

/**
 * Sleep is never capped — it is a resource, not a load, and telling someone to
 * sleep less is never the recommendation. It enters the model as debt.
 */
export const UNCAPPED_DOMAINS: readonly LoadDomain[] = ['sleepFatigue'];

/** Cap in reference units. Returns 1 (a full ordinary day) where no cap applies. */
export function stageCap(protocol: ProtocolId, step: number, domain: LoadDomain): StageCap {
  if (UNCAPPED_DOMAINS.includes(domain)) {
    return { cap: 1, readingOf: 'Sleep is a resource, not a load, and is never restricted.' };
  }
  return (
    TABLES[protocol][step]?.[domain] ?? {
      cap: 1,
      readingOf: 'No step-specific ceiling for this domain.',
    }
  );
}

/**
 * Minimum activity the guidance supports regardless of what the model thinks.
 *
 * The stage machine supplies a floor as well as a ceiling, and this is not
 * symmetry for its own sake. A model fitted to a patient who is doing almost
 * nothing will predict that almost anything is risky, recommend nothing, and
 * then never see the data that would let it change its mind. Our own evaluation
 * caught exactly that: tolerance collapsing to zero by day five and staying
 * there for the rest of the episode.
 *
 * The guideline is unambiguous that this is the wrong answer. Relative rest
 * explicitly includes activities of daily living and light walking from the
 * first day, and a complete absence from school beyond a week is not
 * recommended. So where the text supports a floor, the floor wins — and the
 * conflict is surfaced to the patient and escalated, never resolved silently.
 */
const FLOORS: Record<ProtocolId, Record<number, Partial<Record<LoadDomain, StageFloor>>>> = {
  'return-to-learn': {
    1: {
      physical: { floor: 0.1, readingOf: 'Light walking is permitted from the first 24-48 hours.' },
      emotionalAutonomic: { floor: 0.06, readingOf: 'Social interactions at home.' },
    },
    2: {
      physical: { floor: 0.15, readingOf: 'Light, symptom-limited physical exercise such as walking.' },
      cognitive: {
        floor: 0.08,
        readingOf: 'Encouragement to return to school as soon as possible, as tolerated.',
      },
      emotionalAutonomic: { floor: 0.1, readingOf: 'Connect socially with peers.' },
    },
    3: {
      physical: { floor: 0.2, readingOf: 'Activity without head-impact risk is appropriate.' },
      cognitive: {
        floor: 0.25,
        readingOf: 'Missing more than one week of school is not generally recommended.',
      },
      emotionalAutonomic: { floor: 0.1, readingOf: 'Tolerating the classroom environment.' },
    },
    4: {
      physical: { floor: 0.2, readingOf: 'Full days without concussion-related accommodations.' },
      cognitive: { floor: 0.3, readingOf: 'Full days without concussion-related accommodations.' },
    },
  },
  'return-to-sport': {
    1: { physical: { floor: 0.1, readingOf: 'Relative rest includes light walking.' } },
    2: { physical: { floor: 0.2, readingOf: 'Aerobic exercise at light effort.' } },
    3: { physical: { floor: 0.25, readingOf: 'Individual sport-specific activity.' } },
    4: { physical: { floor: 0.3, readingOf: 'Exercise to high intensity, non-contact.' } },
    5: { physical: { floor: 0.3, readingOf: 'Full-contact practice.' } },
    6: { physical: { floor: 0.3, readingOf: 'Unrestricted play.' } },
  },
};

export function stageFloor(protocol: ProtocolId, step: number, domain: LoadDomain): StageFloor {
  return (
    FLOORS[protocol][step]?.[domain] ?? {
      floor: 0,
      readingOf: 'No minimum activity is specified for this domain.',
    }
  );
}
