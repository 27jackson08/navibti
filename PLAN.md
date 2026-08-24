# NaviTBI — Build Plan

**Return-to-Life Accommodation Engine.** Translates a concussion patient's daily
tolerance into role-specific, shareable accommodations for schools, employers,
caregivers, and clinicians.

Hackathon: Hack for Humanity Summer '26, Concussion track (Concussion Alliance +
Synapse). **Submissions close Sept 4, 2026 — 11 days from Aug 24, not 2 weeks.**

---

## 0. Corrections to the original brief

These are load-bearing; fix them everywhere before they propagate into the demo,
the README, and the Devpost writeup.

| Brief said | Correct | Why it matters |
|---|---|---|
| "6th Berlin Consensus" | Berlin = **5th** (2016). **6th = Amsterdam 2023** (Patricios et al., BJSM; conference Oct 2022, published Jun 2023) | Miscitation on a criterion literally named "Research Foundation" |
| "standard RTL 6-step framework" | **Return-to-Learn = 4 steps.** Return-to-Sport/Activity = 6 steps | The student packet is built on the wrong ladder |
| "max 2-point increase, mild and brief" | "No more than a 2-point increase **compared with the pre-activity value** on a **0–10** symptom severity scale," worsening for **up to 1 hour** | Defines the model's target variable — see §3.2 |

Two more domain facts worth encoding, because getting them right signals real
domain knowledge:

- **Medical clearance is NOT required to return to school.** It IS required to
  progress to RTS Step 4+. Tools that gate school return on a doctor's note are
  over-restrictive and contradict the guideline. NaviTBI must state this asymmetry.
- **Strict rest is out.** Amsterdam recommends relative rest for a *maximum of
  24–48h*, then early light activity. "A complete absence from the school
  environment for more than one week is not generally recommended." This means the
  engine must also detect **under-exposure** and nudge upward — not just cap.
  Every competitor pacing app only limits. This is a real differentiator.

Sources to cite in-app and on Devpost:
- Patricios JS et al. *Consensus statement on concussion in sport: the 6th
  International Conference, Amsterdam 2022.* Br J Sports Med 2023.
- PedsConcussion, *Living Guideline Return to Activity/Sport & Return to
  School/Learn Protocols*, Sept 2023. https://pedsconcussion.com
- Ontario Neurotrauma Foundation, *Living Concussion Guidelines* (adults 18+),
  incl. return-to-work guidance.

---

## 1. Scope decision

Ship **one closed loop end to end** rather than six half-features. The loop:

    check-in → tolerance estimate → today's dose plan → accommodation packets
             → share links → tomorrow's check-in re-fits the model

Everything else is cut list (§9).

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| App | Next.js 15 App Router + TypeScript | One repo, one deploy, server actions; no separate API to babysit |
| Styling | Tailwind + CSS custom properties in `styles/tokens.css` | Tokens required for the photophobia/contrast controls |
| DB | Postgres (Neon free tier) + Drizzle ORM | Share links need server persistence; SQLite won't survive serverless |
| Engine | **Pure TypeScript, in-process** | See below |
| Auth | Token-based demo accounts; share links are unguessable + revocable | No time for real auth; don't fake HIPAA |
| Deploy | Vercel | Free, instant, custom domain for the demo |
| Test | Vitest (engine, TDD) + Playwright (one happy path) + axe-core | Engine correctness is the differentiator; test it properly |

**No Python service.** The tolerance model is conjugate Bayesian linear
regression — closed-form updates, ~150 lines of TypeScript, no numpy needed. A
second service doubles deploy risk for zero capability gain, and keeping it
in-process means the model is unit-testable in the same suite as everything else.

---

## 2. Architecture

Two engines, deliberately separated. This separation *is* the safety story:

- **Stage machine — deterministic, guideline-verbatim.** Encodes RTL 1–4 and
  RTS 1–6 exactly as published. Never personalized, never inferred. Governs what
  is *permitted*.
