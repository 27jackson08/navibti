/**
 * Turning a posterior into a dose someone can act on.
 *
 * The recommendation for a domain is the smallest of three numbers:
 *
 *   model tolerance  the largest dose whose predicted exceedance probability
 *                    stays at or under the target
 *   ramp cap         at most a fifth more than yesterday actually tolerated
 *   stage cap        the ceiling for the protocol step the patient is on
 *
 * Reporting WHICH of the three bound the recommendation is not a nicety. It is
 * the difference between "we think you can do 40 minutes" and "the guideline
 * says 40 minutes at this stage regardless of what we think", and patients act
 * on those differently.
 */

import {
  EXACERBATION_POINT_LIMIT,
  LOAD_DOMAINS,
  MAX_DAILY_RAMP_FRACTION,
  MAX_RECOMMENDED_LOAD,
  RAMP_FLOOR_INCREMENT,
  TOLERANCE_EXCEEDANCE_QUANTILE,
  UNDER_EXPOSURE_CONSECUTIVE_DAYS,
  UNDER_EXPOSURE_HEADROOM_FRACTION,
  type LoadDomain,
  type ProtocolId,
} from '@/data/guidelines';
import type { ToleranceBand } from '@/data/accommodations';
import { exceedanceProbability, isPersonalized, predict, type Posterior } from './posterior';
import { stageCap, stageFloor } from './stage-caps';
import { REFERENCE_DOSES, denormalizeDose, normalizeDose } from './units';

export type BindingConstraint = 'model' | 'ramp' | 'stage' | 'floor' | 'environment';

export interface DomainRecommendation {
  readonly domain: LoadDomain;
  /** In the domain's natural unit — minutes, hours of debt — not normalised. */
  readonly dose: number;
  readonly unit: string;
  readonly modelTolerance: number;
  readonly rampCap: number;
  readonly stageCap: number;
  readonly binding: BindingConstraint;
  /** Chance this dose breaches the 2-point limit, under the posterior predictive. */
  readonly exceedanceProbability: number;
  readonly band: ToleranceBand;
  /** True while the posterior is still dominated by the prior. */
  readonly isProvisional: boolean;
  readonly stageCapReadingOf: string;
  /**
   * The rest of the day this dose was solved against. Exposed because the
   * number is only meaningful relative to it — "90 minutes of screens, given
   * the four hours of class already in your plan" — and because an evaluation
   * that compared against a different baseline would be measuring nothing.
   */
  readonly solvedContext: Partial<Record<LoadDomain, number>>;
  /**
   * True when the guideline's minimum activity exceeded what the model would
   * have allowed. The floor wins, but never silently: the patient is told, and
   * the safety layer escalates.
   */
  readonly belowModelTolerance: boolean;
  readonly floorReadingOf: string;
  /** Below 1 when a recipient has reported a load-bearing support unavailable. */
  readonly environmentFactor: number;
  /**
   * True when the guideline's minimum activity exceeds what the environment can
   * currently support. Surfaced rather than resolved: that is a conversation
   * between the patient, the school and the clinician, not a number to pick.
   */
  readonly environmentConflict: boolean;
}

/** See MAX_RECOMMENDED_LOAD — held in the provenance system, not as a literal here. */
const SEARCH_CEILING = MAX_RECOMMENDED_LOAD.value;

/** Search resolution. Numerical rather than clinical: finer costs time, not safety. */
const GRID_STEPS = 240;

/**
 * The largest normalised dose for `domain` whose exceedance probability stays
 * within target, holding the other domains at `context`.
 *
 * Deliberately finds the FIRST crossing rather than the largest safe point.
 * With a negative learned weight the risk curve can be non-monotonic, and a
 * larger dose beyond an unsafe region is not something a patient could reach by
 * increasing gradually — so it is not a dose we should ever name.
 */
