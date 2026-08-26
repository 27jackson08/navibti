/**
 * A mutable handle on the prior means, for the sensitivity re-runs.
 *
 * Reaching into a constant is not something production code should do, which is
 * why it is isolated here and used only by the evaluation harness. The
 * alternative — threading a prior override through six modules that have no
 * other reason to know about one — would make the shipped code worse in order
 * to make a measurement script tidier.
 */

import { PRIOR_MEANS } from '@/engine/tolerance/units';

export { LOAD_DOMAINS } from '@/data/guidelines';

export const PRIOR_MEANS_MUTABLE = PRIOR_MEANS as Record<string, number>;
