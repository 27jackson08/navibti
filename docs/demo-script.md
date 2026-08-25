# Demo video — script and shot list

**Target: 2:45–3:00.** Record at 1440×900 or larger, browser zoom 100%, window
chrome cropped out. Run `npm run build && npm run start` rather than the dev
server so nothing recompiles mid-take.

**Before recording**

```bash
npm run build && npm run start
```

Then open http://localhost:3000, click **Calm**, and reload. Do not record in
Night — the palette reads as a generic dark dashboard on video, and Calm makes
the deliberate low-glare choice visible. Have `/maya/today` and
`/maya/packet/school` pre-warmed in tabs so nothing loads slowly on camera.

**Note on the first click:** the reading-comfort buttons are React-hydrated.
Give the page a beat after load before clicking them on camera.

---

## 0:00 – 0:22 · The problem, not the app

**On screen:** a plain text card — an email, styled simply. No app yet.

> *"Hi — just checking whether Maya will be back for full days on Monday, since
> we'll need to plan around the assessment week."*

**Say:**

> Maya has a concussion. Her clinician told her something clinically precise:
> stay under her symptom threshold. No more than a two-point rise, lasting no
> more than an hour.
>
> Her school has no idea what that means. Neither does anyone's manager, or
> anyone's family. The restriction is exact, and it's invisible to every single
> person who can cause the overload.

**Why this shot is first:** if a judge sees the app before they see the gap,
NaviTBI looks like another symptom tracker. Twenty seconds on the email is the
whole pitch.

---

## 0:22 – 0:45 · The check-in

**Shot:** `/maya/check-in`, full flow, sped up 2× after the first two screens.

**Beats to land:**
- Red flags come **first**, every day, and "None of these" is the biggest target
  on the page
- One question per screen, no typing
- The duration question only appears **because** symptoms rose — the flow adapts

**Say:**

> Sixty seconds, designed for someone photophobic and exhausted. Red flags
> first — always, before anything else. One question per screen. No typing.
>
> Notice it just added a question. Symptoms rose, so it needs to know how long
> that lasted — because the guideline threshold is about magnitude *and*
> duration.

---

## 0:45 – 1:15 · The plan, and why each number is what it is

**Shot:** `/maya/today`. Scroll to *Today's limits*. Hover a dose card so the
headroom bar and its tick marks are visible.

**Say:**

> Five load domains, each with a number and — this is the part that matters —
> *what set it*.
>
> "Based on your own last few days" and "capped by the stage you're at" are
> completely different instructions to a patient deciding whether to push. So we
> say which.
>
> Every recommendation is the smallest of three things: what her own data
> supports, a gradual step up from yesterday, and the ceiling for the protocol
> step she's on. And then one thing that can only push it *up* — the guideline's
> minimum activity. Resting below that isn't safe either.

**Then scroll up to the two stage cards.**

> She's on both ladders at once. School governs how much thinking is reasonable.
> Sport governs physical progression — and step 4 of sport can't open until
> she's back at school full time. The app won't advance her, and it will never
> issue clearance.

---

## 1:15 – 1:35 · The explanation, and the refusal

**Shot:** the *Yesterday* card on `/maya/today`.

**Say:**

> After a bad day it explains what that day is most consistent with, and by how
> much — with a counterfactual.
>
> And when it can't tell, it says so. If two kinds of load moved together on
> every logged day, no method can separate them, so it refuses to name one. On
> our synthetic cohort it declines about two thirds of the time, and when it
> does name a driver it's right 98% of the time.

---

## 1:35 – 2:15 · The packet — *slow down here*

This is the novelty claim. Give it the most screen time of any shot.

**Shot:** click through to `/maya/packet/school`. Scroll slowly, top to bottom,
through the numbered items, the red-flag card, the sources, the disclaimer.

**Say:**

> Here's what nothing else does. The same tolerance, written for the person who
> has to act on it.
>
> One hour of class, in the morning. A fifteen-minute break every twenty minutes,
> scheduled — not requested, because a break you have to ask for in front of your
> class is a break you skip. Printed materials instead of screens. No timed
> tests.
>
> Every sentence comes from a cited library. None of it is generated prose — a
> language model here can rephrase, but it cannot invent a number, drop a limit,
> or stray into diagnosis or clearance. If it tries, we ship the template.

**Then switch to `/daniel/packet/employer`** — different person, same engine.

> Same engine, different audience. One meeting a day, twenty minutes, fifteen
> minutes between any two, camera off by default.

**Then `/maya/packet/caregiver`, scroll to the red-flag card.**

> And for family: the two ways to get this wrong — pushing too hard, and letting
> someone rest in a dark room for a week. Plus the emergency list, because
> they're the ones who'll be in the room.

---

## 2:15 – 2:32 · Sharing

**Shot:** `/maya/sharing`. Point at the disabled checkbox. Create a link, open
it, come back, revoke it, reload to the 404.

**Say:**

> The recipient won't make an account, so the link is the whole security
> boundary. Scoped to one audience. Expires. Revocable in one click. Every view
> logged and shown back to the patient.
>
> And a school link *cannot* carry her daily symptom scores. They need to know
> what she can manage — not her headache ratings.

---

## 2:32 – 3:00 · What we measured, and what we didn't

**Shot:** `results/evaluation.md` rendered, or the comparison table as a slide.

**Say:**

> We evaluated on four thousand synthetic patient-days with known ground truth.
> Six percent of our recommendations would have breached the guideline limit.
> A fixed guideline ceiling with no personalisation: fifty-one percent. And it
> never once over-estimated what someone could handle.
>
> Our own harness told us the first version was sixty percent unsafe, and the
> second version quietly recommended nothing at all — forever. Both were found
> by measuring, not by thinking harder.
>
> It is not validated in humans. It does not diagnose. It never clears anyone
> for sport. It is a translator — and right now, nothing is doing that job.

---

## Shot checklist

- [ ] Email card (0:00)
- [ ] Check-in: red flags screen, one scale screen, the added duration question
- [ ] Today: dose cards with binding labels; both stage cards
- [ ] Yesterday card with attribution
- [ ] School packet, scrolled fully, incl. sources + disclaimer
- [ ] Employer packet
- [ ] Caregiver packet red-flag card
- [ ] Sharing: disabled checkbox, create, open, revoke, 404
- [ ] Results table

## Things to avoid saying

- "Predicts recovery time" — it does not.
- "Clears" or "approves" anything.
- "First personalised pacing app" — MyBrainPacer and Parkwood have that.
- "Clinically validated", "proven", or any causal claim about a flare.
