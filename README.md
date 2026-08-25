# NaviTBI

**Return-to-Life Accommodation Engine.** Translates a concussion patient's daily
tolerance into concrete, shareable accommodations for the school, workplace and
family who have to act on it.

> Not medical advice. NaviTBI organises published guideline information
> alongside a patient's own daily reports. It does not diagnose, does not issue
> medical clearance, and does not replace a clinician. Evaluated on synthetic
> patients with known ground truth; **not validated in humans**.

---

## The gap

Every concussion tool on the market is patient-facing and self-contained. But
the documented reason recovery stalls is that the patient's *environment* keeps
overloading them — schools expect full attendance, managers stack calls,
families hover or push.

The medical restriction is clinically precise: *sub-symptom-threshold load, no
more than a 2-point rise over the pre-activity value on a 0–10 scale, lasting no
more than an hour.* It is also operationally invisible to every person capable
of causing the overload.

NaviTBI is the translation layer. The novelty is coordination, not another dose
tracker.

## How it works

```
check-in ──► stage machine ─┐
             ramp cap ──────┼─► min( ) ──► today's plan ──► role packets
             tolerance model ┘      ▲                            │
                    ▲               └── guideline activity floor │
                    └──────────── tomorrow's check-in ◄──────────┘
```

Two engines, deliberately separated:

- **A deterministic stage machine** encodes Return-to-Learn (4 steps) and
  Return-to-Sport (6 steps) verbatim from the published protocols, and decides
  what is *permitted*. Both ladders run in parallel, because a student athlete
  is on both at once.
- **A Bayesian tolerance model** decides *how much*, but only inside the box the
  guideline already drew. It can never advance a stage and never issues
  clearance.

The guideline supplies a **floor** as well as a ceiling. Without one, a model
fitted to someone doing very little predicts that almost anything is risky,
recommends nothing, and never sees the data that would change its mind.

## Results

Evaluated on 200 synthetic patients over 21 days — 4,084 patient-days — generated
from known ground-truth coefficients whose sensitivity decays over time, so the
model fits a moving target.

| | NaviTBI | Guideline ceiling alone | Model, guardrails removed |
|---|---|---|---|
| Recommendations that would have breached the 2-point limit | **6.0%** | 51.0% | 10.5% |
| Mean recommended load | 0.27 | 0.60 | 0.33 |

| | |
|---|---|
| Estimates that exceeded true tolerance | **0.0%** |
| Red-flag halt recall | **100%** |
| Flare attribution, top-1 accuracy | **98.3%** |
| Accessibility violations (21 axe scans) | **0** |

Each day is simulated twice — once at the dose NaviTBI recommended, once at the
dose the patient took. The model learns from what they did; safety is measured
against the recommendation, because a patient who overshoots by 50% has not been
failed by the plan.

Full detail, including the limitations, in
[`results/evaluation.md`](results/evaluation.md) and
[`results/frontend-audit.md`](results/frontend-audit.md).

## Safety

- **Red flags halt everything.** Any CRT6 red flag produces no plan, no dose and
  no packet — one screen and an instruction to seek urgent care.
- **Never clears sport.** Return-to-Sport step 4+ requires written medical
  clearance; the app displays the requirement and declines.
- **Never gates school on clearance** — it states the opposite, correctly, which
  is what the guideline says and what most tools get wrong.
- **Selection, never generation.** Every sentence a recipient reads comes from a
  cited library, verbatim. No language model writes packet text. That, rather
  than any validator, is the guarantee.
- **A bounded path to adding a tone pass.** `engine/packet/validate.ts` blocks
  added sentences, invented figures, dropped limits, introduced negations, loss
  of the item's subject, and named clinical territory — diagnosis, clearance,
  medication, imaging, declaring recovery, attributing a claim to a clinician.
  It **cannot** verify that a rephrasing still means the same thing: rewriting
  "Cap live meetings at 1 per day" to "Require at least 1 per day" survives every
  check. That limit is asserted in the tests rather than left implicit.
- **Refuses to guess.** Attribution declines to name a cause when there is too
  little data, when the day does not match the pattern, or when two loads cannot
  be told apart.
- **Provenance on every number.** Values from the literature carry a verbatim
  quote; our own engineering choices carry a rationale. The test suite enforces
  the distinction.

## Accessibility

Functional requirements, not polish — the users are photophobic and cognitively
fatigued.

Three surfaces (calm, dim, night) solved in OKLCH against every background text
sits on. Photophobia mode emits ~38% less light than the default surface while
holding 11:1 contrast, by lowering ground and ink together rather than greying
the text. Motion off by default. 56px targets. Stored surface applied before
first paint. Check-in is one question per screen with no typing.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000

npm test             # 596 unit tests
npm run e2e          # 39 Playwright tests, incl. 21 axe scans
npm run eval         # regenerate results/evaluation.md
npm run packets      # print the packets each demo persona receives
npm run trace -- 3   # one patient's day-by-day engine trace
```

Three demo patients are seeded from the same synthetic generator the evaluation
uses, so they behave like the measured cohort rather than like curated happy
paths.

## Sources

- Patricios JS, Schneider KJ, Dvorak J, et al. *Consensus statement on
  concussion in sport: the 6th International Conference on Concussion in Sport —
  Amsterdam, October 2022.* Br J Sports Med 2023;57:695-711.
- PedsConcussion. *Living Guideline Return to Activity/Sport and Return to
  School/Learn Protocols*, September 2023.
- Ontario Neurotrauma Foundation. *Living Concussion Guidelines* (adults).
- Echemendia RJ, et al. *The Concussion Recognition Tool 6 (CRT6).*
  Br J Sports Med 2023;57:692-693.

## Known limitations

- Not validated in humans. All results are on synthetic cohorts.
- No authentication. Share-link scoping is real; patient-record ownership is
  not enforced, which is the main thing keeping this out of production.
- In-memory demo store. The Drizzle schema for Postgres is written but unused.
- The system is markedly conservative: mean signed tolerance error is −0.94
  reference units, and the guideline floor overrides the model on 63% of days.
- Stage caps and floors are our numeric reading of deliberately qualitative
  guideline text, labelled as such throughout.
