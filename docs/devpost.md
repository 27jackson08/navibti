# NaviTBI — Devpost submission copy

Paste-ready. Every number here is reproducible with `npm run eval` and
`npm run e2e`.

---

## Tagline

*The restriction is clear. The environment never hears it.* NaviTBI turns a
concussion patient's daily tolerance into instructions the school, the manager
and the family can actually act on.

---

## Inspiration

Concussion care has a strange gap in it. The medical restriction is clinically
precise — sub-symptom-threshold load, no more than a 2-point rise over the
pre-activity value on a 0–10 scale, lasting no more than an hour. Clinicians
know it. Guidelines specify it.

And it is completely invisible to every person capable of causing the overload.

The school expects full attendance. The manager schedules four calls. The
family either hovers or, meaning well, encourages someone back into a full day.
Nobody in that list has been told what "sub-symptom-threshold" means for this
person today, and none of them can act on a number they never see.

Every concussion app we found is patient-facing and self-contained — symptom
trackers, pacing apps, rehab planners. They help the one person in the situation
who is already trying. Nothing translates tolerance for the people around them.

## What it does

NaviTBI closes the loop:

1. **A 60-second check-in** designed for someone photophobic and exhausted. Red
   flags first, one question per screen, no typing, three brightness settings.
2. **A personalised tolerance estimate** per load domain — thinking, screens and
   motion, physical activity, sleep, and social or sensory demand.
3. **An explanation** of yesterday's flare, with a counterfactual — and an
   explicit refusal when it cannot tell.
4. **Role-specific accommodation packets** for school, employer, caregiver and
   clinician. This is the part that does not exist anywhere else.
5. **Scoped share links** the recipient opens without an account, which expire,
   can be revoked instantly, and record every view.
6. **Replies from the people who received them.** A school or manager can
   confirm receipt and report an accommodation as impossible — and because some
   accommodations are what *make* a dose safe, saying so changes the plan.
7. **A place for the clinician to record what they decided.** Clearance, and
   hard ceilings that outrank everything NaviTBI would otherwise recommend.

Then tomorrow's check-in updates the estimate, and the packets update only if
something actually changed.

**A school packet for Maya, 16, six days after her injury** — verbatim output:

> Schedule a shortened day: 1 hour of class, ideally in the morning.
> Give a 15-minute rest break in a quiet, dimly lit space after every 20 minutes
> of class work. The break should be scheduled, not requested.
> Avoid screen-based work for now. Provide printed materials, and read aloud or
> use audio where the lesson would normally use a screen.
> No timed tests. Allow extra time, or assess understanding another way.

**The same engine, for Daniel's manager** — 34, eleven days in:

> Phase hours back in: 1 hour per day this week, reviewed weekly.
> Cap live meetings at 1 per day and 20 minutes each. Everything else goes async.
> No back-to-back meetings. Leave at least 15 minutes between any two.
> Camera off by default on all calls, with no expectation of explaining why.

Those numbers are as restrictive as they look. That is the system being honest
about two patients who are genuinely still unwell — and it is the first time
either of their schools or employers could have known it.

Every sentence comes from a cited library. None of it is generated prose.

**And the loop closes on the other side too.** Tom's manager opens his packet,
reports that gaps between meetings are not possible, and his concentration
budget moves from 144 minutes to 115 — with the reason on screen. Forty minutes
of work is tolerable *because* a break follows it; if the break is not there,
the forty minutes is not safe any more. The plan adapts to the room the patient
is actually in.

## How we built it

**Two engines, deliberately separated.** A deterministic stage machine encodes
Return-to-Learn (4 steps) and Return-to-Sport (6 steps) verbatim from the
published protocols and decides what is *permitted*. A Bayesian tolerance model
decides *how much*, but only inside the box the guideline already drew. The
model can never advance a stage and never issues clearance.

