# Text-based AI coach — MVP design

A weight-management coach that lives entirely in SMS/WhatsApp. You text it what you
ate, it texts you back. No app to open, no database to search, no barcode to scan.

The working prototype of the numeric core is in `engine/` — run `node engine/test.mjs`.

---

## Where I'd push back

You asked for pushback, so this goes first. Three of these are about the goal-body
photo, because that feature is simultaneously the best hook in the product and the
one that can hurt people.

### 1. "Send a pic of your goal body" is the right hook and the wrong mechanic

The instinct is right: nobody is motivated by "lose 15 lb," everybody is motivated by
a picture. And asking for it is a genuinely great first interaction — it takes two
seconds and it tells you more about what someone wants than five survey questions.

The problem is what products normally *do* with it. Store it, show it back, put it next
to a photo of the user, use it as the progress bar. That is the exact mechanic of
thinspo — a reference body you are measured against daily — and the population that
most wants a goal-body feature overlaps heavily with the population at risk for
disordered eating. Building the comparison loop is how a diet app becomes a trigger.

There's a second problem that's just as fatal commercially: most goal photos are
unreachable. They're lean *and* muscular *and* well-lit *and* often enhanced. The
user reads that as "a diet." It's usually a multi-year project where the dominant
term is muscle they don't have yet, not fat they need to lose. Someone who sets an
impossible target quits around week six, and they blame themselves.

**What I'd build instead:** keep the photo intake, change its job. The photo is
consumed *once*, to calibrate expectations, then discarded. It is never stored, never
shown again, and never displayed next to the user's body. What persists is a text
target and a 12-week milestone.

Concretely, for a 5'11" 220 lb man who sends a lean-athletic reference photo, the
engine (`calibrateGoal`) produces:

> That look is around 14% body fat. For your frame that's about **179 lb** — but here's
> the honest version: **roughly 15 months**. About 28 weeks of fat loss, then most of a
> year of eating at maintenance and lifting, because that physique carries more muscle
> than you do right now. The fat-loss part is the easy half.
>
> So let's not aim at 15 months. **Twelve weeks, 201 lb.** That's 19 lb, it's very
> doable, and you'll see it in the mirror. Then we'll talk about the next block.

And when the reference is below the healthy floor, it refuses and counter-offers rather
than lecturing:

> That's around 6% body fat. Below roughly 10% is stage-prep territory — it's held for a
> few weeks, with real hormonal cost, and it's not a place to live. I can get you to lean
> and keep you there: **175 lb, about 31 weeks.** Want that instead?

Refusing a target is a retention feature, not a compliance tax. It's the moment the
product proves it isn't lying to you, and it's the thing that separates it from every
"transform your body in 8 weeks" competitor.

### 2. Don't estimate body fat from photos as a routine feature

Vision estimates of body fat are ±5–8 percentage points. Publishing "you're at 24.3%"
is precision theater, and it's the number users screenshot and get angry about. Use
photos in exactly two places: the one-time goal calibration above (as a coarse band,
never a decimal), and user-initiated progress comparison at **8+ week** gaps, where
change is actually visible. Weekly progress photos mostly teach people to scrutinize
themselves.

### 3. "Personal trainer" is the less valuable half — lead with food

For weight management specifically, nutrition is where nearly all the leverage is, and
training programming is the part that needs equipment, schedule and injury context to
not be generic slop. Ship nutrition + accountability as *the product*. Ship training as
three fixed templates chosen by equipment access (none / dumbbells / full gym), with
progressive overload tracked by text. Don't build an AI programmer in v0 — it triples
the surface area and it's the half users would forgive you for omitting.

### 4. Let people pick engagement, but make the default direction *down*

Picking a level up front is good. The failure mode is that everyone picks "intense" at
signup — motivated-day-one self is not the person who has to answer at 9pm on a
Wednesday — and then churns. So: any level is changeable by text at any time
("chill out" / "push me harder"), and non-response **auto-downshifts** rather than
escalating. Two ignored check-ins drops a tier. Nagging is the number one uninstall
reason for every app in this category, and an SMS product can't be uninstalled quietly —
it gets reported as spam.

### One more, unprompted: calorie precision doesn't matter as much as you'd think

Both the user's food estimates and our TDEE equation are wrong by 10–20%. Chasing
input precision is a losing game. Instead the system treats the calorie target as a
**hypothesis** and the scale as the **measurement**: `engine/trend.mjs` watches the
smoothed weight trend and moves the target until observed rate matches intended rate.
After about three weeks it's calibrated to that specific person and the initial error
stops mattering. This is why the product can afford to accept "chicken burrito bowl,
regular size" as a log entry and show a *range* rather than a fake-exact 487 kcal.

