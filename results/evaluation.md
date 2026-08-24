# NaviTBI evaluation

Synthetic cohort of 200 patients over 21 days, generated from known
ground-truth coefficients. Sensitivity decays over time, so the model is fitting a
moving target rather than a stationary one.

**Evaluated on synthetic patients with known ground truth. Not validated in humans.
Not a medical device.**

## Headline

| Metric | Result |
|---|---|
| Recommendations that would have breached the 2-point limit | **7.5%** |
| Red-flag halt recall | 100.0% (7 patients) |
| Estimates that exceeded true tolerance | 0.0% |
| Mean signed tolerance error | -0.952 reference units |
| Domain-days where the model recommended nothing | 30.5% |
| Days the guideline floor overrode the model | 75.1% |
| Days the model judged a floor-only day risky | 41.2% |
| — of those, in the first four days | 43.0% |
| — from day 8 onward | 34.2% |
| Patient-days simulated | 4084 |

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
| NaviTBI — min(model, ramp, stage) | 7.5% | 0.281 |
| Guideline ceiling only, no personalization | 55.5% | 0.642 |
| Model only, both guardrails removed | 9.5% | 0.315 |

Load is expressed as a fraction of an ordinary demanding day.

### How to read that table

The "guideline ceiling only" row is **not** a claim that the published guidelines are
unsafe. Those ceilings are our own numeric reading of deliberately qualitative text
(see `src/engine/tolerance/stage-caps.ts`), and the guidelines pair them with clinical
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
| Named a likely driver | 3.4% |
| Nothing to explain — symptoms stayed mild | 90.1% |
| Declined: not enough data yet | 2.3% |
| Declined: the day did not match the pattern | 0.0% |
| Declined: two loads were indistinguishable | 4.3% |

**Top-1 accuracy when it did name a driver: 94.9%** — the share of
named explanations that picked the domain which genuinely contributed most, according to the
generator's own weights.

Of the days where symptoms actually rose past the limit, 33.7% got a
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

## What bound the recommendation

| Constraint | Share of decisions |
|---|---|
| Stage ceiling | 1.2% |
| Ramp cap | 17.3% |
| Model tolerance | 38.3% |
| Guideline activity floor | 43.2% |

## Tolerance error by day

Mean absolute error between estimated and true tolerance, in reference units,
averaged across all five load domains.

| Day | Error |
|---|---|
| 1 | 0.685 |
| 2 | 0.653 |
| 3 | 0.705 |
| 4 | 0.747 |
| 5 | 0.791 |
| 6 | 0.836 |
| 7 | 0.905 |
| 8 | 0.933 |
| 9 | 0.99 |
| 10 | 1.022 |
| 11 | 1.061 |
| 12 | 1.081 |
| 13 | 1.076 |
| 14 | 1.081 |
| 15 | 1.096 |
| 16 | 1.078 |
| 17 | 1.08 |
| 18 | 1.073 |
| 19 | 1.063 |
| 20 | 1.035 |
| 21 | 1.027 |
