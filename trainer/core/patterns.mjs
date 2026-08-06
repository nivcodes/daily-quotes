// Noticing.
//
// This is what an accountability partner is actually for. Anyone can ask "did
// you go to the gym"; the value is in "that's the third Thursday in a row" —
// the thing you can't see about yourself because you're inside it.
//
// Every detector here refuses to speak without a real sample. Fabricating a
// pattern from four data points is worse than saying nothing: it teaches the
// user that the observations are noise, and then the true ones get ignored too.

import { today, addDays, dayDiff, weekday, dayName, WEEKDAY_NAMES, range } from './days.mjs';
import {
  CADENCE, STATUS, activeCommitments, getCommitment, isDueOn, checkinsFor, adherence,
} from './accountability.mjs';

/**
 * Which day of the week does this commitment die on?
 *
 * Needs at least `minPerDay` occurrences of the suspect weekday, and the miss
 * rate has to clear the commitment's own baseline by a real margin — otherwise
 * every commitment has a "worst day" by definition.
 */
export function worstWeekday(state, commitmentId, { asOf = today(), minPerDay = 3, margin = 0.3 } = {}) {
  const c = getCommitment(state, commitmentId);
  if (!c || c.cadence.type === CADENCE.perWeek) return { found: false, reason: 'not_applicable' };

  const byDate = new Map(checkinsFor(state, commitmentId).map((k) => [k.date, k.status]));
  const due = range(c.createdAt, asOf)
    .filter((d) => isDueOn(c, d))
    .filter((d) => byDate.has(d) && byDate.get(d) !== STATUS.skipped);

  if (due.length < minPerDay * 2) return { found: false, reason: 'insufficient_data', answered: due.length };

  const buckets = new Map();
  for (const date of due) {
    const dow = weekday(date);
    const b = buckets.get(dow) ?? { total: 0, missed: 0 };
    b.total += 1;
    if (byDate.get(date) === STATUS.missed) b.missed += 1;
    buckets.set(dow, b);
  }

  const overallMissed = due.filter((d) => byDate.get(d) === STATUS.missed).length / due.length;

  let worst = null;
  for (const [dow, b] of buckets) {
    if (b.total < minPerDay) continue;
    const rate = b.missed / b.total;
    if (!worst || rate > worst.rate) worst = { dow, rate, missed: b.missed, total: b.total };
  }

  if (!worst || worst.rate < overallMissed + margin || worst.missed < 2) {
    return { found: false, reason: 'no_clear_pattern' };
  }

  return {
    found: true,
    weekday: worst.dow,
    weekdayName: WEEKDAY_NAMES[worst.dow],
    missed: worst.missed,
    total: worst.total,
    rate: worst.rate,
    baseline: overallMissed,
  };
}

/**
 * Is adherence going up or down? Compares the trailing window to the one
 * before it. Both windows must have enough due days to be comparable.
 */
export function trend(state, commitmentId, { asOf = today(), windowDays = 14, margin = 0.2 } = {}) {
  const recent = adherence(state, commitmentId, { asOf, days: windowDays });
  const priorAsOf = addDays(asOf, -windowDays);
  const prior = adherence(state, commitmentId, { asOf: priorAsOf, days: windowDays });

  if (!recent?.ready || !prior?.ready) return { ready: false, reason: 'insufficient_data' };

  const delta = recent.rate - prior.rate;
  return {
    ready: true,
    recentRate: recent.rate,
    priorRate: prior.rate,
    delta,
    direction: Math.abs(delta) < margin ? 'flat' : delta > 0 ? 'improving' : 'slipping',
  };
}

const load = (cadence) =>
  cadence.type === CADENCE.daily ? 7 : cadence.type === CADENCE.days ? cadence.days.length : cadence.count;

/**
 * Goalpost-moving. Repeatedly revising a commitment downward is a signal that
 * the commitment is wrong, not that the person is failing — and saying so is
 * more useful than another nudge. Named plainly, without judgment.
 */
export function goalpostMoving(state, commitmentId, { minRevisions = 2 } = {}) {
  const c = getCommitment(state, commitmentId);
  if (!c || c.revisions.length < minRevisions) return { found: false };

  const downward = c.revisions.filter((r) => load(r.to.cadence) < load(r.from.cadence)).length;
  const upward = c.revisions.filter((r) => load(r.to.cadence) > load(r.from.cadence)).length;

  return {
    found: true,
    revisions: c.revisions.length,
    downward,
    upward,
    direction: downward > upward ? 'easier' : upward > downward ? 'harder' : 'lateral',
    originalCadence: c.revisions[0].from.cadence,
    currentCadence: c.cadence,
  };
}