- **Tolerance model — personalized, probabilistic.** Governs *how much*, within
  whatever the stage already permits. Never advances a stage.

The model can only ever recommend a dose inside a box the guideline already drew.

```
src/
├── app/
│   ├── (patient)/check-in/          60-second flow
│   ├── (patient)/today/             plan + why
│   ├── (patient)/history/           trajectory
│   ├── share/[token]/               role-scoped read-only view
│   └── api/
├── components/
│   ├── check-in/                    Stepper, VasDial, VoicePrompt
│   ├── plan/                        DoseCard, HeadroomBar, Attribution
│   ├── packet/                      SchoolPacket, WorkPacket, CaregiverGuide, ClinicianSummary
│   └── ui/
├── engine/
│   ├── stage/                       RTL/RTS state machine + progression rules
│   ├── tolerance/                   posterior.ts, threshold.ts, ramp.ts
│   ├── attribution/                 contribution decomposition + counterfactuals
│   ├── safety/                      red flags, escalation, output validator
│   └── packet/                      accommodation composition
├── data/
│   ├── guidelines/                  encoded protocol steps + citations
│   ├── accommodations/              library: item, domain, dose band, citation
│   └── synthetic/                   cohort generator
├── db/                              Drizzle schema
├── hooks/                           useReducedMotion, useSpeech, useLowStim
├── lib/
└── styles/tokens.css
scripts/eval/                        evaluation harness → results/
```

Follows the repo convention of feature-folders over type-folders; keep files
200–400 lines, 800 hard cap.

---

## 3. Engine specs

### 3.1 Load domains

Five domains, matching how recovery is actually staged clinically:

| Domain | Unit tracked | Example inputs |
|---|---|---|
| `cognitive` | focused-minutes | classes, meetings, reading, deep work |
| `visualVestibular` | exposure-minutes | screens, motion/travel, busy environments |
| `physical` | RPE-weighted active minutes | walking, cycling, gym |
| `sleepFatigue` | sleep debt (hours) | sleep duration, naps, wake quality |
| `emotionalAutonomic` | 0–10 + exposure-minutes | stress, noise, social load |

### 3.2 Tolerance model

**Target variable: `Δ` = worst within-day symptom increase over the pre-activity
value, on the 0–10 VAS, and its duration.** This is chosen so the model's output
maps 1:1 onto the guideline's own threshold ("no more than 2 points, no more than
one hour"). Two check-in questions carry the entire model.

Bayesian linear regression with a Normal–Inverse-Gamma conjugate prior:

    Δ ~ N(w·x + b, σ²),   (w, σ²) ~ NIG(μ₀, Λ₀, a₀, b₀)

- Closed-form posterior update each night. No sampling, no training loop.
- **Prior is weakly positive, not zero-mean** — all loads plausibly increase
  symptoms, sleep debt strongly so. Encode this and cite it; a zero-mean prior
  would be clinically wrong.
- **Tolerance for domain d** = the largest dose q where the posterior predictive
  (Student-t) satisfies `P(Δ > 2 | dose = q) ≤ α`, with α conservative (~0.2).

This is the elegant part: **sparse data → wide posterior → automatically lower
recommended dose.** The "conservative fallback when data is sparse" requirement
falls out of the math rather than being bolted on as a special case. Say this out
loud in the demo.

**Recommended dose = min(model tolerance, ramp cap, stage cap)** where the ramp
cap is ≤ ~20% over yesterday's tolerated dose (graduated progression), and the
stage cap comes from the deterministic stage machine.

**Under-exposure floor.** If logged dose sits far below tolerance for 2+ days
while symptoms are stable, surface an *increase* prompt with the anti-strict-rest
citation. This is the feature no competitor has.

### 3.3 Flare attribution

Given posterior mean `w` and today's exposures `x`, contribution_d = `w_d · x_d`,
normalized and ranked. Report with a counterfactual:

> "Today's spike is **most consistent with** 3 back-to-back video calls on 5h
> sleep. Had meetings been 2 instead of 5, predicted increase would be 1.2
> rather than 3.4."

