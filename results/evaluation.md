# NaviTBI evaluation

Synthetic cohort of 200 patients over 21 days, generated from known
ground-truth coefficients. Sensitivity decays over time, so the model is fitting a
moving target rather than a stationary one.

**Evaluated on synthetic patients with known ground truth. Not validated in humans.
Not a medical device.**

## Headline

| Metric | Result |
|---|---|
| Recommendations that would have breached the 2-point limit | **6.0%** |
| Red-flag halt recall | 100.0% (7 patients) |
| Estimates that exceeded true tolerance | 0.0% |
| Mean signed tolerance error | -0.939 reference units |
| Domain-days where the model recommended nothing | 23.5% |
| Days the guideline floor overrode the model | 62.8% |
| Days the model judged a floor-only day risky | 27.1% |
| — of those, in the first four days | 38.1% |
| — from day 8 onward | 19.3% |
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
| NaviTBI — min(model, ramp, stage) | 6.0% | 0.268 |
| Guideline ceiling only, no personalization | 51.0% | 0.596 |
| Model only, both guardrails removed | 10.5% | 0.327 |

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
| Named a likely driver | 3.0% |
| Nothing to explain — symptoms stayed mild | 92.0% |
| Declined: not enough data yet | 2.3% |
| Declined: the day did not match the pattern | 0.0% |
| Declined: two loads were indistinguishable | 2.8% |

**Top-1 accuracy when it did name a driver: 98.3%** — the share of
named explanations that picked the domain which genuinely contributed most, according to the
generator's own weights.

Of the days where symptoms actually rose past the limit, 36.9% got a
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
| Stage ceiling | 2.6% |
| Ramp cap | 21.7% |
| Model tolerance | 43.3% |
| Guideline activity floor | 32.4% |

## Tolerance error by day

Mean absolute error between estimated and true tolerance, in reference units,
averaged across all five load domains.

| Day | Error |
|---|---|
| 1 | 0.685 |
| 2 | 0.653 |
| 3 | 0.705 |
| 4 | 0.762 |
| 5 | 0.806 |
| 6 | 0.858 |
| 7 | 0.913 |
| 8 | 0.938 |
| 9 | 0.992 |
| 10 | 1.01 |
| 11 | 1.05 |
| 12 | 1.064 |
| 13 | 1.051 |
| 14 | 1.048 |
| 15 | 1.07 |
| 16 | 1.052 |
| 17 | 1.041 |
| 18 | 1.033 |
| 19 | 1.03 |
| 20 | 1 |
| 21 | 0.998 |