export function solveTolerance(
  posterior: Posterior,
  domain: LoadDomain,
  context: Partial<Record<LoadDomain, number>>,
): number {
  const limit = EXACERBATION_POINT_LIMIT.value;
  const target = TOLERANCE_EXCEEDANCE_QUANTILE.value;

  /*
   * Judged on the absolute predicted rise, not on the rise attributable to
   * activity alone — which is not the obvious choice, so here is the measurement.
   *
   * The guideline threshold is a rise *during activity*, and the intercept of
   * this model absorbs whatever happens on a near-rest day: baseline
   * instability, a bad night, the natural course of the injury. Counting that
   * toward an activity limit looks like a mistake, and telling a patient with an
   * unstable baseline to do nothing is exactly the over-restriction this product
   * exists to avoid. So the alternative was implemented and swept
   * (npm run sweep), on one cohort, both framings:
   *
   *   framing        alpha  unsafe  over-estimated  load  floor-rescued
   *   absolute       0.20     6.5%            0.0%  0.27           63%
   *   attributable   0.05     6.0%            1.4%  0.24           89%
   *   attributable   0.07     8.0%            2.8%  0.28           75%
   *
   * The absolute framing dominates: at matched safety it permits more load with
   * no over-estimation, and at matched load it is safer. The intercept is not
   * only noise — it carries real information about how fragile this patient is
   * right now, and discarding it loses more signal than the baseline-instability
   * concern costs. Baseline instability is handled where it belongs instead, by
   * the clinician escalation on floor-day risk.
   */
  const riskAt = (normalized: number): number => {
    const doses = { ...context, [domain]: denormalizeDose(domain, normalized) };
    return exceedanceProbability(predict(posterior, doses), limit);
  };

  if (riskAt(0) > target) return 0;

  let safe = 0;
  let unsafe = -1;
  for (let i = 1; i <= GRID_STEPS; i += 1) {
    const point = (i / GRID_STEPS) * SEARCH_CEILING;
    if (riskAt(point) > target) {
      unsafe = point;
      break;
    }
    safe = point;
  }
  if (unsafe < 0) return SEARCH_CEILING;

  for (let i = 0; i < 40; i += 1) {
    const mid = (safe + unsafe) / 2;
    if (riskAt(mid) > target) unsafe = mid;
    else safe = mid;
  }
  return safe;
}

/**
 * Yesterday plus a fifth — with a floor, so a day at zero cannot pin the ramp
 * at zero forever. Without the floor, one fully rested day would make every
 * subsequent recommendation zero, which is both wrong and the opposite of what
 * the anti-strict-rest guidance asks for.
 */
export function rampCap(domain: LoadDomain, yesterdayDose: number | undefined): number {
  const floorIncrement = RAMP_FLOOR_INCREMENT.value;
  const yesterday = normalizeDose(domain, yesterdayDose ?? 0);
  return Math.max(yesterday * (1 + MAX_DAILY_RAMP_FRACTION.value), yesterday + floorIncrement);
}

export function toBand(normalizedDose: number): ToleranceBand {
  if (normalizedDose < 0.25) return 'very-low';
  if (normalizedDose < 0.5) return 'low';
  if (normalizedDose < 0.85) return 'moderate';
  return 'near-full';
}

export interface PlanInput {
  readonly posterior: Posterior;
  /** The protocol governing physical progression. */
  readonly protocol: ProtocolId;
  readonly step: number;
  /**
   * The Return-to-Learn step, which governs every non-physical domain.
   *
   * The two ladders run in parallel -- Amsterdam is explicit that they do, and
   * that sport step 4 cannot be reached without a full return to school. A
   * student athlete is on both at once, and treating them as one ladder is how
   * a patient on Return-to-Sport ends up with no cognitive floor at all and
   * gets told to do zero minutes of screens.
   *
   * Defaults to `step`, which is correct when the patient is on
   * Return-to-Learn alone.
   */
  readonly learnStep?: number;
  /**
   * Per-domain multiplier reflecting support the environment has reported it
   * cannot provide. 1 means everything asked for is available.
   *
   * Computed outside this module, from recipient responses and the
   * accommodation library, so the tolerance engine stays independent of both.
   */
  readonly environmentFactor?: Partial<Record<LoadDomain, number>>;
  /** A recent typical day, used to hold the other domains fixed while solving. */
  readonly context: Partial<Record<LoadDomain, number>>;
  readonly yesterday: Partial<Record<LoadDomain, number>>;
}

/**
 * Which ladder governs a domain. Physical progression follows the patient's
 * primary protocol; everything else follows Return-to-Learn.
 */
export function ladderFor(
  input: PlanInput,
  domain: LoadDomain,
): { protocol: ProtocolId; step: number } {
  if (domain === 'physical' || input.protocol === 'return-to-learn') {
    return { protocol: input.protocol, step: input.step };
  }
  return { protocol: 'return-to-learn', step: input.learnStep ?? input.step };
}