**Identifiability gate:** if two domains are strongly collinear in this user's own
history (check posterior correlation), refuse to name a single cause — say both
moved together and we can't separate them yet. Refusing to over-explain is a
safety feature and it demonstrates that you understand your own model's limits.

Never diagnostic. Always "most consistent with."

### 3.4 Accommodation packet composition

The genuinely novel core, and the piece with the most safety exposure.

**Curated library, not free generation.** Each accommodation item is a record:
`{ id, text, domain, doseBand, role, citation, stageMin, stageMax }`. Composition
is a deterministic query over tolerance + stage + role. An LLM pass may *rephrase
for tone only*, behind a validator that rejects any output introducing a
recommendation not present in the selected item set.

That constraint — *the model can rephrase but cannot introduce a clinical claim* —
is worth a slide on its own.

Four roles:

- **School (RTL steps 1–4):** shortened day, break cadence, screen caps, one
  test/day, no timed tests, printed over screen materials, extended deadlines,
  no makeup-work backlog, quiet space, early hallway pass, permission to leave
  class without explanation.
- **Employer:** meeting count + duration caps, no back-to-back, async-first,
  camera-off default, deep-work hour budget, 20-20-20 screen breaks, phased
  hours ramp, defer high-stakes cognitive tasks.
- **Caregiver:** do/don't guide, check-in scripts that don't hover, red-flag card.
- **Clinician:** one page — VAS trajectory, current stage + date entered,
  exposure vs tolerance, flare events, adherence, escalation triggers. Printable.

**Regenerate only on material change, and show a diff.** A school office will not
accept a fresh document every morning. Version packets; surface "what changed
since the copy you have."

### 3.5 Safety layer

Hard rules, enforced in `engine/safety/` and unit-tested:

- **Red flags** (CRT6 list: neck pain/tenderness, double vision, weakness or
  tingling in limbs, severe or increasing headache, seizure, LOC, deteriorating
  consciousness, repeated vomiting, increasing agitation) → full-screen
  interrupt, emergency-care instruction, **no plan generated**.
- **Never clears sport.** RTS Step 4+ requires written medical clearance; the app
  displays the requirement and refuses to advance.
- **Never gates school return on clearance** — states the opposite, correctly.
- **Prolonged symptoms** (>14 days adult / >4 weeks child) → clinician-escalation
  banner citing the Living Guidelines.
- **<3 days of data** → population prior only, labeled provisional, wide margins.
- Every generated artifact carries: not-medical-advice framing, source citation,
  generation date, current stage.
- No diagnosis, no imaging, no medication content anywhere.
- Share links: role-scoped minimum data, expiry, one-click revoke, audit log.
  Patient chooses whether tolerance bands are shared without raw symptom detail.

---

## 4. Data model (Drizzle)

`patients` · `check_ins` · `exposures` · `symptom_events` · `stage_transitions` ·
`model_snapshots` (posterior params per day — needed for reproducibility and for
the trajectory chart) · `plans` · `packets` (versioned) · `share_links` ·
`access_log`.

Store the posterior, not just the point estimate. It's what makes the history
view honest and the eval harness possible.

---

## 5. Synthetic cohort + evaluation

No human data exists and none should be collected in 11 days. Instead: a
generator producing realistic 21-day trajectories from **known ground-truth
coefficients**, which converts "we built a model" into "we measured our model."

`scripts/eval/` produces `results/` for the Devpost writeup:

1. **Threshold recovery** (n=200 synthetic patients): MAE between estimated and
   true tolerance, by day. Expect usable by day 5–7 — matches the brief's claim.
2. **Safety rate:** share of recommended doses that would have caused >2-point
   exacerbation under ground truth. Target <5%. This is the headline number.
3. **Attribution accuracy:** top-1 cause correct vs. ground truth.
4. **Red-flag recall:** 100% on scripted red-flag inputs (deterministic — prove it).
5. **Accessibility:** axe-core clean, full keyboard path, Lighthouse.