**The model predicts the right thing.** Bayesian linear regression with a
Normal-Inverse-Gamma conjugate prior, predicting the worst within-day rise over
the pre-activity value on the guideline's own 0–10 scale — so its output is
directly comparable to the published threshold with no translation step. Updates
are closed-form, so there is no training loop, no sampling and no second
service. Roughly 150 lines of TypeScript.

**Conservatism falls out of the maths.** Sparse data produces a wide Student-t
predictive, which produces a small recommendation. There is no "new user"
special case anywhere in the code, and a test asserts it.

**The guideline supplies a floor as well as a ceiling.** This turned out to
matter more than anything else we built (see below).

**The translation layer** converts "107 focused minutes" into "2 hours of class,
with a 10-minute break every 40 minutes". Every conversion states its reasoning
in the source, so a clinician who disagrees that a live meeting costs about 45
minutes of concentration can argue with that one claim rather than distrust the
whole document.

## Results

200 synthetic patients × 21 days = **4,084 patient-days**, generated from known
ground-truth coefficients whose sensitivity decays over time, so the model fits
a moving target rather than a stationary one.

| | Unsafe recommendations | Mean load |
|---|---|---|
| **NaviTBI** | **6.0%** | 0.27 |
| Guideline ceiling alone, no personalisation | 51.0% | 0.60 |
| Model alone, guardrails removed | 10.5% | 0.33 |
| No tool at all — an ordinary day, every day | 47.9% | 0.52 |

Re-run with every prior weight deliberately halved and then doubled, the unsafe
rate moves only between 4.6% and 8.6%. That matters more than the headline: it
means the result is a property of the guardrails and the conservative quantile
rather than of starting beliefs we picked ourselves.

| | |
|---|---|
| Estimates that exceeded true tolerance | **0.0%** |
| Red-flag halt recall | **100%** |
| Flare attribution, top-1 accuracy | **98.3%** |
| Accessibility violations across 72 axe scans | **0** |

Each day is simulated twice — once at the dose we recommended, once at the dose
the patient took. The model learns from what they did; safety is measured
against the recommendation, because a patient who overshoots by 50% has not been
failed by the plan.

## What we are least happy with

The model over-predicts risk by roughly threefold. Where it expects 19.3% of
days to breach the limit, 5.7% do. It is safe, and it is
safe because it is pessimistic rather than because it is precise — the guideline
floor, not the model, sets the number on 63% of days.

We know this because we measured it and put it in the results rather than
reporting only the flattering half. Two of the four demo patients sit on that
floor for their first fortnight, which is also why a fourth was added: the model
needs about two weeks of check-ins before it has more to say than the guideline
already does.

## Challenges we ran into

**The evaluation harness immediately told us the system was dangerous.** Our
first honest measurement came back at **60.8% unsafe**. Each domain's dose was
being solved independently against yesterday's day, then all five recommended at
once — individually safe, jointly far heavier than any of those scenarios
assumed. Allocation is now sequential, and the result is clinically righter as
well as safer: three hours of screens really does leave less room for meetings.

**Then it told us the system was useless.** Tolerance collapsed to zero by day
five and stayed there — recommend nothing, learn nothing from the empty days,
recommend nothing again. Shipped, that is an app telling a recovering patient to
do nothing, indefinitely, which is exactly the harm the guidance warns against.
It would have demoed perfectly on a happy-path patient. The fix used the
architecture we already had: the stage machine now supplies a guideline-grounded
activity *floor*, and where the floor overrides the model the conflict is
surfaced and escalated rather than resolved silently.

**A patient reached "full days, no accommodations" while managing 107 focused
minutes.** The stage machine was advancing on the absence of flares — but
absence of symptoms at a tiny dose is not evidence of tolerance, and the
guideline is explicit that step 3 ends when full days *are tolerated*. His
employer packet came out nearly empty. Leaving step 3 now requires a
demonstrated near-full day.

**Floating point nearly manufactured a clinical breach.** The clinician
trajectory table showed a rise of 2.0 points lasting 50 minutes — inside the
limit on both counts — next to a verdict of "within limit: no". Severity is
reported to one decimal, and 4.4 − 2.4 is 2.0000000000000004 in binary floating
point. A patient whose symptoms rose exactly two points was being told they had
breached the threshold.

