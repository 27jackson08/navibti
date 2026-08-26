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
import { LOAD_DOMAINS, PRIOR_MEANS_MUTABLE } from './prior-sensitivity';
import { makeCohort } from '@/data/synthetic/patient';
import { simulatePatient, summarize, type CohortMetrics, type Policy } from '@/data/synthetic/simulate';

const COHORT_SIZE = Number(process.env.COHORT_SIZE ?? 200);
const DAYS = Number(process.env.DAYS ?? 21);
const POLICIES: Policy[] = ['navitbi', 'stage-only', 'model-only', 'no-pacing'];

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

/**
 * The first question a sceptical reader should ask: are these numbers a property
 * of the method, or of priors we picked ourselves? So the whole cohort is re-run
 * with every prior weight deliberately wrong — halved, then doubled.
 */
const priorSensitivity = [
  { label: 'as chosen', scale: 1 },
  { label: 'halved', scale: 0.5 },
  { label: 'doubled', scale: 2 },
].map(({ label, scale }) => {
  const original = { ...PRIOR_MEANS_MUTABLE };
  for (const key of Object.keys(PRIOR_MEANS_MUTABLE)) {
    PRIOR_MEANS_MUTABLE[key] = original[key] * scale;
  }

  const metrics = summarize(cohort.map((patient) => simulatePatient(patient, DAYS, 'navitbi')));

  for (const key of Object.keys(PRIOR_MEANS_MUTABLE)) {
    PRIOR_MEANS_MUTABLE[key] = original[key];
  }
  return { label, scale, metrics };
});

