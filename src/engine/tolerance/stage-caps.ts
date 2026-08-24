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