/**
 * Commitments that fail together. Useful because the fix is usually upstream of
 * both — you didn't skip the gym *and* eat badly, you had a bad week.
 */
export function coMissing(state, { asOf = today(), minShared = 6, margin = 0.25 } = {}) {
  const active = activeCommitments(state).filter((c) => c.cadence.type !== CADENCE.perWeek);
  const status = (id, date) => checkinsFor(state, id).find((k) => k.date === date)?.status;
  const pairs = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const [a, b] = [active[i], active[j]];
      const start = dayDiff(a.createdAt, b.createdAt) > 0 ? b.createdAt : a.createdAt;

      const shared = range(start, asOf).filter(
        (d) => isDueOn(a, d) && isDueOn(b, d) && status(a.id, d) && status(b.id, d),
      );
      if (shared.length < minShared) continue;

      const aMissed = shared.filter((d) => status(a.id, d) === STATUS.missed);
      if (aMissed.length < 2) continue;

      const bothMissed = aMissed.filter((d) => status(b.id, d) === STATUS.missed).length;
      const conditional = bothMissed / aMissed.length;
      const baseline = shared.filter((d) => status(b.id, d) === STATUS.missed).length / shared.length;

      if (conditional > baseline + margin && bothMissed >= 2) {
        pairs.push({
          a: { id: a.id, text: a.text },
          b: { id: b.id, text: b.text },
          sharedDays: shared.length,
          conditional,
          baseline,
        });
      }
    }
  }
  return pairs.sort((x, y) => y.conditional - x.conditional);
}

/**
 * Quiet abandonment — the failure mode a streak counter misses entirely,
 * because nothing was ever marked missed. It just stopped being mentioned.
 */
export function silentDrift(state, { asOf = today(), lookbackDays = 10, minDue = 4 } = {}) {
  const from = addDays(asOf, -(lookbackDays - 1));
  return activeCommitments(state)
    .map((c) => {
      const due = range(dayDiff(c.createdAt, from) > 0 ? from : c.createdAt, asOf).filter((d) => isDueOn(c, d));
      if (due.length < minDue) return null;
      const answered = checkinsFor(state, c.id).filter((k) => dayDiff(from, k.date) >= 0);
      if (answered.length > 0) return null;
      return { id: c.id, text: c.text, unansweredDue: due.length, since: from };
    })
    .filter(Boolean);
}

/**
 * Everything worth mentioning, ranked. The coach gets this and decides what (if
 * anything) to actually say — usually at most one thing. An accountability
 * partner who lists five observations is a dashboard, not a partner.
 */
export function observations(state, { asOf = today() } = {}) {
  const out = [];

  for (const c of activeCommitments(state)) {
    const drift = goalpostMoving(state, c.id);
    if (drift.found && drift.direction === 'easier') {
      out.push({
        kind: 'goalpost_moving',
        priority: 1,
        commitmentId: c.id,
        text: `"${c.text}" has been revised down ${drift.downward} time${drift.downward === 1 ? '' : 's'}.`,
        detail: drift,
      });
    }

    const t = trend(state, c.id, { asOf });
    if (t.ready && t.direction !== 'flat') {
      out.push({
        kind: `trend_${t.direction}`,
        priority: t.direction === 'slipping' ? 2 : 4,
        commitmentId: c.id,
        text:
          `"${c.text}" went from ${Math.round(t.priorRate * 100)}% to ${Math.round(t.recentRate * 100)}% ` +
          'over the last two weeks.',
        detail: t,
      });
    }

    const day = worstWeekday(state, c.id, { asOf });
    if (day.found) {
      out.push({
        kind: 'weekday_pattern',
        priority: 3,
        commitmentId: c.id,
        text: `"${c.text}" gets missed on ${day.weekdayName}s — ${day.missed} of ${day.total}.`,
        detail: day,
      });
    }
  }

  for (const d of silentDrift(state, { asOf })) {
    out.push({
      kind: 'silent_drift',
      priority: 1,
      commitmentId: d.id,
      text: `"${d.text}" hasn't been mentioned in ${d.unansweredDue} due days.`,
      detail: d,
    });
  }

  for (const pair of coMissing(state, { asOf })) {
    out.push({
      kind: 'co_missing',
      priority: 3,
      text: `"${pair.a.text}" and "${pair.b.text}" tend to go down together.`,
      detail: pair,
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

export { dayName };
