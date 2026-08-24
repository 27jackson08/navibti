/**
 * Every clinical claim NaviTBI makes traces back to one of these records.
 *
 * The `id` keys are referenced from protocol steps, thresholds, red flags, and
 * accommodation items, so a reader can follow any number on screen back to the
 * document it came from. Nothing in the guideline layer may assert a clinical
 * fact without one.
 */

export interface Citation {
  readonly id: string;
  readonly shortLabel: string;
  readonly authors: string;
  readonly title: string;
  readonly source: string;
  readonly year: number;
  readonly doi?: string;
  readonly url?: string;
  /** Population the document actually covers. Guards against misapplication. */
  readonly appliesTo: string;
}

export const CITATIONS = {
  'amsterdam-2023': {
    id: 'amsterdam-2023',
    shortLabel: 'Amsterdam 2023 (6th consensus)',
    authors: 'Patricios JS, Schneider KJ, Dvorak J, et al.',
    title:
      'Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport — Amsterdam, October 2022',
    source: 'British Journal of Sports Medicine 2023;57:695-711',
    year: 2023,
    doi: '10.1136/bjsports-2023-106898',
    appliesTo: 'Sport-related concussion, all ages. Supersedes Berlin 2016 (the 5th conference).',
  },
  'pedsconcussion-2023': {
    id: 'pedsconcussion-2023',
    shortLabel: 'PedsConcussion Living Guideline (Sept 2023)',
    authors: 'Ontario Neurotrauma Foundation / PedsConcussion',
    title:
      'Living Guideline Return to Activity/Sport Protocol and Return to School/Learn Protocol',
    source: 'pedsconcussion.com, updated September 2023',
    year: 2023,
    url: 'https://pedsconcussion.com',
    appliesTo:
      'Pediatric concussion care. Protocol tables harmonised with, and modified with permission from, Amsterdam 2023.',
  },
  'onf-living-adults': {
    id: 'onf-living-adults',
    shortLabel: 'Living Concussion Guidelines (adults)',
    authors: 'Ontario Neurotrauma Foundation',
    title:
      'Living Guideline for Diagnosing and Managing Concussion in Adults, including return-to-work guidance',
    source: 'concussionsontario.org',
    year: 2023,
    appliesTo: 'Adults 18+. Source for the adult persisting-symptom escalation window.',
  },
  'crt6-2023': {
    id: 'crt6-2023',
    shortLabel: 'Concussion Recognition Tool 6',
    authors: 'Echemendia RJ, et al.',
    title: 'The Concussion Recognition Tool 6 (CRT6)',
    source: 'British Journal of Sports Medicine 2023;57:692-693',
    year: 2023,
    doi: '10.1136/bjsports-2023-107021',
    appliesTo:
      'Identification of suspected concussion by non-medically-trained people. Explicitly NOT a diagnostic instrument.',
  },
} as const satisfies Record<string, Citation>;

export type CitationId = keyof typeof CITATIONS;

export function citation(id: CitationId): Citation {
  return CITATIONS[id];
}