---

## The product

### Onboarding (~2 minutes, 7 turns)

1. **Goal, in their words.** Free text. "I want to not be winded on stairs" is a better
   goal than a number and the model should keep it and reuse it later.
2. **Stats.** Height, weight, age, sex at birth (stated plainly: it's what the BMR
   equation is fitted on), activity level. `engine/units.mjs` parses whatever they text —
   `5'10`, `178cm`, `185`, `84 kg`.
3. **Safety check**, framed as 30 seconds, not a medical intake. Age, pregnancy,
   relevant conditions, and the SCOFF items (see below).
4. **Engagement tier.**
5. **Goal photo** (optional, skippable) → calibration → milestone negotiation.
6. **The plan, stated once, with the reasoning visible.**
7. **First check-in scheduled.** Ends with a single easy action, not a lecture.

For the 220 lb example the plan lands at maintenance 2695, target **2022 kcal**,
134g protein / 50g fat / 259g carb, **−1.35 lb/week**.

### Engagement tiers

| Tier | Outbound | Logging ask |
|---|---|---|
| **Light** | 1 message/week | Weekly weigh-in only |
| **Standard** | Morning nudge + evening check-in | Meals when convenient, daily weigh-in |
| **Intense** | Per-meal prompts, evening review, weekly report | Everything, plus training |

All three get the same math. The tier only changes outbound frequency and how much the
coach asks for. Users can switch by texting.

### The daily loop

- **Inbound** is unstructured: `"eggs and toast"`, `"183.4"`, `"skipped the gym, work was insane"`,
  a photo of a plate. The model classifies and routes to a tool. No commands, no syntax.
- **Food** returns a range and a running budget: *"~450–600. Puts you around 1,400 with
  dinner to go — you've got room for something real."*
- **Weight** goes into the EMA, never echoed raw as a judgment.
- **Misses** get a response calibrated to not moralize. One bad day is noise; the system
  knows that because it's looking at a 21-day trend, so it can afford to actually mean it.
- **Weekly**: trend, adherence, and — at most every 14 days — a target adjustment with the
  reason attached.

---

## Architecture

```
SMS/WhatsApp (Twilio) → webhook → orchestrator → LLM w/ tools → Postgres
                                       ↑
                              scheduler (cron) for outbound check-ins
```

The load-bearing decision: **the model is the interface, not the brain.** Every number
comes from `engine/`, a pure, deterministic, unit-tested module. The model chooses
*when* to call it and *how to say the answer out loud*; it never computes a calorie
target and never sees a path around a safety block.

This isn't fussiness. An LLM that invents "1,150 calories" for a 200 lb man because the
conversation had momentum is the single most dangerous failure mode in this product,
and the fix has to be architectural — you cannot prompt your way to a guarantee. The
engine's floors (`max(BMR, 1200/1500)`), deficit cap (25% of TDEE), and rate cap
(1%/week) hold regardless of what the conversation does.

### Tool surface

| Tool | Notes |
|---|---|
| `log_food(description, photo?)` | Returns a **range**, plus remaining budget |
| `log_weight(kg)` | Feeds the EMA; returns trend, not raw delta |
| `log_activity(description)` | Adjusts nothing directly — see below |
| `get_status()` | Today's budget, week's trend, streak |
| `build_plan(profile)` | The only source of a calorie number |
| `calibrate_goal(estimate)` | Goal-photo flow; can refuse |
| `propose_adjustment()` | Rate-limited to once per 14 days |
| `set_engagement(tier)` | User-initiated or auto-downshift |
| `escalate(reason)` | Halts coaching, delivers referral copy |

`log_activity` deliberately does *not* add calories back to the budget. Exercise
expenditure is the most over-reported number in fitness tracking, it's already inside
the activity multiplier, and "earning back" calories is a mechanic worth not teaching.

### Data model (sketch)

```
users        id, phone, tz, tier, created_at, state
profiles     user_id, height_cm, weight_kg, age, sex, activity, conditions[],
             screening_result, screened_at
targets      user_id, kcal, protein_g, fat_g, carb_g, rate_pct, effective_from,
             reason, superseded_by
weights      user_id, date, weight_kg           -- trend is derived, never stored
food_logs    user_id, ts, raw_text, kcal_low, kcal_high, confidence
messages     user_id, direction, body, tool_calls, ts
events       user_id, type, payload, ts         -- escalations, tier changes, adjustments
```

