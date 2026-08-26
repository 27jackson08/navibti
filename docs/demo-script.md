# Demo video — script and shot list

**Target: 3:00–3:15.** Record at 1440×900 or larger, browser zoom 100%, window
chrome cropped.

## Before recording

```bash
pkill -9 -f "next-server"; pkill -9 -f "next start"   # both names — one survives the other
npm run build && npm run start
```

Then open http://localhost:3000, click **Calm**, and reload. Do not record in
Night: the palette reads as a generic dark dashboard on video, and Calm makes the
deliberate low-glare choice visible.

**Two things that will bite you on camera.**

The reading-comfort and check-in buttons are React-hydrated — give each page a
beat after load before clicking, or the first click does nothing.

The demo store is in memory and accumulates. Restart the server for a clean run,
and do a full rehearsal first: the flag in §6 changes Tom's plan permanently
until you restart.

---

## 0:00 – 0:20 · The problem, not the app

**On screen:** a plain text card — an email, styled simply. No app yet.

> *"Hi — just checking whether Maya will be back for full days on Monday, since
> we'll need to plan around assessment week."*

**Say:**

> Maya has a concussion. Her clinician told her something clinically precise:
> stay under her symptom threshold. No more than a two-point rise, lasting no
> more than an hour.
>
> Her school has no idea what that means. Neither does anyone's manager, or
> anyone's family. The restriction is exact, and it's invisible to every person
> who can cause the overload.

**Why first:** if a judge sees the interface before they see the gap, NaviTBI
files as another symptom tracker. Twenty seconds on the email is the pitch.

---

## 0:20 – 0:40 · The check-in

**Shot:** `/maya/check-in`. Show the audio toggle, then the flow at 2× after the
first two screens.

- Red flags come **first**, every day, and "None of these" is the biggest target
- One question per screen, no typing
- The duration question appears **because** symptoms rose — the flow adapts

**Say:**

> Sixty seconds, for someone photophobic and exhausted. It'll read itself aloud
> if you ask — because a check-in that needs a lit screen is one you skip on
> exactly the days worth recording.
>
> Red flags first, always. And it just added a question: symptoms rose, so it
> needs to know how long — the threshold is about size *and* duration.

---

## 0:40 – 1:05 · The plan, and why each number is what it is

**Shot:** `/tom/today`. Scroll to *Today's limits*. Hover a dose card.

**Say:**

> Five kinds of load, each with a number and — this matters — *what set it*.
>
> "Based on your own last few days" and "capped by the stage you're at" are
> different instructions to someone deciding whether to push. So we say which.
>
> Every number is the smallest of three things: what their data supports, a
> gradual step up from yesterday, and the ceiling for their stage. Then one
> thing that can only push it *up* — the guideline's minimum. Resting below that
> isn't safe either.

**Then Maya, showing both stage cards.**

> She's on both ladders at once. School governs how much thinking is reasonable,
> sport governs physical progression — and sport step 4 can't open until she's
> back at school full time.

---

## 1:05 – 1:20 · The explanation, and the refusal

**Shot:** the *Yesterday* card, then the *What costs you most* note.

> After a bad day it says what that day is most consistent with, with a
> counterfactual. And when it can't tell, it says so — if two kinds of load moved
> together every day, no method separates them, so it refuses to name one.
>
> Across all check-ins it'll also name what costs this person most, and what that
> pattern resembles clinically. It describes a resemblance. It never assigns
> anyone a subtype — that's a judgement made with an examination, and this is
> self-reported minutes.

---

## 1:20 – 1:50 · The packet — *slow down*

**Shot:** `/maya/packet/school`, scrolled top to bottom: numbered items,
red-flag card, sources, disclaimer. Then `/tom/packet/employer`.

> Here's what nothing else does. The same tolerance, written for the person who
> has to act on it.
>
> One hour of class, in the morning. A fifteen-minute break every twenty minutes,
> *scheduled* — not requested, because a break you have to ask for in front of
> your class is a break you skip. Printed materials. No timed tests.
>
> Every sentence comes from a cited library. No language model writes packet
> text — that's the guarantee, not a validator.
>
> Same engine, different audience: one meeting a day, twenty minutes, camera off
> by default.

---

## 1:50 – 2:20 · The loop closes — **the strongest shot in the demo**

**Shot:** `/tom/sharing` → create an employer link → open it → flag *"No
back-to-back meetings"* → back to `/tom/today`.

**Say:**

> Every other tool stops at the document. This is the part that makes it
> coordination.
>
> Tom's manager opens the link. No account. And she can tell us something back —
> not free text, a fixed set of reasons. She says they can't do gaps between
> meetings.

**On `/tom/today`, point at the number.**

> His concentration budget just moved from 144 minutes to 115, and it says why.
> Some accommodations aren't comfort — they're what *makes* a dose safe. Forty
> minutes of class is tolerable *because* a break follows it. If the break isn't
> there, the forty minutes isn't safe any more.
>
> The plan adapts to the room the patient is actually in.

---

## 2:20 – 2:35 · The clinician

**Shot:** create a clinician link, open it, record clearance for Maya.

> The clinician gets the record, not instructions — trajectory, adherence, and
> what the workplace said it couldn't provide, because a plateau might be a plan
> that was never actually available.
>
> And clearance is recorded here, only here. A patient can't clear themselves.
> NaviTBI still decides nothing — it records that a named person decided it.

---

## 2:35 – 2:50 · Progress

**Shot:** `/tom/history`.

> The person doing the work is usually the last to see it's working. Every day
> replayed from only what was known at the time — no hindsight.
>
> And when a number has gone down, it says that usually means the model learned
> something costs more than it assumed, not that recovery reversed.

---

## 2:50 – 3:15 · What we measured, and what we didn't

**Shot:** `results/evaluation.md` or the comparison table as a slide.

> Four thousand synthetic patient-days with known ground truth. Six percent of
> our recommendations would have breached the limit. A fixed guideline ceiling:
> fifty-one percent. No tool at all: forty-eight. And it never once
> over-estimated what someone could handle.
>
> Halve every starting assumption, then double them — the safety rate moves
> between four and nine percent. So that's the guardrails, not priors we picked.
>
> It is *not* well calibrated. It over-predicts risk about threefold. It's safe
> because it's pessimistic, not because it's precise, and that's in our results
> because you should hear it from us.
>
> Not validated in humans. Doesn't diagnose. Never clears anyone for sport. It's
> a translator — and right now, nothing is doing that job.

---

## Shot checklist

- [ ] Email card
- [ ] Check-in: audio toggle, red flags, a scale, the added duration question
- [ ] Today: dose cards with binding labels; Maya's two stage cards
- [ ] Yesterday attribution + "what costs you most"
- [ ] School packet scrolled fully, incl. sources and disclaimer
- [ ] Employer packet
- [ ] **Sharing → open link → flag an item → plan changes** (rehearse this)
- [ ] Clinician link: summary, record clearance
- [ ] History page
- [ ] Results table
- [ ] Optional: `/how-it-works` if you have 10 spare seconds

## Do not say

- "Predicts recovery time" — it does not.
- "Clears" or "approves" anything.
- "First personalised pacing app" — MyBrainPacer and Parkwood have that.
- "Diagnoses a subtype" — it describes a resemblance.
- "Clinically validated", "proven", or any causal claim about a flare.
