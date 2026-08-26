# Final week — what to build, and why

Seven build days (Aug 26 → Sep 2), submitting two days early. Ordered by how much
each closes a gap between what NaviTBI *claims* and what it *does* — which is
where a judge's scepticism will land first.

---

## The honest assessment

Five of six criteria are in good shape. The scoring risk is concentrated in
three specific holes, and two of them are places where the product does not yet
do what the pitch says.

| Criterion | State | Biggest remaining risk |
|---|---|---|
| Clinical & domain effectiveness | Strong | Nothing can record clearance, so sport progression dead-ends |
| Safety & responsible design | Strongest | — |
| Neuroscience understanding | **Weakest** | Five load domains are asserted, never explained or grounded in mechanism |
| Research foundation | Strong | — |
| Technical complexity | Strong | Evaluation is single-scenario; no sensitivity analysis |
| UX & accessibility | Strong | No patient-facing progress view; audio-first check-in was cut |

---

## Gap 1 — "Coordinator" is not built

The Devpost claim is a *closed-loop accommodation translator **and
coordinator***. The loop with the patient closes. The loop with everyone else
does not: share links are a one-way broadcast. A school reads the packet and
NaviTBI never learns whether they received it, acted on it, or could not.

This is the single largest divergence between claim and product, and it is also
the most defensible feature nobody else has.

**Build: recipient response on the share page.**

- **Acknowledge.** One button. "We've received this." Timestamped, shown back to
  the patient and in the clinician summary.
- **Flag an item as not workable.** Per accommodation, with a reason from a short
  list — *no quiet room available*, *cannot change the timetable*, *needs
  approval*. Not free text from an unauthenticated stranger.
- **What that does to the plan.** A flagged accommodation is marked unavailable,
  and the composer substitutes the next-best item covering the same load domain
  if the library has one. If it does not, the patient is told plainly that a
  needed adjustment is unavailable, and the clinician summary flags it.

That last part is what makes it coordination rather than a comment box: a school
saying *"we have no quiet room"* actually changes the plan.

**Guardrails.** Responses are typed choices, never free text — an
unauthenticated party must not be able to inject prose into a clinical document.
A recipient can never raise a limit, only report that they cannot meet one.

---

## Gap 2 — The clearance gate has no key

Maya sits at Return-to-Sport step 3 permanently. Step 4 needs written medical
clearance, `StageState.clearance` exists, and **no interface can set it**. A
judge who clicks through the sport ladder hits a wall with no explanation of how
a real patient would pass it.

**Build: a clinician intake surface.**

- Record clearance: who recorded it, when, which step it covers.
- Record the confirmed injury date and starting stage, rather than inferring both.
- Record hard restrictions a clinician has set directly, which override the model
  downward but never upward.
- Make it reachable from the clinician summary, which clinicians already receive.

This also strengthens *"assists clinicians"* — currently they only read.

**Guardrails.** NaviTBI still issues nothing. It records what a clinician says
they decided, attributes it to them by name, and stamps it. The stage machine's
refusal to self-clear is unchanged.

---

## Gap 3 — Neuroscience understanding is asserted, not shown

The five load domains are the neuroscience content, and they appear nowhere
except as labels. Nothing explains why *these* five, or what mechanism each
tracks. This is the criterion most likely to be scored on what a judge can see.

**Build: mechanism, made visible and cited.**

- A short, cited explanation per domain — what it loads, why concussion
  narrows it, and what the guidance says about re-exposure. Surfaced where the
  domain appears, not buried in a docs page.
- **Map the five domains onto the recognised clinical profiles** (cognitive-
  fatigue, vestibular, ocular-motor, cervical, anxiety-mood, post-traumatic
  migraine). Show which domains are driving *this* recovery, phrased as
  observation, never as assigning a subtype — the same "most consistent with"
  discipline the attribution engine already uses.
- Explain gradual re-exposure as a mechanism rather than a rule: why
  sub-threshold load is therapeutic and why strict rest is not.

**Guardrails.** Describing a pattern, never diagnosing a profile. Every claim
cited; anything uncited does not ship.

---

## Gap 4 — Patients cannot see they are getting better

The clinician gets a trajectory. The patient gets today. Recovery is long,
non-linear and demoralising, and "you tolerated 40 minutes three weeks ago and
110 today" is genuine clinical value, not decoration.

**Build:** a patient history view — tolerance by domain over time, stage
transitions marked, flare days marked, and the honest shape of a recovery rather
than a smoothed line.

---

## Gap 5 — Yesterday's plan is never compared to yesterday

The original concept said the loop dials back when a plan is exceeded. Adherence
is computed for the clinician; the patient is never told they went over.

**Build:** a short, non-judgemental note when yesterday's load exceeded the plan
— what was exceeded, what followed, and what today's plan does about it. Worded
so it never reads as blame, because blame is how someone stops logging honestly.

---

## Gap 6 — Cheaper wins worth taking

- **Audio-first check-in.** Spoken prompts via SpeechSynthesis so the daily log
  can be done eyes-closed. In the original concept, cut on day 2. The strongest
  remaining accessibility differentiator.
- **Print affordance on packets.** The print stylesheet exists; nothing invites
  anyone to use it. A school files paper.
- **Reading-level test.** Assert every packet sentence sits at or below roughly
  grade 9. Testable, and it matters for equity: an accommodation letter nobody
  can parse is not an accommodation.
- **New-patient onboarding.** A judge who wants to try it with their own numbers
  currently cannot.

---

## Gap 7 — Make the evaluation harder to dismiss

Currently one synthetic scenario. Three additions, in order of value:

1. **Sensitivity to the prior.** Re-run the cohort with the prior deliberately
   wrong — half and double each weight. If the safety rate holds, the result is
   not an artefact of priors we chose ourselves. This is the first thing a
   sceptical judge would ask.
2. **Calibration.** When the model says a dose carries a 20% chance of breaching
   the limit, does it breach ~20% of the time? Plot it.
3. **A naive baseline.** Compare against "yesterday's load, unchanged" — the
   implicit policy of a symptom tracker with no pacing at all.

---

## Schedule

| Day | Build |
|---|---|
| Aug 26 | Recipient response: acknowledge, flag, and the plan reacting to a flag |
| Aug 27 | Recipient response finished; clinician summary and patient view surface it |
| Aug 28 | Clinician intake: clearance, injury date, hard restrictions |
| Aug 29 | Neuroscience: domain mechanism content, clinical-profile mapping, citations |
| Aug 30 | Patient history view; adherence feedback |
| Aug 31 | Audio-first check-in; print affordance; reading-level test; onboarding |
| Sep 1 | Evaluation: prior sensitivity, calibration, naive baseline; re-run everything |
| Sep 2 | Full re-audit, docs and Devpost updated to match, **submit** |

Recording the demo needs a stable build: freeze features after Aug 31 and treat
Sep 1–2 as verification only.

## Cut list, in order

1. New-patient onboarding
2. Naive baseline in the evaluation
3. Audio-first check-in *input* (keep the spoken prompts)
4. Clinical-profile mapping (keep the per-domain mechanism content)
5. Patient adherence feedback

**Never cut:** the recipient response loop. It is the difference between the
claim being true and being aspirational.