Photos are **not** in the schema. Goal photos are held in memory for the duration of the
calibration call and dropped (`photoRetention: 'discard_after_estimate'`, enforced in
the storage layer rather than by the model remembering to). Progress photos, when added,
belong in separate encrypted blob storage with independent deletion — health data plus
body photos plus a phone number is about the most sensitive tuple a consumer product can
hold, and it needs to be deletable in one text.

---

## Safety spec

Implemented in `engine/safety.mjs`, run before any deficit talk and re-run on every
profile change. Blocks are not overridable by conversation.

**Hard blocks (no coaching):**
- Under 18.
- SCOFF ≥ 2, or disclosed eating-disorder history. The correct product response is to
  stop selling weight loss and hand over a referral — not to make a clinical claim, and
  not to coach carefully.

**Soft blocks (maintenance mode, not a closed door):**
- BMI < 18.5 with a loss goal.
- Pregnant or breastfeeding with a loss goal.

**Cautions (slower cap, 0.5%/week):**
- BMI 18.5–20 with a loss goal → recomposition is suggested instead.
- Age 65+ → muscle and bone retention take priority.
- Clinical flags: insulin/sulfonylurea, GLP-1 agonists, kidney disease, cardiac
  conditions, post-bariatric. GLP-1 users in particular are a growing share of this
  market and their risk is *under*-eating and lean-mass loss, so the coaching inverts.

**Target gates:** goal body fat below 10% (male) / 18% (female), or a goal weight under
18.5 BMI, is refused with a counter-offer.

**Ongoing:** sustained loss >1.5%/week and >1.75× prescribed triggers an interrupt —
that pattern is either large under-reporting or something medical, and both are worth
stopping the program for.

### On the SCOFF questions

They're blunt ("do you ever make yourself sick because you feel uncomfortably full?")
and there's a real argument they'll cost signups. I'd still ship them, in onboarding,
before any number is quoted. Screening after someone's invested in a plan is worse for
them and worse for you, and it's a two-item threshold on a validated instrument — this
is the cheapest possible version of doing it properly. If product pushes back, the
compromise I'd accept is asking three of the five and monitoring conversation signals
for the rest; I would not accept dropping it.

---

## What to measure

Not weight lost. Selection bias makes it meaningless — the people still reporting at
week 12 are the people it worked for.

- **D7 / D30 logging adherence** — the actual leading indicator, and the thing this
  product is trying to buy with low friction.
- **Response rate to outbound**, per tier. This is how you detect nagging before it
  becomes spam reports.
- **Weigh-in capture rate** — below ~3/week the feedback loop can't calibrate.
- **Tier migration** — down-migration is healthy signal, not failure.
- **Time-to-first-log** after onboarding.
- **Escalation rate**, reviewed by a human, every one.

## Cost

Per active user per month, roughly: LLM 100–250 messages with vision on a slice, call it
**$0.60–1.50**; SMS at ~$0.008/segment two-way, **$1.50–3.00** at Standard tier (WhatsApp
is materially cheaper and should be the default where it has share). So **$2–5/user/mo**
of variable cost. Note that Intense tier can cost 3× Light while a flat price doesn't
move — worth pricing tiers separately or capping outbound.

## Scope

**In v0:** SMS onboarding, screening, plan generation, food/weight logging, trend-based
adjustment, three engagement tiers, goal-photo calibration, weekly review.

**Not in v0:** training programming beyond three templates, barcode/food database
integration, macro micro-management, social features, wearable sync, a companion app,
recipes, meal plans. Meal plans in particular sound essential and aren't — adherence to
a prescribed plan is worse than adherence to a budget you spend yourself.

## Open questions

1. **Regulatory posture.** This is wellness, not a medical device, but the GLP-1 and
   diabetes cohorts push toward clinical territory. Worth a lawyer before launch, not after.
2. **What happens at goal.** Maintenance is the hardest phase and where every product
   abandons people. It may also be the only defensible retention story.
3. **Human in the loop.** A dietitian reviewing escalations and a sample of conversations
   is the highest-leverage safety spend and probably affordable at small scale.
4. **WhatsApp vs SMS** depends on geography; template-message rules materially constrain
   proactive check-ins on WhatsApp and that should be checked before committing.

## Running the engine

```bash
node trainer/engine/test.mjs   # 38 tests, no dependencies
```

`engine/units.mjs` parsing · `energy.mjs` BMR/TDEE/targets/macros · `trend.mjs` EMA,
observed rate, adjustment, plateau · `safety.mjs` screening and gates ·
`calibrate.mjs` goal-photo flow · `index.mjs` `buildPlan()`.
