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

| | Unsafe recommendations | Mean load |
|---|---|---|
| **NaviTBI** | **6.0%** | 0.27 |
| Guideline ceiling alone, no personalisation | 51.0% | 0.60 |
| Model alone, guardrails removed | 10.5% | 0.33 |
| No tool at all — an ordinary day, every day | 47.9% | 0.52 |

Re-run with every prior weight deliberately halved and doubled, the unsafe rate
moves between 4.6% and 8.6% — so the result is a property of the guardrails and
the conservative quantile rather than of starting beliefs we chose ourselves.

| | |
|---|---|
| Estimates that exceeded true tolerance | **0.0%** |
| Red-flag halt recall | **100%** |
| Flare attribution, top-1 accuracy | **98.3%** |
| Accessibility violations (81 axe scans) | **0** |

Each day is simulated twice — once at the dose NaviTBI recommended, once at the
dose the patient took. The model learns from what they did; safety is measured
against the recommendation, because a patient who overshoots by 50% has not been
failed by the plan.

Full detail, including the limitations, in
[`results/evaluation.md`](results/evaluation.md) and
[`results/frontend-audit.md`](results/frontend-audit.md).

## The five load domains

Not an arbitrary split. After concussion the brain is in a period of raised
energy demand with a reduced ability to meet it, so capacity is a metabolic
budget rather than a matter of effort — which is why exceeding it produces
symptoms without producing damage, and why sub-threshold activity is the
treatment rather than a reward for recovering.

The five are tracked separately because they draw on different systems, recover
at different rates, and are accommodated in completely different ways by a
school or a workplace. Averaging them loses the thing that makes the output
actionable.

| Domain | What it loads | Resembles |
|---|---|---|
| Thinking and concentration | Classes, meetings, reading for meaning | cognitive |
| Screens, motion, busy spaces | Oculomotor and vestibular work | ocular-motor, vestibular |
| Physical activity | Exertion, autonomic regulation | vestibular |
| Sleep and fatigue | Shortfall against their own usual night | sleep disturbance |
| Stress, noise, social load | Continuous sensory and social demand | anxiety/mood |

"Resembles" is doing real work there. NaviTBI describes what a pattern looks
like and points at a conversation; it never assigns a subtype, which is a
clinical judgement made with an examination rather than from self-reported
minutes. Headache/migraine and cervical strain are not tracked as loads at all,
and `/how-it-works` says so rather than leaving the gap implied.

## Safety

- **Red flags halt everything.** Any CRT6 red flag produces no plan, no dose and
  no packet — one screen and an instruction to seek urgent care.
- **The model can never widen what the guideline permits**, and that is a
  property test rather than a set of examples. Across both ladders, every step,
  every domain, a range of posteriors, ramp positions, environment factors and
  clinician ceilings, a dose may exceed the smallest binding constraint only by
  being the guideline floor — and may never exceed a clinician's ceiling for any
  reason, including the floor. The floor is separately asserted never to sit
  above its own stage cap, since it is applied last and would widen the ceiling
  invisibly if it did.
- **Never clears sport.** Return-to-Sport step 4+ requires written medical
  clearance; the app displays the requirement and declines.
- **Never gates school on clearance** — it states the opposite, correctly, which
  is what the guideline says and what most tools get wrong.
- **Selection, never generation.** Every sentence a recipient reads comes from a
  cited library, verbatim. No language model writes packet text. That, rather
  than any validator, is the guarantee.
- **A bounded path to adding a tone pass.** `engine/packet/validate.ts` blocks
  added sentences, invented figures, dropped limits, introduced negations,
  introduced hedging, loss of the item's subject, and named clinical territory —
  diagnosis, clearance, medication, imaging, declaring recovery, attributing a
  claim to a clinician.
  It **cannot** verify that a rephrasing still means the same thing: rewriting
  "Cap live meetings at 1 per day" to "Require at least 1 per day" survives every
  check, and so do "Set a minimum of", "Aim for at least" and "Schedule at
  least". That limit is asserted in the tests rather than left implicit.
  Hedging used to sit on that list too — `npm run attack` found that "Where
  convenient, consider capping…" turned a limit into a suggestion while keeping
  every number, subject word and sentence. Softening is what a tone pass is
  *for*, so that one was worth closing, and unlike inversion it is lexical.