export function recommendDomain(input: PlanInput, domain: LoadDomain): DomainRecommendation {
  const ladder = ladderFor(input, domain);
  const model = solveTolerance(input.posterior, domain, input.context);
  const ramp = rampCap(domain, input.yesterday[domain]);
  const stage = stageCap(ladder.protocol, ladder.step, domain);

  const floor = stageFloor(ladder.protocol, ladder.step, domain);

  const candidates = [
    { value: model, binding: 'model' as const },
    { value: ramp, binding: 'ramp' as const },
    { value: stage.cap, binding: 'stage' as const },
  ];
  const capped = candidates.reduce((lowest, candidate) =>
    candidate.value < lowest.value ? candidate : lowest,
  );

  // The floor is the one constraint that raises rather than lowers. It applies
  // last so it can override a model that has talked itself into recommending
  // nothing at all.
  // What the environment can actually deliver. An accommodation that is what
  // makes a dose safe, reported unavailable, lowers that dose — the plan adapts
  // to the room the patient is actually in.
  const environmentFactor = input.environmentFactor?.[domain] ?? 1;
  const afterEnvironment = capped.value * environmentFactor;

  const belowFloor = afterEnvironment < floor.floor;
  const normalized = belowFloor ? floor.floor : afterEnvironment;
  const binding: BindingConstraint = belowFloor
    ? 'floor'
    : environmentFactor < 1 && afterEnvironment < capped.value
      ? 'environment'
      : capped.binding;

  const dose = denormalizeDose(domain, normalized);

  return {
    domain,
    dose,
    unit: REFERENCE_DOSES[domain].unit,
    modelTolerance: denormalizeDose(domain, model),
    rampCap: denormalizeDose(domain, ramp),
    stageCap: denormalizeDose(domain, stage.cap),
    binding,
    exceedanceProbability: exceedanceProbability(
      predict(input.posterior, { ...input.context, [domain]: dose }),
      EXACERBATION_POINT_LIMIT.value,
    ),
    band: toBand(normalized),
    isProvisional: !isPersonalized(input.posterior),
    stageCapReadingOf: stage.readingOf,
    solvedContext: { ...input.context, [domain]: 0 },
    belowModelTolerance: belowFloor && floor.floor > model,
    floorReadingOf: floor.readingOf,
    environmentFactor,
    environmentConflict: belowFloor && environmentFactor < 1,
  };
}

/**
 * Order in which the day's load is allocated.
 *
 * Physical first, deliberately: it is the domain the guidance actively wants
 * protected, and allocating it last would let cognitive and screen load crowd
 * out the walk that the anti-strict-rest evidence supports.
 */
const ALLOCATION_ORDER: readonly LoadDomain[] = [
  'physical',
  'cognitive',
  'visualVestibular',
  'emotionalAutonomic',
];

/**
 * Sleep debt is a constraint on the day, not a quantity to spend. We report a
 * ceiling for it, but allocating it would amount to recommending that someone
 * accrue sleep debt.
 */
const NOT_ALLOCATED: readonly LoadDomain[] = ['sleepFatigue'];

/**
 * Builds a coherent day, one domain at a time.
 *
 * Solving each domain independently against yesterday's day and then
 * recommending all five at once is wrong, and wrong in the dangerous
 * direction: every individual dose is inside the limit given the others held
 * low, while the combined day is heavier than any of those scenarios assumed.
 * Our own evaluation harness caught this producing a 60% unsafe rate.
 *
 * So each domain is solved against the load already allocated. Domains not yet
 * reached stay at their recent values, on the assumption that the rest of the
 * day looks like yesterday until we decide otherwise. The consequence is
 * clinically right as well as safer: a day with three hours of screens genuinely
 * does leave less room for meetings, and the plan should say so.
 */
/**
 * A day built entirely from guideline minimums, with sleep left as it actually
 * is because no plan can prescribe it.
 */
export function minimumDay(input: PlanInput): Partial<Record<LoadDomain, number>> {
  return Object.fromEntries(
    LOAD_DOMAINS.map((domain) => {
      if (domain === 'sleepFatigue') return [domain, input.context[domain] ?? 0];
      const ladder = ladderFor(input, domain);
      return [
        domain,
        denormalizeDose(domain, stageFloor(ladder.protocol, ladder.step, domain).floor),
      ];
    }),
  );
}

/**
 * How likely the model thinks a guideline-minimum day is to breach the limit.
 *
 * If even this is predicted to flare, the answer is not a smaller number — there
 * is no smaller number the guidance supports — so it is a question for a
 * clinician. Exposed separately so callers with history can require the signal
 * to persist before acting on it.
 */
export function floorDayRisk(input: PlanInput): number {
  return exceedanceProbability(
    predict(input.posterior, minimumDay(input)),
    EXACERBATION_POINT_LIMIT.value,
  );
}

export interface DayPlan {
  readonly recommendations: readonly DomainRecommendation[];
  readonly doses: Partial<Record<LoadDomain, number>>;
  /**
   * Risk of the whole day, not of any single domain. This is the number that
   * matters: five individually-safe doses can add up to an unsafe day, and
   * checking only the margins is how that gets missed.
   */
  readonly jointExceedanceProbability: number;
  /**
   * The model believes even a minimal day -- every domain at the guideline's
   * own activity floor -- would breach the limit.
   *
   * Deliberately NOT "some domain solved to zero". Under sequential allocation
   * a late domain reaching zero just means the day is already full, which is
   * ordinary. Flagging that fired on well over half of all simulated days and
   * would have trained every user to ignore the warning.
   */
  readonly needsClinicianReview: boolean;
  readonly isProvisional: boolean;
  readonly floorOverrodeModel: boolean;
}

