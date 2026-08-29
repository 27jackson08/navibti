/**
 * What the environment can actually deliver.
 *
 * Recipients report accommodations they cannot provide. Some of those are what
 * make a dose safe in the first place — forty minutes of class is tolerable
 * because a break follows it. When such a support is unavailable, the dose that
 * depended on it has to come down.
 *
 * Kept separate from the tolerance engine so that engine stays independent of
 * the accommodation library, and separate from the store so it can be tested
 * without one.
 */

import { ACCOMMODATION_LIBRARY, type Accommodation } from '@/data/accommodations';
import { LOAD_DOMAINS, type LoadDomain } from '@/data/guidelines';

export type EnvironmentFactor = Partial<Record<LoadDomain, number>>;

/**
 * Multipliers per domain, from the supports a recipient says are unavailable.
 *
 * Multiplicative rather than additive: two missing supports for the same domain
 * compound, because each was carrying part of the same load.
 */
export function environmentFactorFrom(
  unavailable: ReadonlySet<string>,
  library: readonly Accommodation[] = ACCOMMODATION_LIBRARY,
): EnvironmentFactor {
  const factor: EnvironmentFactor = {};

  for (const item of library) {
    if (!item.supportsLoad) continue;
    if (!unavailable.has(item.id)) continue;

    const { domain, withoutIt } = item.supportsLoad;
    factor[domain] = (factor[domain] ?? 1) * withoutIt;
  }

  return factor;
}

export interface UnmetSupport {
  readonly accommodationId: string;
  readonly domain: LoadDomain;
  readonly text: string;
  readonly role: Accommodation['role'];
}

/** The unavailable supports, described, for the patient and clinician views. */
export function unmetSupports(
  unavailable: ReadonlySet<string>,
  library: readonly Accommodation[] = ACCOMMODATION_LIBRARY,
): UnmetSupport[] {
  return library
    .filter((item) => unavailable.has(item.id))
    .map((item) => ({
      accommodationId: item.id,
      domain: item.domain,
      // The label where the sentence carries figures. This is a record of what
      // was declined, not an instruction for today, and re-rendering it with
      // today's numbers made a declined cap of one meeting read "Cap live
      // meetings at 0 per day" once a clinician restricted the domain.
      text: item.shortLabel ?? item.text,
      role: item.role,
    }));
}

/** Domains left with no support at all in a packet, after removals. */
export function domainsLeftUnsupported(
  selected: readonly Accommodation[],
  unavailable: ReadonlySet<string>,
): LoadDomain[] {
  const covered = new Set(
    selected.filter((item) => !unavailable.has(item.id)).map((item) => item.domain),
  );
  const wanted = new Set(selected.map((item) => item.domain));

  return LOAD_DOMAINS.filter((domain) => wanted.has(domain) && !covered.has(domain));
}
