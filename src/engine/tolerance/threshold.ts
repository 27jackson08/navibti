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
  TOLERANCE_EXCEEDANCE_QUANTILE,
  UNDER_EXPOSURE_CONSECUTIVE_DAYS,
  UNDER_EXPOSURE_HEADROOM_FRACTION,
  type LoadDomain,
  type ProtocolId,
} from '@/data/guidelines';
import type { ToleranceBand } from '@/data/accommodations';
import { exceedanceProbability, isPersonalized, predict, type Posterior } from './posterior';
import { stageCap } from './stage-caps';
import { REFERENCE_DOSES, denormalizeDose, normalizeDose } from './units';

export type BindingConstraint = 'model' | 'ramp' | 'stage';

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
}

/**
 * How far above a full reference day we are willing to search. Nothing is
 * recommended beyond this even if the model would allow it — a tolerance
 * estimate of "three ordinary days of screens" is a modelling artefact, not a
 * recommendation.
 */
const SEARCH_CEILING = 1.5;
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
  const floorIncrement = 0.1;
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
  readonly protocol: ProtocolId;
  readonly step: number;
  /** A recent typical day, used to hold the other domains fixed while solving. */
  readonly context: Partial<Record<LoadDomain, number>>;
  readonly yesterday: Partial<Record<LoadDomain, number>>;
}

export function recommendDomain(input: PlanInput, domain: LoadDomain): DomainRecommendation {
  const model = solveTolerance(input.posterior, domain, input.context);
  const ramp = rampCap(domain, input.yesterday[domain]);
  const stage = stageCap(input.protocol, input.step, domain);

  const candidates = [
    { value: model, binding: 'model' as const },
    { value: ramp, binding: 'ramp' as const },
    { value: stage.cap, binding: 'stage' as const },
  ];
  const winner = candidates.reduce((lowest, candidate) =>
    candidate.value < lowest.value ? candidate : lowest,
  );

  const dose = denormalizeDose(domain, winner.value);

  return {
    domain,
    dose,
    unit: REFERENCE_DOSES[domain].unit,
    modelTolerance: denormalizeDose(domain, model),
    rampCap: denormalizeDose(domain, ramp),
    stageCap: denormalizeDose(domain, stage.cap),
    binding: winner.binding,
    exceedanceProbability: exceedanceProbability(
      predict(input.posterior, { ...input.context, [domain]: dose }),
      EXACERBATION_POINT_LIMIT.value,
    ),
    band: toBand(winner.value),
    isProvisional: !isPersonalized(input.posterior),
    stageCapReadingOf: stage.readingOf,
  };
}

export function planDay(input: PlanInput): DomainRecommendation[] {
  return LOAD_DOMAINS.map((domain) => recommendDomain(input, domain));
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
