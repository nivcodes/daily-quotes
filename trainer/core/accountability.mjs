// The accountability domain: commitments, check-ins, streaks, adherence.
//
// This is the heart of the product now. The system's job is to notice,
// remember, and ask — not to calculate a diet. A commitment is something you
// said you'd do; a check-in is whether you did it. Everything else is derived.
//
// Pure functions over a plain state object. No I/O, no LLM, fully testable.

import { today, addDays, dayDiff, weekday, weekKey, range } from './days.mjs';

export const CADENCE = {
  /** Every day. */
  daily: 'daily',
  /** Specific weekdays, e.g. Tue/Thu. `days: [2, 4]` with 0 = Sunday. */
  days: 'days',
  /** N times a week, any days. `count: 3`. */
  perWeek: 'perWeek',
};

export const STATUS = { done: 'done', missed: 'missed', skipped: 'skipped' };

let counter = 0;
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

// ---------------------------------------------------------------- commitments

export function addCommitment(state, { text, cadence, createdAt = today() }) {
  const commitment = {
    id: newId('c'),
    text: text.trim(),
    cadence: normalizeCadence(cadence),
    createdAt,
    active: true,
    revisions: [],
  };
  state.commitments.push(commitment);
  return commitment;
}

function normalizeCadence(cadence) {
  if (typeof cadence === 'string') return { type: CADENCE.daily };
  if (cadence.type === CADENCE.days) return { type: CADENCE.days, days: [...cadence.days].sort() };
  if (cadence.type === CADENCE.perWeek) return { type: CADENCE.perWeek, count: cadence.count };
  return { type: CADENCE.daily };
}

/**
 * Change an existing commitment, recording that it changed.
 *
 * The record is the point. A real accountability partner notices when you keep
 * moving the goalposts — three revisions downward is information about the
 * commitment being wrong, and it should be said out loud rather than silently
 * accommodated.
 */
export function reviseCommitment(state, id, { text, cadence, at = today() }) {
  const c = getCommitment(state, id);
  if (!c) return null;
  c.revisions.push({
    at,
    from: { text: c.text, cadence: c.cadence },
    to: { text: text ?? c.text, cadence: cadence ? normalizeCadence(cadence) : c.cadence },
  });
  if (text) c.text = text.trim();
  if (cadence) c.cadence = normalizeCadence(cadence);
  return c;
}

export function archiveCommitment(state, id, { at = today() } = {}) {
  const c = getCommitment(state, id);
  if (!c) return null;
  c.active = false;
  c.archivedAt = at;
  return c;
}

export const getCommitment = (state, id) => state.commitments.find((c) => c.id === id) ?? null;
export const activeCommitments = (state) => state.commitments.filter((c) => c.active);

// ---------------------------------------------------------------- due dates

/** Is this commitment expected on this date? perWeek has no specific due day. */
export function isDueOn(commitment, date) {
  if (dayDiff(commitment.createdAt, date) < 0) return false;
  if (!commitment.active && commitment.archivedAt && dayDiff(commitment.archivedAt, date) < 0) return false;

  switch (commitment.cadence.type) {
    case CADENCE.daily:
      return true;
    case CADENCE.days:
      return commitment.cadence.days.includes(weekday(date));
    case CADENCE.perWeek:
      return false; // judged weekly, not daily — see weekProgress
    default:
      return false;
  }
}

/** Commitments due today that haven't been answered yet. This drives the nudge. */
export function openToday(state, date = today()) {
  return activeCommitments(state).filter(
    (c) => isDueOn(c, date) && !findCheckin(state, c.id, date),
  );
}

// ---------------------------------------------------------------- check-ins

export function checkIn(state, commitmentId, { date = today(), status, note } = {}) {
  if (!STATUS[status]) throw new Error(`unknown status: ${status}`);
  const existing = findCheckin(state, commitmentId, date);
  if (existing) {
    existing.status = status;
    if (note !== undefined) existing.note = note;
    return existing;
  }
  const entry = { id: newId('k'), commitmentId, date, status, ...(note ? { note } : {}) };
  state.checkins.push(entry);
  return entry;
}

export const findCheckin = (state, commitmentId, date) =>
  state.checkins.find((k) => k.commitmentId === commitmentId && k.date === date) ?? null;

export const checkinsFor = (state, commitmentId) =>
  state.checkins.filter((k) => k.commitmentId === commitmentId).sort((a, b) => a.date.localeCompare(b.date));

// ---------------------------------------------------------------- streaks

/**
 * Current and longest streak, counted over *due* days only — so a Tue/Thu gym
 * commitment isn't broken by not going on Wednesday.
 *
 * `skipped` is deliberately neutral: it neither extends nor breaks. Life has
 * legitimate interruptions, and a system that punishes a genuine sick day
 * teaches people to lie to it.
 */
