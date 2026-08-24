/**
 * Shared vocabulary for the guideline layer.
 *
 * Everything under `src/data/guidelines` is a transcription of published
 * clinical guidance. Nothing here is personalized, learned, or inferred. The
 * tolerance model (`src/engine/tolerance`) may only ever narrow what these
 * records permit — never widen it.
 */

import type { CitationId } from './citations';

export const LOAD_DOMAINS = [
  'cognitive',
  'visualVestibular',
  'physical',
  'sleepFatigue',
  'emotionalAutonomic',
] as const;

export type LoadDomain = (typeof LOAD_DOMAINS)[number];

export const LOAD_DOMAIN_LABELS: Record<LoadDomain, string> = {
  cognitive: 'Thinking and concentration',
  visualVestibular: 'Screens, motion and busy spaces',
  physical: 'Physical activity',
  sleepFatigue: 'Sleep and fatigue',
  emotionalAutonomic: 'Stress, noise and social load',
};

/**
 * Where a number came from.
 *
 * A clinician reading this codebase should be able to tell our engineering
 * choices apart from published thresholds without reading the git history, so
 * every constant that influences a recommendation carries this tag.
 */
export type Provenance =
  /** Stated explicitly in the cited document. `quote` is required. */
  | 'guideline'
  /** Our conservative operational choice. Not attributable to any source. */
  | 'product-default';

export interface Sourced<T> {
  readonly value: T;
  readonly provenance: Provenance;
  readonly citation: CitationId;
  /** Verbatim supporting text. Required when provenance is 'guideline'. */
  readonly quote?: string;
  /** Why we picked this value. Required when provenance is 'product-default'. */
  readonly rationale?: string;
}

export type ProtocolId = 'return-to-learn' | 'return-to-sport';

/**
 * What happens when symptoms exceed the exacerbation threshold at a given step.
 *
 * The two protocols differ here and the difference is clinically meaningful, so
 * it is modelled per-step rather than assumed uniform.
 */
export type ExceedanceAction =
  /** Sport steps 1-3: stop the activity, attempt the same step tomorrow. */
  | { readonly kind: 'stop-and-retry-next-day' }
  /** Sport steps 4-6: drop back to re-establish symptom-free exertion. */
  | { readonly kind: 'return-to-step'; readonly step: number; readonly reason: string }
  /** Learn: slow the progression, but do not withdraw from school. */
  | { readonly kind: 'slow-progression'; readonly reason: string };

export interface ProtocolStep {
  readonly step: number;
  readonly title: string;
  /** Transcribed from the source table's "Activity" column. */
  readonly activity: string;
  /** Transcribed from the source table's "Examples of activities" column. */
  readonly examples: string;
  readonly goal?: string;
  /** Ceiling on time spent at this step, in hours. Null means no ceiling. */
  readonly maxHoursAtStep: number | null;
  readonly minHoursBeforeAdvance: number;
  /** True only where the source requires written medical clearance. */
  readonly requiresMedicalClearance: boolean;
  /** Non-clearance gates, e.g. full return to school before sport step 4. */
  readonly additionalPrerequisites: readonly string[];
  readonly onExceedance: ExceedanceAction;
}

export interface Protocol {
  readonly id: ProtocolId;
  readonly name: string;
  readonly citation: CitationId;
  readonly instructions: string;
  readonly steps: readonly ProtocolStep[];
}

export function stepOf(protocol: Protocol, step: number): ProtocolStep {
  const found = protocol.steps.find((s) => s.step === step);
  if (!found) {
    throw new Error(`${protocol.id} has no step ${step} (valid: 1-${protocol.steps.length})`);
  }
  return found;
}
