/**
 * The evaluation harness.
 *
 * Turns "we built a model" into "we measured our model". Runs a synthetic
 * cohort with known ground truth through three policies and reports whether
 * the recommendations would actually have kept people inside the guideline
 * limit — plus whether the personalization earns its place against a
 * guideline-only baseline.
 *
 * Run with: npm run eval
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { LOAD_DOMAINS } from '@/data/guidelines';
import { makeCohort } from '@/data/synthetic/patient';
import { simulatePatient, summarize, type CohortMetrics, type Policy } from '@/data/synthetic/simulate';

const COHORT_SIZE = Number(process.env.COHORT_SIZE ?? 200);
const DAYS = Number(process.env.DAYS ?? 21);
const POLICIES: Policy[] = ['navitbi', 'stage-only', 'model-only'];

const cohort = makeCohort(COHORT_SIZE);

const byPolicy = Object.fromEntries(
  POLICIES.map((policy) => [
    policy,
    summarize(cohort.map((patient) => simulatePatient(patient, DAYS, policy))),
  ]),
) as Record<Policy, CohortMetrics>;

const shipped = byPolicy.navitbi;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const round = (value: number, places = 3) =>
  Number.isFinite(value) ? Number(value.toFixed(places)) : null;

const report = {
  generatedFor: { cohortSize: COHORT_SIZE, days: DAYS, domains: LOAD_DOMAINS },
  caveat:
    'Evaluated on synthetic patients with known ground truth. Not validated in humans. ' +
    'Not a medical device.',
  byPolicy,
};

mkdirSync('results', { recursive: true });
writeFileSync('results/evaluation.json', `${JSON.stringify(report, null, 2)}\n`);

const errorTable = shipped.toleranceErrorByDay
  .map((error, day) => `| ${day + 1} | ${round(error) ?? '—'} |`)
  .join('\n');

const markdown = `# NaviTBI evaluation

Synthetic cohort of ${COHORT_SIZE} patients over ${DAYS} days, generated from known
ground-truth coefficients. Sensitivity decays over time, so the model is fitting a
moving target rather than a stationary one.

**Evaluated on synthetic patients with known ground truth. Not validated in humans.
Not a medical device.**

## Headline

| Metric | Result |
|---|---|
| Recommendations that would have breached the 2-point limit | **${percent(shipped.unsafeRecommendationRate)}** |
| Red-flag halt recall | ${percent(shipped.redFlagRecall)} (${shipped.redFlagPatients} patients) |
| Estimates that exceeded true tolerance | ${percent(shipped.overEstimationRate)} |
| Mean signed tolerance error | ${round(shipped.meanSignedError)} reference units |
| Domain-days where the model recommended nothing | ${percent(shipped.collapsedToleranceRate)} |
| Days the guideline floor overrode the model | ${percent(shipped.floorRescuedDayShare)} |
| Days flagged for clinician review | ${percent(shipped.clinicianReviewDayShare)} |
| — of those, in the first four days | ${percent(shipped.clinicianReviewFirstFourDays)} |
| — from day 8 onward | ${percent(shipped.clinicianReviewAfterDaySeven)} |
| Patient-days simulated | ${shipped.simulatedDays} |

Each day is simulated twice: once at the dose NaviTBI recommended, once at the dose
the patient actually took. The model learns from what they actually did; the safety
rate is measured against the recommendation, because a patient who overshoots by 50%
has not been failed by the plan.

## Does the personalization earn its place?

| Policy | Unsafe recommendations | Mean recommended load |
|---|---|---|
| NaviTBI — min(model, ramp, stage) | ${percent(byPolicy.navitbi.unsafeRecommendationRate)} | ${round(byPolicy.navitbi.meanRecommendedLoad)} |
| Guideline ceiling only, no personalization | ${percent(byPolicy['stage-only'].unsafeRecommendationRate)} | ${round(byPolicy['stage-only'].meanRecommendedLoad)} |
| Model only, both guardrails removed | ${percent(byPolicy['model-only'].unsafeRecommendationRate)} | ${round(byPolicy['model-only'].meanRecommendedLoad)} |

Load is expressed as a fraction of an ordinary demanding day.

### How to read that table

The "guideline ceiling only" row is **not** a claim that the published guidelines are
unsafe. Those ceilings are our own numeric reading of deliberately qualitative text
(see \`src/engine/tolerance/stage-caps.ts\`), and the guidelines pair them with clinical
judgement that a fixed table cannot carry.

What the row does show is narrower and still worth something: a single fixed ceiling,
applied to a population whose true sensitivity varies widely, is unsafe for a large
share of that population. Between-patient variance is exactly what personalization
addresses — and note that the synthetic cohort is *generated* with wide variance, so
this result partly reflects that design choice rather than a measured fact about real
patients.

The "model only" row is the more honest test of the guardrails, and it is the one that
matters: removing the stage ceiling, the ramp and the floor makes the system less safe
while recommending only slightly more load.

## What bound the recommendation

| Constraint | Share of decisions |
|---|---|
| Stage ceiling | ${percent(shipped.bindingShare.stage)} |
| Ramp cap | ${percent(shipped.bindingShare.ramp)} |
| Model tolerance | ${percent(shipped.bindingShare.model)} |
| Guideline activity floor | ${percent(shipped.bindingShare.floor)} |

## Tolerance error by day

Mean absolute error between estimated and true tolerance, in reference units,
averaged across all five load domains.

| Day | Error |
|---|---|
${errorTable}
`;

writeFileSync('results/evaluation.md', markdown);

console.log(`cohort ${COHORT_SIZE} × ${DAYS} days = ${shipped.simulatedDays} patient-days\n`);
for (const policy of POLICIES) {
  const metrics = byPolicy[policy];
  console.log(
    `${policy.padEnd(12)} unsafe ${percent(metrics.unsafeRecommendationRate).padStart(6)}` +
      `   mean load ${round(metrics.meanRecommendedLoad, 2)}`,
  );
}
console.log(
  `\nover-estimation  ${percent(shipped.overEstimationRate)}` +
    `   signed error ${round(shipped.meanSignedError, 2)}` +
    `   collapsed ${percent(shipped.collapsedToleranceRate)}`,
);
console.log(
  `floor rescued    ${percent(shipped.floorRescuedDayShare)} of days` +
    `   review: overall ${percent(shipped.clinicianReviewDayShare)}` +
    ` / days 1-4 ${percent(shipped.clinicianReviewFirstFourDays)}` +
    ` / day 8+ ${percent(shipped.clinicianReviewAfterDaySeven)}`,
);
console.log(
  `red-flag recall  ${percent(shipped.redFlagRecall)} across ${shipped.redFlagPatients} patients`,
);
console.log('\nwrote results/evaluation.json and results/evaluation.md');