- **Refuses to guess.** Attribution declines to name a cause when there is too
  little data, when the day does not match the pattern, or when two loads cannot
  be told apart.
- **Provenance on every number, checked against its own source.** Values from
  the literature carry a verbatim quote; our own engineering choices carry a
  rationale. The tests enforce the distinction — and that the number actually
  appears in the sentence it claims to come from, which a quote merely *existing*
  does not prove. The damaging error in a transcription layer is a correct quote
  beside the wrong number. Where a quote states the value in another unit
  ("up to 1 hour" for 60 minutes, "more than one week" for 7 days) the
  conversion is recorded and the test refuses a recorded conversion that is no
  longer needed.
- **Dead ends still say the important thing.** A share link that has expired or
  been revoked lands on a page that explains what happened and carries the
  urgent-care instruction, rather than a stock 404 — and the wording is
  identical for revoked, expired, mistyped and never-existed, because saying
  which would hand the holder of a dead token a fact about the patient. The
  error boundary does the same.
- **A tab title names the document, never the person.** Titles reach browser
  history, screen shares and whatever a school's managed browser syncs upstream,
  so they say "School accommodations", not who it is for. Shared pages are also
  `noindex` by header and by meta — advisory, not a control, but a recipient
  pasting a live link into a public ticket is an accident worth closing.
- **The share surface is treated as the attack surface.** Tokens are 192 bits
  from a CSPRNG, compared in constant time, and expired, revoked and unknown all
  return the same 404. Pages are served under a per-request nonce CSP with
  `frame-ancestors 'none'`, so a share link cannot be framed and clickjacked
  into flagging an accommodation — that click lowers a real patient's limits.
  Share URLs are served `no-referrer`, because the token in the path *is* the
  credential.

## Accessibility

Functional requirements, not polish — the users are photophobic and cognitively
fatigued.

Three surfaces (calm, dim, night) solved in OKLCH against every background text
sits on. Photophobia mode emits ~38% less light than the default surface while
holding 11:1 contrast, by lowering ground and ink together rather than greying
the text. Motion off by default. 56px targets. Stored surface applied before
first paint. Check-in is one question per screen with no typing.

The check-in can read itself aloud, opt-in and never automatic. That is not a
novelty feature: a check-in requiring a lit screen is one a photophobic person
skips on exactly the days worth recording.

Reading level is enforced, not just measured. The check-in — the one surface
used daily by someone with active symptoms — is held at grade 7 or below and
currently averages 3.4; accommodation text is held at 14 and averages 7. A
letter a school has to read twice gets filed unread, and the people that hurts
most are the ones least able to advocate for themselves. Red-flag wording is
exempt and deliberately so: it is verbatim CRT6, and paraphrasing a transcribed
guideline to score better on a readability metric is the wrong trade.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000

npm run verify       # typecheck, lint, 1,351 unit tests
npm run verify -- --full  # ...and 143 e2e (a11y on three engines)
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
- Giza CC, Hovda DA. *The new neurometabolic cascade of concussion.*
  Neurosurgery 2014;75(Suppl 4):S24-S33.
- Lumba-Brown A, Teramoto M, Bloom OJ, et al. *Concussion guidelines step 2:
  evidence for subtype classification.* Neurosurgery 2020;86(1):2-13.

## Known limitations

- Not validated in humans. All results are on synthetic cohorts.
- No identity. Every mutation is gated on the acting patient and that gate is
  enforced — a request cannot file a check-in against someone else's record or
  mint a link for a patient it has not opened. What is missing is any check on
  *who* is acting: anyone can choose to be any of the demo patients. Replacing
  one function with a session lookup is the whole change, and it is the main
  thing keeping this out of production.
- In-memory demo store. The Drizzle schema for Postgres is written but unused.
- The system is markedly conservative: mean signed tolerance error is −0.94
  reference units, and the guideline floor overrides the model on 63% of days.
- Stage caps and floors are our numeric reading of deliberately qualitative
  guideline text, labelled as such throughout.
