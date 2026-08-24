# NaviTBI evaluation

Synthetic cohort of 200 patients over 21 days, generated from known
ground-truth coefficients. Sensitivity decays over time, so the model is fitting a
moving target rather than a stationary one.

**Evaluated on synthetic patients with known ground truth. Not validated in humans.
Not a medical device.**

## Headline

| Metric | Result |
|---|---|
| Recommendations that would have breached the 2-point limit | **5.5%** |
| Red-flag halt recall | 100.0% (7 patients) |
| Estimates that exceeded true tolerance | 0.0% |
| Mean signed tolerance error | -0.935 reference units |
| Domain-days where the model recommended nothing | 24.0% |
| Days the guideline floor overrode the model | 55.0% |
| Days flagged for clinician review | 19.7% |
| — of those, in the first four days | 33.1% |
| — from day 8 onward | 12.4% |
| Patient-days simulated | 4084 |

Each day is simulated twice: once at the dose NaviTBI recommended, once at the dose
the patient actually took. The model learns from what they actually did; the safety
rate is measured against the recommendation, because a patient who overshoots by 50%
has not been failed by the plan.

## Does the personalization earn its place?

| Policy | Unsafe recommendations | Mean recommended load |
|---|---|---|
| NaviTBI — min(model, ramp, stage) | 5.5% | 0.264 |
| Guideline ceiling only, no personalization | 55.5% | 0.642 |
| Model only, both guardrails removed | 9.5% | 0.323 |

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
| Named a likely driver | 2.5% |
| Nothing to explain — symptoms stayed mild | 93.0% |
| Declined: not enough data yet | 2.1% |
| Declined: the day did not match the pattern | 0.0% |
| Declined: two loads were indistinguishable | 2.4% |

**Top-1 accuracy when it did name a driver: 99.0%** — the share of
named explanations that picked the domain which genuinely contributed most, according to the
generator's own weights.

Of the days where symptoms actually rose past the limit, 35.3% got a
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
| Stage ceiling | 1.6% |
| Ramp cap | 24.1% |
| Model tolerance | 54.8% |
| Guideline activity floor | 19.5% |

## Tolerance error by day

Mean absolute error between estimated and true tolerance, in reference units,
averaged across all five load domains.

| Day | Error |
|---|---|
| 1 | 0.685 |
| 2 | 0.653 |
| 3 | 0.713 |
| 4 | 0.77 |
| 5 | 0.812 |
| 6 | 0.863 |
| 7 | 0.908 |
| 8 | 0.935 |
| 9 | 0.989 |
| 10 | 0.998 |
| 11 | 1.035 |
| 12 | 1.049 |
| 13 | 1.039 |
| 14 | 1.035 |
| 15 | 1.059 |
| 16 | 1.045 |
| 17 | 1.031 |
| 18 | 1.026 |
| 19 | 1.027 |
| 20 | 0.997 |
| 21 | 0.994 |
