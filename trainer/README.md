# An accountability partner that lives in a text conversation

Personal use. You tell it what you're going to do; it remembers, asks, and notices
things about you that you can't see from the inside. It does **not** prescribe diets,
calorie targets, or training programmes — that's a deliberate scope choice, not a
missing feature.

```bash
cd trainer
npm install

# No API key needed for any of these:
npm test                            # 77 tests, no network
node cli.mjs demo                   # seed six weeks of history and show what it finds
node cli.mjs status                 # local summary of your real data

# Talking to it needs a key:
export ANTHROPIC_API_KEY=...        # console.anthropic.com
node cli.mjs                        # talk to it
node cli.mjs nudge                  # one check-in message (cron-friendly)
```

`demo` writes to `~/.trainer/demo.json`, separate from your real data, so you can
poke at it freely. To hold a conversation against the demo history:
`TRAINER_DATA=~/.trainer/demo.json node cli.mjs`

Data lives in one JSON file at `~/.trainer/data.json` (`TRAINER_DATA` to override) —
inspectable, editable, trivially backed up, no database to stand up.

```
$ node cli.mjs demo

2026-08-06
  ✓ walk after dinner (daily)
      42 in a row  ·  100% of 14
  · gym (Tue/Thu)
      no streak  ·  50% of 4
  · no snacking after 9pm (daily)
      no streak  ·  29% of 14
  · stretch 10 minutes (daily)
      no streak  ·  0% of 14
    meal prep on Sundays (1x/week)
      1 in a row  ·  33% of 3

  192.6 lb trend  ·  -1.13 lb/wk over 21 days

Worth noticing
  • "meal prep on Sundays" has been revised down 2 times.
  • "stretch 10 minutes" hasn't been mentioned in 10 due days.
  • "no snacking after 9pm" went from 86% to 29% over the last two weeks.
```

## Why this shape

The original design (kept in [`DESIGN.md`](DESIGN.md)) was a full nutrition coach:
TDEE, macro splits, goal-photo calibration, screening. The pivot to accountability-only
is the better product, and not just for liability reasons — adherence, not knowledge,
is where weight management actually fails. Everyone already knows to eat less. Almost
nobody has someone who remembers what they said on Tuesday.

So the system's job is to **notice, remember, and ask**. Less "your target is 2,022
kcal", more "you said Tuesday was gym day, that's twice now — what's actually in the
way?"

## What it does

- **Commitments** in your own words, with a cadence: daily, specific weekdays, or
  N-times-a-week. It records them when you mention them; there's no form to fill in.
- **Check-ins** in any phrasing. "Went this morning" is a done. `skipped` exists for
  genuine interruptions and is neutral — it neither extends nor breaks a streak,
  because a system that punishes a real sick day teaches you to lie to it.
- **Streaks and adherence** over *due* days only, so a Tue/Thu commitment isn't broken
  by not going on Wednesday. Rates refuse to report at all below a minimum sample —
  one good day is not "100%".
- **Weight** if you want it, smoothed with an EMA and reported as a trend, never as
  today's raw number.
- **Patterns**, which is the actual point — see below.

## The noticing layer

`core/patterns.mjs` is what separates this from a habit tracker. Each detector refuses
to speak without a real sample, because a fabricated pattern teaches you that the
observations are noise — and then the true ones get ignored too.

| Detector | Finds | Won't fire without |
|---|---|---|
| `worstWeekday` | The day a commitment keeps dying on | 3+ of that weekday, and a real gap over the commitment's own baseline |
| `trend` | Adherence slipping or improving | Two comparable 14-day windows |
| `goalpostMoving` | The same commitment revised easier, repeatedly | 2+ revisions |
| `silentDrift` | Quiet abandonment — never marked missed, just stopped being mentioned | 4+ unanswered due days |
| `coMissing` | Two commitments that fail together | 6+ shared due days, and a conditional rate clearing baseline |

`observations()` ranks them and the coach mentions **at most one**. Five observations
is a dashboard; one well-timed observation is a friend.

`goalpostMoving` is the one I'd point at. Revising a commitment isn't hidden or
punished — it's recorded, and repeated easing gets said out loud once, plainly: the
commitment is probably wrong, not you. That's a thing a real accountability partner
does and a habit app never will.

## Architecture

```
cli.mjs ──▶ channels/adapter.mjs ──▶ core/coach.mjs ──▶ Claude (tools)
                                          │
                                          ▼
                      core/{accountability,patterns,tools,store}.mjs
                      engine/{trend,units,energy,safety}.mjs
```

Same stance as the original design: **the model is the interface, not the brain.** It
decides when to call a tool and how to phrase the answer; it never computes a streak,
an adherence rate, or a trend. Those come from pure, tested functions. The system
prompt says it explicitly — *never state a streak or a rate from memory* — but the
guarantee is architectural, not a prompt instruction, because you can't prompt your
way to one.

**The channel seam is real.** `channels/adapter.mjs` gives you `handle(text)`,
`nudge()`, and `status()`. To add Telegram or SMS you write a file that creates a
session, calls `handle` on each inbound message, and calls `nudge` on a schedule.
There is nothing else to implement, and no coach logic belongs in a channel.

### API notes

`claude-opus-5`, adaptive thinking left on at `effort: "low"` — low effort is
unusually strong on this model and is the right latency/cost lever for a chat app.
Thinking is deliberately *not* disabled: with thinking off, Opus 5 can emit a tool
call as plain text, which completes the turn while silently doing nothing. `max_tokens`
is 8192 because thinking shares that budget. The system prompt is cached
(`cache_control`), and `stop_reason` is checked before the content array is read.

The loop is hand-written rather than using the SDK's beta tool runner — for a
single-file personal tool, owning ~25 lines beats taking a beta dependency.

## Tests

77, no network and no API key required.

- `engine/test.mjs` (38) — the numeric core carried over from the original design:
  BMR/TDEE, calorie floors and deficit caps, weight EMA, plateau detection, screening
  gates. Most of it is dormant in this build; the floors and trend maths are live.
- `core/test.mjs` (31) — cadence and due-dates, streaks (including that `skipped` is
  neutral in both directions — that was a real bug the test caught), adherence
  minimums, every pattern detector including its refusal cases, tool dispatch.
- `core/loop.test.mjs` (8) — the agentic loop against a stubbed client: tool dispatch,
  `tool_use_id` round-tripping, parallel tool calls returned in one message, refusal
  handling, the runaway-loop guard, persistence across restarts.

## Not built

No Telegram/SMS channel yet (the seam is there). No scheduler — `cli.mjs nudge` is
cron-ready but nothing schedules it. No photo handling. No food logging beyond
free-text notes. Nothing from `DESIGN.md`'s goal-photo calibration flow is wired in,
though `engine/calibrate.mjs` still passes its tests if you want it back.

## A caveat worth keeping

This is built for one person who chose it. The screening logic in `engine/safety.mjs`
still exists and still works, but nothing in the accountability flow calls it — that's
fine for personal use and would **not** be fine if you ever handed this to someone
else. If this stops being just yours, re-read `DESIGN.md` first.
