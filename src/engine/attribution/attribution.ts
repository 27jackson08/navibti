/**
 * Explaining a bad day.
 *
 * The product claim is narrow on purpose: "most consistent with", never
 * "caused by". We are decomposing a linear prediction, not establishing
 * causation, and a patient reading "your headache was caused by the meetings"
 * would be reading something we have no basis to say.
 *
 * Three situations get an explicit refusal rather than a confident answer,
 * because being wrong here costs trust that the rest of the product depends on:
 *
 *   too little data     the posterior is still mostly prior
 *   the day is unusual  observation and prediction disagree badly enough that
 *                       the model plainly does not understand this day
 *   confounded domains  two loads moved together in this patient's own history,
 *                       so the data cannot separate them however much we would
 *                       like to name one
 */

import {
  DOMAIN_MECHANISMS,
  EXACERBATION_POINT_LIMIT,
  LOAD_DOMAINS,
  LOAD_DOMAIN_LABELS,
  SUBTYPE_LABELS,
  type ClinicalSubtype,
  type Exacerbation,
  type LoadDomain,
} from '@/data/guidelines';
import { joinWords } from '@/lib/list';
import { invertSpd } from '@/engine/tolerance/matrix';
import { isPersonalized, predict, weightOf, type Posterior } from '@/engine/tolerance/posterior';
import { FEATURE_ORDER, normalizeDose } from '@/engine/tolerance/units';

/**
 * How many standard errors apart two contributions must be before we are
 * willing to say one mattered more than the other.
 *
 * A fixed correlation threshold was the obvious first choice and it does not
 * work: calibration (npm run calibrate:confounding) showed that with ten days
 * of data, two domains that move in perfect lockstep still only reach a weight
 * correlation of 0.35, while after eighty days genuinely independent domains
 * sit near 0.02. Any single cutoff either cries confounding constantly late on
 * or misses it entirely early on, which is exactly when patients are forming
 * their opinion of whether the app knows what it is talking about.
 *
 * So the test is the one the product actually needs: is the DIFFERENCE between
 * two contributions distinguishable from zero, given how uncertain we are about
 * both? One standard error is deliberately demanding — this gate exists to stop
 * us naming a cause we cannot support.
 *
 * Not in the guideline provenance system because it changes nothing about what
 * we recommend, only whether we are willing to explain it.
 */
const SEPARATION_STANDARD_ERRORS = 1;

/**
 * How far an observation may sit from the prediction, in predictive standard
 * deviations, before we stop trying to explain it.
 */
const SURPRISE_LIMIT = 2;

/** A contribution below this is noise, not an explanation. */
const MATERIAL_CONTRIBUTION = 0.15;

export interface Contribution {
  readonly domain: LoadDomain;
  readonly dose: number;
  readonly weight: number;
  /** Points of predicted symptom rise attributable to this domain. */
  readonly points: number;
  /** Share of the total predicted rise, ignoring domains that reduce it. */
  readonly share: number;
}

export interface ConfoundedPair {
  readonly domains: readonly [LoadDomain, LoadDomain];
  /** How many standard errors separate the two contributions. Below 1 is a tie. */
  readonly separation: number;
  readonly note: string;
}

export interface Counterfactual {
  readonly domain: LoadDomain;
  readonly actualDose: number;
  readonly alternativeDose: number;
  readonly actualPrediction: number;
  readonly alternativePrediction: number;
  readonly unit: string;
}

export type AttributionOutcome =
  | 'attributed'
  | 'nothing-to-explain'
  | 'not-enough-data'
  | 'day-does-not-match-pattern'
  | 'confounded';

export interface Attribution {
  readonly outcome: AttributionOutcome;
  readonly observedDelta: number;
  readonly predictedDelta: number;
  readonly baseline: number;
  readonly contributions: readonly Contribution[];
  readonly leading: readonly Contribution[];
  readonly confounded: readonly ConfoundedPair[];
  readonly counterfactual: Counterfactual | null;
  /** Patient-facing sentence. Always hedged; never causal. */
  readonly explanation: string;
}