Three demo personas: 16-year-old student athlete, 34-year-old knowledge worker,
9-year-old with a caregiver driving the check-ins.

---

## 6. UX & accessibility requirements

These are product requirements, not polish — the users are photophobic and
cognitively fatigued.

- **Low-stimulation by default.** No pure white, no pure black, nothing saturated.
  Warm dimmed "photophobia mode" plus a user brightness/warmth control that still
  clears 4.5:1. Note the real tension: WCAG pushes contrast up, photophobia pushes
  glare down. Resolve it with luminance reduction rather than contrast reduction,
  and say so — that tension is a great answer to an accessibility judging question.
- **No motion by default.** `prefers-reduced-motion` honored, no autoplay, no parallax.
- **Audio-first check-in.** SpeechSynthesis prompts + Web Speech API input, so the
  daily log can be done eyes-closed.
- **Minimal typing.** Dials, steppers, large tap targets.
- **Resumable.** ≤60s target, but never lose progress if the user has to stop.
- Adjustable text size, capped line length, optional dyslexia-friendly face.
- Full keyboard nav, ARIA, screen-reader pass.
- Design direction: calm clinical, not the default dark SaaS dashboard.

---

## 7. Eleven-day schedule (Aug 24 → Sept 4)

| Day | Date | Deliverable |
|---|---|---|
| 1 | Aug 24 | Scaffold, Drizzle schema, design tokens, **encode guideline data** (RTL/RTS steps, red flags, accommodation library seed) |
| 2 | Aug 25 | Check-in flow + persistence |
| 3 | Aug 26 | Stage machine + tests (TDD — guideline text is the spec) |
| 4 | Aug 27 | Tolerance model + posterior update + tests |
| 5 | Aug 28 | Synthetic generator; model recovers ground truth |
| 6 | Aug 29 | Attribution + counterfactuals + collinearity gate |
| 7 | Aug 30 | Today's plan UI + headroom visualization |
| 8 | Aug 31 | Packet composition + 4 role views |
| 9 | Sep 1 | Share links, consent, revocation, versioned diffs |
| 10 | Sep 2 | Safety pass, eval harness → results, axe/Lighthouse audit |
| 11 | Sep 3 | Demo video + Devpost writeup |
| — | Sep 4 | Buffer + submit **early** |

Team splits: 2 people → one on engine+eval, one on UI+packets. 3–4 → add
guideline-data/accommodation-library owner (this is more work than it looks) and
a demo/writeup owner starting Day 8.

---

## 8. Devpost positioning

Claim: **"the first closed-loop accommodation translator/coordinator built on
personalized tolerance signals."**

Do NOT claim first personalized pacing app — MyBrainPacer and Parkwood hold that.
Do NOT claim clinical validation. State plainly: evaluated on synthetic cohorts
with known ground truth; not validated in humans; not a medical device.

Lead the demo with the *stakeholder* problem, not the app: show the school email,
then show the packet. The novelty is the translation layer — make a judge see the
gap in the first 20 seconds.

---

## 9. Cut list (in order, if behind)

1. Voice input (keep TTS prompts — cheaper, most of the benefit)
2. Child/caregiver persona (keep student + worker)
3. Clinician PDF export (show the on-screen summary instead)
4. Packet version diffs (keep versioning, drop the diff UI)
5. LLM tone pass (deterministic templates alone are safer anyway)

Never cut: red-flag interrupt, stage machine, not-medical-advice framing,
citations. Those are the judged criteria.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| 11 days, not 14 | Loop-first scope; cut list above; submit Sept 3 |
| No real patient data | Synthetic ground truth + explicit non-validation statement |
| Over-claiming to judges | Pre-write the limitations slide before building |
| Model looks like a black box | Attribution + posterior intervals + collinearity refusal |
| Accommodation text becomes de facto medical advice | Curated library + output validator; LLM cannot introduce claims |