export function planDay(input: PlanInput): DayPlan {
  const recommendations = new Map<LoadDomain, DomainRecommendation>();
  let running: Partial<Record<LoadDomain, number>> = { ...input.context };

  for (const domain of ALLOCATION_ORDER) {
    const context = { ...running, [domain]: 0 };
    const recommendation = recommendDomain({ ...input, context }, domain);
    recommendations.set(domain, recommendation);
    running = { ...running, [domain]: recommendation.dose };
  }

  for (const domain of NOT_ALLOCATED) {
    const context = { ...running, [domain]: 0 };
    recommendations.set(domain, recommendDomain({ ...input, context }, domain));
  }

  const ordered = LOAD_DOMAINS.map((domain) => {
    const recommendation = recommendations.get(domain);
    if (!recommendation) throw new Error(`no recommendation produced for ${domain}`);
    return recommendation;
  });

  const doses = Object.fromEntries(ordered.map((item) => [item.domain, item.dose]));


  return {
    recommendations: ordered,
    doses,
    jointExceedanceProbability: exceedanceProbability(
      predict(input.posterior, doses),
      EXACERBATION_POINT_LIMIT.value,
    ),
    needsClinicianReview: floorDayRisk(input) > TOLERANCE_EXCEEDANCE_QUANTILE.value,
    isProvisional: !isPersonalized(input.posterior),
    floorOverrodeModel: ordered.some((item) => item.belowModelTolerance),
  };
}



/**
 * At most this many increase prompts per day. Product default: more than two
 * asks at once reads as pressure rather than guidance, and pressure is the
 * failure mode this whole product exists to reduce.
 */
const MAX_UNDER_EXPOSURE_PROMPTS = 2;

export interface UnderExposure {
  readonly domain: LoadDomain;
  readonly days: number;
  readonly typicalDose: number;
  readonly tolerance: number;
  readonly message: string;
}

/**
 * Detects avoidance — sustained load well under tolerance while symptoms are
 * steady.
 *
 * This is the direction no other pacing tool looks in. Strict rest beyond the
 * first day or two is not recommended, so a patient sitting at a third of their
 * tolerance for days is a problem to name, not a success to celebrate.
 */
export function detectUnderExposure(
  history: readonly { doses: Partial<Record<LoadDomain, number>>; deltaPoints: number }[],
  tolerances: Record<LoadDomain, number>,
): UnderExposure[] {
  const window = UNDER_EXPOSURE_CONSECUTIVE_DAYS.value;
  if (history.length < window) return [];

  const recent = history.slice(-window);
  const symptomsSteady = recent.every(
    (day) => day.deltaPoints <= EXACERBATION_POINT_LIMIT.value,
  );
  if (!symptomsSteady) return [];

  const findings: UnderExposure[] = [];
  for (const domain of LOAD_DOMAINS) {
    if (domain === 'sleepFatigue') continue;

    const tolerance = tolerances[domain];
    // A collapsed estimate is exactly when avoidance matters most, so a zero
    // tolerance must not silence this check -- it previously did.
    if (tolerance <= 0) continue;

    // A domain the check-in never asked about is not evidence of avoidance.
    // Treating absent data as a logged zero would nag people about activities
    // they were never given the chance to report.
    const doses = recent.map((day) => day.doses[domain]);
    if (doses.some((dose) => dose === undefined)) continue;

    const threshold = tolerance * UNDER_EXPOSURE_HEADROOM_FRACTION.value;
    if (!doses.every((dose) => (dose as number) < threshold)) continue;

    const typical = (doses as number[]).reduce((sum, dose) => sum + dose, 0) / doses.length;
    findings.push({
      domain,
      days: window,
      typicalDose: typical,
      tolerance,
      message:
        `You have stayed well under what you seem able to tolerate for ${window} days without ` +
        'symptoms rising. Resting more than this is not what the guidance recommends — there ' +
        'is room to do a little more.',
    });
  }
  // A person recovering from concussion should not be handed five nags. Rank by
  // how far below tolerance they are and surface only the widest gaps; the rest
  // will still be there tomorrow if they matter.
  return findings
    .sort((a, b) => a.typicalDose / a.tolerance - b.typicalDose / b.tolerance)
    .slice(0, MAX_UNDER_EXPOSURE_PROMPTS);
}