**Our accessibility tests were measuring the wrong thing.** The token unit tests
passed while three real contrast defects were live: a colour tested at 3:1 (the
large-text bar) and used at 12px, contrast only ever checked against the page
ground when text also sits on raised and sunken surfaces, and the semantic
notice colours never checked at all. Scanning the built pages with axe found all
three.

## Accomplishments we're proud of

**Nailing the citations.** The concept doc we started from said "6th Berlin
Consensus" — Berlin was the *fifth*, in 2016; the sixth is Amsterdam 2023. It
described Return-to-Learn as a 6-step framework — it is 4 steps; the 6-step
ladder is Return-to-Sport. Fixing that before writing any code changed what got
built.

**Every number carries its provenance.** Values from the literature carry a
verbatim quote; our own engineering choices carry a rationale. A test enforces
the distinction, so a clinician can argue with a specific number instead of
distrusting the system.

**The model knows when to shut up.** Attribution refuses to name a cause when
there is too little data, when the day does not match the pattern, or when two
loads moved together and cannot be separated. Our first confounding test was a
correlation threshold; calibration showed no single cutoff can work, so it now
asks whether the *difference* between two contributions is distinguishable from
zero given the posterior covariance.

**We tried to break our own safety claim, and did.** The README used to say a
language model could not invent a clinical claim here. So we attacked the
validator, and four fabrications went straight through — a recovery claim, an
invented clinician endorsement, an appended instruction, and a flat "no
restrictions are necessary" — all by appending a sentence. Those are blocked
now, along with introduced negations and loss of the item's subject.

But an instruction can still be reversed without a negation: "Cap live meetings
at 1 per day" becomes "Require at least 1 per day" and survives every check. A
lexical validator has no access to meaning. So the claim is now the narrower true
one: **no language model writes packet text at all.** Every sentence is selected
from the cited library verbatim, and the validator exists so that adding a tone
pass later is a bounded, reviewable change rather than a leap of faith. The
limits it cannot cover are asserted in the test suite instead of being left
implicit.

**Zero accessibility violations across 21 scans**, three surfaces, with
photophobia mode emitting ~38% less light than the default while holding 11:1
contrast.

## What we learned

The lesson that kept recurring: **a light day producing no symptoms is not good
news on its own.** It bit us three separate times — as collapse-to-zero, as a
patient promoted to "no accommodations" while barely functioning, and as an
under-exposure detector that went silent exactly when it was most needed. Every
one of those failures was in the over-restriction direction, which is the
direction a naive concussion tool fails in, and the direction current guidance
was specifically rewritten to prevent.

The other lesson: **measure the thing you are claiming.** Every headline number
in this project was wrong the first time we measured it, and every fix came from
building the measurement rather than from thinking harder.

## What's next

Human validation is the only thing that matters and the only thing we cannot do
in eleven days. Beyond that: real authentication — every mutation already passes
through a single `requireActor` gate, so making it production-grade means
replacing the body of one function rather than auditing every write path — plus
the Postgres schema wired up, clinician-side intake so restrictions can be
entered by the person who set them, and a proper screen-reader pass.

## Built with

TypeScript · Next.js · Tailwind · Bayesian inference (conjugate NIG, closed-form)
· Vitest · Playwright · axe-core · Drizzle

861 unit tests and 128 end-to-end tests, with the accessibility suite running on Chromium, Firefox and WebKit.

## What we are not claiming

- **Not** the first personalised pacing app. MyBrainPacer and Parkwood have that.
  Our claim is narrower: the first closed-loop accommodation *translator* built
  on personalised tolerance signals.
- **Not** clinically validated. All results are on synthetic cohorts with known
  ground truth. Not validated in humans. Not a medical device.
- **Not** a replacement for a clinician, and it never issues clearance.