/** Posterior correlation between two weights, from the inverted precision. */
export function weightCorrelation(posterior: Posterior, a: LoadDomain, b: LoadDomain): number {
  const covariance = invertSpd(posterior.precision);
  const i = FEATURE_ORDER.indexOf(a);
  const j = FEATURE_ORDER.indexOf(b);
  const denominator = Math.sqrt(covariance[i][i] * covariance[j][j]);
  return denominator === 0 ? 0 : covariance[i][j] / denominator;
}

/**
 * Standard errors separating two domains' contributions on a given day.
 *
 * Var(wa*xa - wb*xb) = xa²Caa + xb²Cbb - 2·xa·xb·Cab, where C is the posterior
 * covariance of the weights. The covariance term is what carries the
 * confounding: when two loads always move together, Cab is strongly negative,
 * the variance of their difference balloons, and the separation collapses.
 */
export function separationOf(
  posterior: Posterior,
  a: LoadDomain,
  b: LoadDomain,
  doses: Partial<Record<LoadDomain, number>>,
): number {
  const covariance = invertSpd(posterior.precision).map((row) =>
    row.map((value) => (posterior.rate / posterior.shape) * value),
  );
  const i = FEATURE_ORDER.indexOf(a);
  const j = FEATURE_ORDER.indexOf(b);

  const xa = normalizeDose(a, doses[a] ?? 0);
  const xb = normalizeDose(b, doses[b] ?? 0);

  const difference = weightOf(posterior, a) * xa - weightOf(posterior, b) * xb;
  const variance =
    xa * xa * covariance[i][i] + xb * xb * covariance[j][j] - 2 * xa * xb * covariance[i][j];

  if (variance <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(difference) / Math.sqrt(variance);
}

export function findConfounded(
  posterior: Posterior,
  domains: readonly LoadDomain[],
  doses: Partial<Record<LoadDomain, number>>,
): ConfoundedPair[] {
  const pairs: ConfoundedPair[] = [];
  for (let i = 0; i < domains.length; i += 1) {
    for (let j = i + 1; j < domains.length; j += 1) {
      const separation = separationOf(posterior, domains[i], domains[j], doses);
      if (separation >= SEPARATION_STANDARD_ERRORS) continue;
      pairs.push({
        domains: [domains[i], domains[j]],
        separation,
        note:
          `${LOAD_DOMAIN_LABELS[domains[i]].toLowerCase()} and ` +
          `${LOAD_DOMAIN_LABELS[domains[j]].toLowerCase()} look equally likely from your logs so ` +
          'far, so there is no way to tell yet which one matters more.',
      });
    }
  }
  return pairs;
}

export interface AttributionInput {
  readonly posterior: Posterior;
  /** What the patient actually did. */
  readonly doses: Partial<Record<LoadDomain, number>>;
  readonly observed: Exacerbation;
  /** What the plan asked for, used for the counterfactual. */
  readonly recommended?: Partial<Record<LoadDomain, number>>;
}

export function attribute(input: AttributionInput): Attribution {
  const { posterior, doses, observed } = input;
  const predictive = predict(posterior, doses);
  const baseline = weightOf(posterior, 'intercept');

  const contributions = LOAD_DOMAINS.map((domain) => {
    const dose = doses[domain] ?? 0;
    const weight = weightOf(posterior, domain);
    return { domain, dose, weight, points: weight * normalizeDose(domain, dose), share: 0 };
  });

  const totalRise = contributions.reduce((sum, item) => sum + Math.max(0, item.points), 0);
  const scored: Contribution[] = contributions
    .map((item) => ({
      ...item,
      share: totalRise > 0 ? Math.max(0, item.points) / totalRise : 0,
    }))
    .sort((a, b) => b.points - a.points);

  const base = {
    observedDelta: observed.deltaPoints,
    predictedDelta: predictive.mean,
    baseline,
    contributions: scored,
    confounded: [] as ConfoundedPair[],
    counterfactual: null,
  } as const;

  if (observed.deltaPoints <= EXACERBATION_POINT_LIMIT.value) {
    return {
      ...base,
      outcome: 'nothing-to-explain',
      leading: [],
      explanation:
        'Symptoms stayed within the mild range today, so there is nothing here that needs ' +
        'explaining.',
    };
  }

  if (!isPersonalized(posterior)) {
    return {
      ...base,
      outcome: 'not-enough-data',
      leading: [],
      explanation:
        'There are not enough days logged yet to say what this is most consistent with. Keep ' +
        'checking in and this will start to make sense.',
    };
  }

  const surprise = Math.abs(observed.deltaPoints - predictive.mean) / predictive.scale;
  if (surprise > SURPRISE_LIMIT) {
    return {
      ...base,
      outcome: 'day-does-not-match-pattern',
      leading: [],
      explanation:
        'Today does not match the pattern in your other days, so naming a cause would be ' +
        'guessing. If this keeps happening, it is worth mentioning to your clinician.',
    };
  }

  const material = scored.filter((item) => item.points >= MATERIAL_CONTRIBUTION);
  if (material.length === 0) {
    return {
      ...base,
      outcome: 'day-does-not-match-pattern',
      leading: [],
      explanation:
        'Nothing you logged today stands out as a likely driver. Symptoms can rise without an ' +
        'obvious trigger, particularly early on.',
    };
  }

  // Only the leader's separation matters. Two minor contributors being
  // statistically tied says nothing about whether we can name the main driver,
  // and checking every pair among the top three meant a 0.3-point tie between
  // two also-rans suppressed an otherwise clear explanation.
  const leader = material[0];
  const challengers = material.slice(1, 3).map((item) => item.domain);
  const confounded = challengers.length
    ? findConfounded(posterior, [leader.domain, ...challengers], doses).filter((pair) =>
        pair.domains.includes(leader.domain),
      )
    : [];
  const leading = material.slice(0, 2);

  if (confounded.length > 0) {
    return {
      ...base,
      outcome: 'confounded',
      leading,
      confounded,
      explanation: `${confounded[0].note} Both were high today.`,
    };
  }

  const counterfactual = buildCounterfactual(input, leading[0]);

  return {
    ...base,
    outcome: 'attributed',
    leading,
    counterfactual,
    explanation: phrase(leading, counterfactual),
  };
}

function buildCounterfactual(
  input: AttributionInput,
  leader: Contribution,
): Counterfactual | null {
  const alternative = input.recommended?.[leader.domain];
  if (alternative === undefined || alternative >= leader.dose) return null;

  const actualPrediction = predict(input.posterior, input.doses).mean;
  const alternativePrediction = predict(input.posterior, {
    ...input.doses,
    [leader.domain]: alternative,
  }).mean;

  return {
    domain: leader.domain,
    actualDose: leader.dose,
    alternativeDose: alternative,
    actualPrediction,
    alternativePrediction,
    unit: unitFor(leader.domain),
  };
}

function unitFor(domain: LoadDomain): string {
  return domain === 'sleepFatigue' ? 'hours of sleep debt' : 'minutes';
}

function phrase(
  leading: readonly Contribution[],
  counterfactual: Counterfactual | null,
): string {
  const names = leading.map((item) => LOAD_DOMAIN_LABELS[item.domain].toLowerCase());
  // The domain labels contain their own conjunctions ("stress, noise and social
  // load"), so joining two of them with "and" produces "sleep and fatigue and
  // stress, noise and social load". Use a separator that survives that.
  const subject = names.length > 1 ? `${names[0]}, together with ${names[1]}` : names[0];

  const opening = `Today is most consistent with ${subject}.`;
  if (!counterfactual) return opening;

  const { alternativeDose, actualDose, actualPrediction, alternativePrediction, unit } =
    counterfactual;

  return (
    `${opening} At ${Math.round(alternativeDose)} ${unit} instead of ` +
    `${Math.round(actualDose)}, the expected rise would have been about ` +
    `${alternativePrediction.toFixed(1)} points rather than ${actualPrediction.toFixed(1)}.`
  );
}

/**
 * Language we must never use. Exported so the test suite can enforce it across
 * every string this module can emit, and so a future tone pass has a checklist.
 */
export const FORBIDDEN_ATTRIBUTION_LANGUAGE: readonly RegExp[] = [
  /\bcaused by\b/i,
  /\bbecause of\b/i,
  /\bdue to\b/i,
  /\bis the reason\b/i,
  /\bdiagnos/i,
  /\byou must\b/i,
  /\bproves?\b/i,
];

/**
 * Which kind of load this patient is most sensitive to, across everything
 * logged so far.
 *
 * Distinct from attributing a single bad day. This is the standing pattern: not
 * "today was screens" but "screens are consistently what costs you most". It is
 * the closest this product comes to the clinical subtyping literature, and it
 * stops well short of it — subtyping is a judgement made by a clinician with an
 * examination in front of them, and this is self-reported minutes.
 *
 * So the output describes a resemblance and points at a conversation. It never
 * assigns a subtype, and it refuses entirely when the leading weight cannot be
 * told apart from the next one.
 */
export interface SensitivityProfile {
  readonly leading: LoadDomain | null;
  readonly runnerUp: LoadDomain | null;
  /** Standard errors separating the two leading weights. */
  readonly separation: number;
  readonly resembles: readonly ClinicalSubtype[];
  readonly summary: string;
  readonly canDescribe: boolean;
}

/** How many standard errors apart two weights must be to name one over the other. */
const PROFILE_SEPARATION = 1.5;

export function sensitivityProfile(posterior: Posterior): SensitivityProfile {
  const none: SensitivityProfile = {
    leading: null,
    runnerUp: null,
    separation: 0,
    resembles: [],
    canDescribe: false,
    summary:
      'There are not enough check-ins yet to say which kind of load costs you most. This builds ' +
      'up over a couple of weeks.',
  };

  if (!isPersonalized(posterior)) return none;

  // Ranked by sensitivity per unit of load, not by what today happened to
  // contain — the question is what this person is fragile to, not what they did.
  const ranked = LOAD_DOMAINS.filter((domain) => domain !== 'sleepFatigue')
    .map((domain) => ({ domain, weight: weightOf(posterior, domain) }))
    .sort((a, b) => b.weight - a.weight);

  const [first, second] = ranked;
  if (!first || first.weight <= 0) return none;

  const covariance = invertSpd(posterior.precision).map((row) =>
    row.map((value) => (posterior.rate / posterior.shape) * value),
  );
  const i = FEATURE_ORDER.indexOf(first.domain);
  const j = FEATURE_ORDER.indexOf(second.domain);
  const variance = covariance[i][i] + covariance[j][j] - 2 * covariance[i][j];
  const separation = variance > 0 ? (first.weight - second.weight) / Math.sqrt(variance) : 0;

  if (separation < PROFILE_SEPARATION) {
    return {
      ...none,
      leading: null,
      runnerUp: null,
      separation,
      summary:
        `${LOAD_DOMAIN_LABELS[first.domain].toLowerCase()} and ` +
        `${LOAD_DOMAIN_LABELS[second.domain].toLowerCase()} cost you about the same so far, so ` +
        'there is no single pattern to point at yet.',
    };
  }

  const mechanism = DOMAIN_MECHANISMS[first.domain];
  const resembling = joinWords(
    mechanism.resembles.map((subtype) => SUBTYPE_LABELS[subtype]),
    'or',
  );

  return {
    leading: first.domain,
    runnerUp: second.domain,
    separation,
    resembles: mechanism.resembles,
    canDescribe: true,
    summary:
      `Across your check-ins, ${LOAD_DOMAIN_LABELS[first.domain].toLowerCase()} costs you more ` +
      `than anything else you log. Patterns concentrated there are often described as a ` +
      `${resembling} presentation, which has specific treatments — worth raising at your next ` +
      'appointment rather than acting on here.',
  };
}
