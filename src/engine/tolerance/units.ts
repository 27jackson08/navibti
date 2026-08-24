/**
 * Dose units and the prior.
 *
 * Doses are normalised into "reference units" — roughly what a demanding but
 * unremarkable day looks like for that domain — so a weight is readable as
 * "points of symptom increase at one reference unit of this load". Without
 * that normalisation the prior means would be uninterpretable and the
 * regression poorly conditioned.
 *
 * Every value here is a product default. No guideline specifies dose units or
 * prior beliefs, and pretending otherwise would misuse the citation system.
 */

import { LOAD_DOMAINS, type LoadDomain } from '@/data/guidelines';

export const FEATURE_ORDER = ['intercept', ...LOAD_DOMAINS] as const;
export type Feature = (typeof FEATURE_ORDER)[number];
export const FEATURE_COUNT = FEATURE_ORDER.length;

export interface DomainUnit {
  readonly reference: number;
  readonly unit: string;
  readonly description: string;
}

export const REFERENCE_DOSES: Record<LoadDomain, DomainUnit> = {
  cognitive: {
    reference: 240,
    unit: 'focused minutes',
    description: 'Classes, meetings, reading and deep work that require concentration.',
  },
  visualVestibular: {
    reference: 240,
    unit: 'exposure minutes',
    description: 'Screens, travel and motion, and visually busy environments.',
  },
  physical: {
    reference: 60,
    unit: 'exertion-weighted minutes',
    description: 'Active minutes scaled by perceived exertion.',
  },
  sleepFatigue: {
    reference: 3,
    unit: 'hours of sleep debt',
    description: 'Shortfall against the person’s own usual sleep, not a population average.',
  },
  emotionalAutonomic: {
    reference: 240,
    unit: 'exposure minutes',
    description: 'Noise, crowds, social demand and sustained stress.',
  },
};

/**
 * Prior means, in points of symptom increase per reference unit.
 *
 * Deliberately weakly POSITIVE rather than zero. A zero-mean prior encodes the
 * belief that load has no effect on symptoms, which is clinically wrong and
 * would make the first few days of recommendations too permissive — exactly
 * when the model knows least and the patient is most vulnerable.
 */
export const PRIOR_MEANS: Record<Feature, number> = {
  intercept: 0.2,
  cognitive: 1.2,
  visualVestibular: 1.2,
  physical: 0.6,
  sleepFatigue: 1.5,
  emotionalAutonomic: 0.9,
};

/**
 * Prior precision, readable as "how many observations this belief is worth".
 * Low, so a handful of real days can overrule it.
 */
export const PRIOR_PRECISION: Record<Feature, number> = {
  intercept: 2,
  cognitive: 1.5,
  visualVestibular: 1.5,
  physical: 1.5,
  sleepFatigue: 1.5,
  emotionalAutonomic: 1.5,
};

/** Inverse-gamma prior on the noise variance. df starts at 2a = 5, so tails are fat. */
export const PRIOR_SHAPE = 2.5;
export const PRIOR_RATE = 1.8;

export function normalizeDose(domain: LoadDomain, dose: number): number {
  return dose / REFERENCE_DOSES[domain].reference;
}

export function denormalizeDose(domain: LoadDomain, normalized: number): number {
  return normalized * REFERENCE_DOSES[domain].reference;
}

/** Builds the design row: intercept first, then each domain in a fixed order. */
export function featureVector(doses: Partial<Record<LoadDomain, number>>): number[] {
  return FEATURE_ORDER.map((feature) =>
    feature === 'intercept' ? 1 : normalizeDose(feature, doses[feature] ?? 0),
  );
}

export function featureIndex(feature: Feature): number {
  return FEATURE_ORDER.indexOf(feature);
}