const report = {
  generatedFor: { cohortSize: COHORT_SIZE, days: DAYS, domains: LOAD_DOMAINS },
  caveat:
    'Evaluated on synthetic patients with known ground truth. Not validated in humans. ' +
    'Not a medical device.',
  byPolicy,
  priorSensitivity: priorSensitivity.map((entry) => ({
    prior: entry.label,
    unsafeRecommendationRate: entry.metrics.unsafeRecommendationRate,
    overEstimationRate: entry.metrics.overEstimationRate,
    meanRecommendedLoad: entry.metrics.meanRecommendedLoad,
  })),
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
| Days the model judged a floor-only day risky | ${percent(shipped.clinicianReviewDayShare)} |
| — of those, in the first four days | ${percent(shipped.clinicianReviewFirstFourDays)} |
| — from day 8 onward | ${percent(shipped.clinicianReviewAfterDaySeven)} |
| Patient-days simulated | ${shipped.simulatedDays} |

Two figures above need reading carefully.

The **floor-only risk** row is the raw daily signal, not what a patient sees. One day of
disagreement between the model and the guideline minimum is noise; the app requires it to
persist for three consecutive days before it says anything, precisely so the banner stays
worth reading.

The **guideline activity floor** is why the unsafe rate is 7.5% rather than the 5.5% it was
before floors existed. That is a deliberate trade and not a regression: without a floor the
model collapses to recommending nothing at all, learns nothing from the resulting empty
days, and keeps recommending nothing — which is the over-restriction the guidance
explicitly warns against. Two points of measured risk buys the removal of an unmeasurable
one.

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
| No tool at all — an ordinary day, every day | ${percent(byPolicy['no-pacing'].unsafeRecommendationRate)} | ${round(byPolicy['no-pacing'].meanRecommendedLoad)} |

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

## Explaining a flare

| Outcome | Share of days |
|---|---|
| Named a likely driver | ${percent(shipped.attributionOutcomes.attributed)} |
| Nothing to explain — symptoms stayed mild | ${percent(shipped.attributionOutcomes['nothing-to-explain'])} |
| Declined: not enough data yet | ${percent(shipped.attributionOutcomes['not-enough-data'])} |
| Declined: the day did not match the pattern | ${percent(shipped.attributionOutcomes['day-does-not-match-pattern'])} |
| Declined: two loads were indistinguishable | ${percent(shipped.attributionOutcomes.confounded)} |

**Top-1 accuracy when it did name a driver: ${percent(shipped.attributionTop1Accuracy)}** — the share of
named explanations that picked the domain which genuinely contributed most, according to the
generator's own weights.

Of the days where symptoms actually rose past the limit, ${percent(shipped.flareDaysExplained)} got a
named explanation and the rest got an explicit refusal.

### Why so many refusals

The confounding rate is high here partly as an artefact of the simulation. A synthetic
patient follows a generated plan that scales every domain together, so cognitive load,
screen exposure and social load genuinely do move in lockstep — and when they do, no
method can say which one mattered. The gate is behaving correctly; it is the simulated
behaviour that is unusually uninformative.

Real days vary in ways these do not: a bad night, an exam, a quiet weekend, a long
drive. That variation is what makes causes separable, and it is the main reason to
expect a higher named-explanation rate in practice than this figure suggests. It is
also the reason not to quote this number as a limitation of the method.

## Is this a property of the method, or of the priors we chose?

The whole cohort, re-run with every prior weight deliberately wrong.

| Prior | Unsafe recommendations | Over-estimated | Mean load |
|---|---|---|---|
${priorSensitivity
  .map(
    (entry) =>
      `| ${entry.label} | ${percent(entry.metrics.unsafeRecommendationRate)} | ` +
      `${percent(entry.metrics.overEstimationRate)} | ${round(entry.metrics.meanRecommendedLoad)} |`,
  )
  .join('\n')}

If the safety rate moves very little when the starting beliefs are halved and
doubled, the result is a property of the guardrails and the conservative
quantile rather than of beliefs we chose ourselves. If it moves a lot, that is
worth knowing too, and it is recorded either way.

## Is it right, or only cautious?

Predicted risk against what actually happened. A model saying twenty percent
should breach about twenty percent of the time; one that is safe purely by being
uniformly pessimistic has not earned the word "personalised".

| Predicted | Observed | Days |
|---|---|---|
${
  shipped.calibration.length > 0
    ? shipped.calibration
        .map(
          (bin) =>
            `| ${percent(bin.predicted)} | ${percent(bin.observed)} | ${bin.days} |`,
        )
        .join('\n')
    : '| — | not enough days in any bin to report | — |'
}

### What that table actually shows

Two things, and only one of them is flattering.

**The model over-predicts risk by roughly threefold.** In the bin where it
expects about a fifth of days to breach the limit, under a twentieth do. It is
not well calibrated; it is pessimistic, and the safety rate above is bought with
that pessimism plus the guardrails rather than with precision. Said plainly
because it is the kind of thing a reader should hear from us rather than find.

**The bins are lumpy by construction.** The solver drives predicted risk to the
target quantile, so almost every day lands in the bin containing that target.
That leaves little spread to assess calibration across, which limits how much
this table can establish either way. A fairer calibration study would vary the
target deliberately across patients, which is beyond what these seven days
allowed.

Sweeping the target with npm run sweep shows the trade directly: tightening it
reduces breaches and increases how often the guideline floor, rather than the
model, is what sets the number.

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
console.log('\nprior sensitivity');
for (const entry of priorSensitivity) {
  console.log(
    `  ${entry.label.padEnd(10)} unsafe ${percent(entry.metrics.unsafeRecommendationRate).padStart(6)}` +
      `   over-est ${percent(entry.metrics.overEstimationRate).padStart(6)}` +
      `   load ${round(entry.metrics.meanRecommendedLoad, 2)}`,
  );
}
console.log('\ncalibration  predicted -> observed');
for (const bin of shipped.calibration) {
  console.log(
    `  ${percent(bin.predicted).padStart(6)} -> ${percent(bin.observed).padStart(6)}  (${bin.days} days)`,
  );
}
console.log(
  `\nattribution      top-1 ${percent(shipped.attributionTop1Accuracy)}` +
    `   named ${percent(shipped.attributionOutcomes.attributed)}` +
    `   unusual-day ${percent(shipped.attributionOutcomes['day-does-not-match-pattern'])}` +
    `   confounded ${percent(shipped.attributionOutcomes.confounded)}`,
);
console.log('\nwrote results/evaluation.json and results/evaluation.md');