export function streak(state, commitmentId, { asOf = today() } = {}) {
  const c = getCommitment(state, commitmentId);
  if (!c) return { current: 0, longest: 0 };

  if (c.cadence.type === CADENCE.perWeek) return weeklyStreak(state, c, asOf);

  const dueDates = range(c.createdAt, asOf).filter((d) => isDueOn(c, d));
  const byDate = new Map(checkinsFor(state, commitmentId).map((k) => [k.date, k.status]));

  let current = 0;
  let longest = 0;
  let run = 0;

  for (const date of dueDates) {
    const status = byDate.get(date);
    if (status === STATUS.done) run += 1;
    else if (status === STATUS.missed) run = 0;
    // unanswered or skipped: leave the run alone
    longest = Math.max(longest, run);
  }

  // Current streak walks backward, stopping at the first miss. `skipped` is
  // neutral here for the same reason it is in the forward pass above.
  for (let i = dueDates.length - 1; i >= 0; i--) {
    const status = byDate.get(dueDates[i]);
    if (status === STATUS.done) current += 1;
    else if (status === STATUS.missed) break;
    else if (status === STATUS.skipped) continue;
    else if (i === dueDates.length - 1) continue; // today simply isn't answered yet
    else break; // an unanswered day in the past ends the run
  }

  return { current, longest };
}

function weeklyStreak(state, commitment, asOf) {
  const weeks = [...new Set(range(commitment.createdAt, asOf).map(weekKey))];
  const done = checkinsFor(state, commitment.id).filter((k) => k.status === STATUS.done);

  let current = 0;
  let longest = 0;
  let run = 0;

  for (const [i, week] of weeks.entries()) {
    const hits = done.filter((k) => weekKey(k.date) === week).length;
    const isCurrentWeek = i === weeks.length - 1;
    if (hits >= commitment.cadence.count) run += 1;
    else if (!isCurrentWeek) run = 0;
    longest = Math.max(longest, run);
  }
  current = run;
  return { current, longest };
}

// ---------------------------------------------------------------- adherence

/**
 * Hit rate over a trailing window, over due days that have actually passed.
 * Returns `null` when there isn't enough history to mean anything — the same
 * discipline the weight-trend module uses. A 1-for-1 week is not "100%".
 */
export function adherence(state, commitmentId, { days = 14, asOf = today(), minDue = 3 } = {}) {
  const c = getCommitment(state, commitmentId);
  if (!c) return null;

  const from = addDays(asOf, -(days - 1));
  const start = dayDiff(c.createdAt, from) > 0 ? from : c.createdAt;

  if (c.cadence.type === CADENCE.perWeek) return weeklyAdherence(state, c, start, asOf, minDue);

  const due = range(start, asOf).filter((d) => isDueOn(c, d));
  const byDate = new Map(checkinsFor(state, commitmentId).map((k) => [k.date, k.status]));

  const counted = due.filter((d) => byDate.get(d) !== STATUS.skipped);
  if (counted.length < minDue) return { ready: false, due: counted.length, needed: minDue };

  const done = counted.filter((d) => byDate.get(d) === STATUS.done).length;
  return { ready: true, done, due: counted.length, rate: done / counted.length, windowDays: days };
}

function weeklyAdherence(state, commitment, start, asOf, minDue) {
  const weeks = [...new Set(range(start, asOf).map(weekKey))];
  if (weeks.length < 2) return { ready: false, due: weeks.length, needed: minDue };

  const done = checkinsFor(state, commitment.id).filter((k) => k.status === STATUS.done);
  const met = weeks.filter(
    (w) => done.filter((k) => weekKey(k.date) === w).length >= commitment.cadence.count,
  ).length;

  return { ready: true, done: met, due: weeks.length, rate: met / weeks.length, windowDays: weeks.length * 7 };
}

/** How many times a perWeek commitment has been hit in the current week. */
export function weekProgress(state, commitmentId, { asOf = today() } = {}) {
  const c = getCommitment(state, commitmentId);
  if (!c || c.cadence.type !== CADENCE.perWeek) return null;
  const week = weekKey(asOf);
  const hits = checkinsFor(state, commitmentId).filter(
    (k) => k.status === STATUS.done && weekKey(k.date) === week,
  ).length;
  return { hits, target: c.cadence.count, remaining: Math.max(0, c.cadence.count - hits) };
}

// ---------------------------------------------------------------- summary

/** Everything the coach needs to speak accurately about where things stand. */
export function summary(state, { asOf = today() } = {}) {
  return {
    date: asOf,
    commitments: activeCommitments(state).map((c) => ({
      id: c.id,
      text: c.text,
      cadence: c.cadence,
      dueToday: isDueOn(c, asOf),
      answeredToday: findCheckin(state, c.id, asOf)?.status ?? null,
      streak: streak(state, c.id, { asOf }),
      adherence: adherence(state, c.id, { asOf }),
      weekProgress: weekProgress(state, c.id, { asOf }),
      revisions: c.revisions.length,
    })),
    open: openToday(state, asOf).map((c) => ({ id: c.id, text: c.text })),
  };
}
