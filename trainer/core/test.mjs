// Run with: node trainer/core/test.mjs
import assert from 'node:assert/strict';
import { addDays, weekday, range, weekKey } from './days.mjs';
import { emptyState } from './store.mjs';
import * as A from './accountability.mjs';
import * as P from './patterns.mjs';
import { dispatch } from './tools.mjs';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const START = '2026-01-01';
const asOf = (n) => addDays(START, n);

/** Seed a commitment plus a status per due day, from a function of the date. */
function seed(state, { cadence = { type: 'daily' }, text = 'walk', from = START, to, statusFor }) {
  const c = A.addCommitment(state, { text, cadence, createdAt: from });
  for (const date of range(from, to)) {
    if (!A.isDueOn(c, date)) continue;
    const status = statusFor(date);
    if (status) A.checkIn(state, c.id, { date, status });
  }
  return c;
}

const always = (status) => () => status;

// ---------------------------------------------------------------- cadence & due

test('cadence normalizes and sorts weekdays', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'gym', cadence: { type: 'days', days: [4, 2] } });
  assert.deepEqual(c.cadence, { type: 'days', days: [2, 4] });
});

test('daily is due every day, but not before it existed', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'walk', cadence: { type: 'daily' }, createdAt: asOf(5) });
  assert.equal(A.isDueOn(c, asOf(5)), true);
  assert.equal(A.isDueOn(c, asOf(6)), true);
  assert.equal(A.isDueOn(c, asOf(4)), false);
});

test('weekday cadence is only due on its days', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'gym', cadence: { type: 'days', days: [2, 4] }, createdAt: START });
  for (const d of range(START, asOf(13))) {
    assert.equal(A.isDueOn(c, d), [2, 4].includes(weekday(d)), d);
  }
});

test('perWeek has no daily due date — it is judged weekly', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'run', cadence: { type: 'perWeek', count: 3 }, createdAt: START });
  assert.equal(A.isDueOn(c, asOf(1)), false);
  assert.deepEqual(A.weekProgress(s, c.id, { asOf: asOf(1) }), { hits: 0, target: 3, remaining: 3 });
});

test('openToday drops what has already been answered', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'walk', cadence: { type: 'daily' }, createdAt: START });
  assert.equal(A.openToday(s, asOf(3)).length, 1);
  A.checkIn(s, c.id, { date: asOf(3), status: 'done' });
  assert.equal(A.openToday(s, asOf(3)).length, 0);
});

test('check_in on the same day updates rather than duplicating', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'walk', cadence: { type: 'daily' }, createdAt: START });
  A.checkIn(s, c.id, { date: asOf(1), status: 'missed' });
  A.checkIn(s, c.id, { date: asOf(1), status: 'done', note: 'went after all' });
  assert.equal(s.checkins.length, 1);
  assert.equal(s.checkins[0].status, 'done');
  assert.equal(s.checkins[0].note, 'went after all');
});

// ---------------------------------------------------------------- streaks

test('streak counts consecutive done days', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(9), statusFor: always('done') });
  assert.deepEqual(A.streak(s, c.id, { asOf: asOf(9) }), { current: 10, longest: 10 });
});

test('a miss breaks the current streak but not the longest', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(9), statusFor: (d) => (d === asOf(7) ? 'missed' : 'done') });
  const r = A.streak(s, c.id, { asOf: asOf(9) });
  assert.equal(r.current, 2, 'days 8 and 9');
  assert.equal(r.longest, 7, 'days 0 through 6');
});

test('skipped is neutral — it neither extends nor breaks', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(5), statusFor: (d) => (d === asOf(3) ? 'skipped' : 'done') });
  assert.equal(A.streak(s, c.id, { asOf: asOf(5) }).current, 5);
});

test("today being unanswered does not break the streak", () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(4), statusFor: always('done') });
  // day 5 exists as a due day but has no check-in yet
  assert.equal(A.streak(s, c.id, { asOf: asOf(5) }).current, 5);
});

test('an unanswered day in the past does stop the current streak', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(5), statusFor: (d) => (d === asOf(3) ? null : 'done') });
  assert.equal(A.streak(s, c.id, { asOf: asOf(5) }).current, 2, 'days 4 and 5');
});

test('weekday streaks ignore days the commitment was never due', () => {
  const s = emptyState();
  const c = seed(s, {
    cadence: { type: 'days', days: [2, 4] },
    to: asOf(20),
    statusFor: always('done'),
  });
  const r = A.streak(s, c.id, { asOf: asOf(20) });
  assert.ok(r.current >= 5, `got ${r.current} — should count only Tue/Thu`);
  assert.equal(r.current, r.longest);
});

test('perWeek streaks count weeks that met the target', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'run', cadence: { type: 'perWeek', count: 2 }, createdAt: START });
  // Two hits in each of the first three weeks
  for (const w of [0, 1, 2]) {
    A.checkIn(s, c.id, { date: addDays(weekKey(START), w * 7 + 1), status: 'done' });
    A.checkIn(s, c.id, { date: addDays(weekKey(START), w * 7 + 3), status: 'done' });
  }
  const r = A.streak(s, c.id, { asOf: addDays(weekKey(START), 20) });
  assert.ok(r.current >= 3, `got ${r.current}`);
});

// ---------------------------------------------------------------- adherence

test('adherence refuses to report a rate from too little data', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(1), statusFor: always('done') });
  const r = A.adherence(s, c.id, { asOf: asOf(1) });
  assert.equal(r.ready, false);
  assert.equal(r.needed, 3);
});

test('adherence computes a rate over due days', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(9), statusFor: (d) => (d <= asOf(2) ? 'missed' : 'done') });
  const r = A.adherence(s, c.id, { asOf: asOf(9), days: 10 });
  assert.equal(r.ready, true);
  assert.equal(r.due, 10);
  assert.equal(r.done, 7);
  assert.ok(Math.abs(r.rate - 0.7) < 1e-9);
});

test('skipped days are excluded from adherence, not counted as failures', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(9), statusFor: (d) => (d <= asOf(2) ? 'skipped' : 'done') });
  const r = A.adherence(s, c.id, { asOf: asOf(9), days: 10 });
  assert.equal(r.due, 7);
  assert.equal(r.rate, 1);
});

// ---------------------------------------------------------------- patterns

test('worstWeekday finds the day that keeps failing', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(27), statusFor: (d) => (weekday(d) === 4 ? 'missed' : 'done') });
  const r = P.worstWeekday(s, c.id, { asOf: asOf(27) });
  assert.equal(r.found, true);
  assert.equal(r.weekday, 4);
  assert.equal(r.weekdayName, 'Thursday');
  assert.equal(r.rate, 1);
});

test('worstWeekday stays quiet on thin or patternless data', () => {
  const s = emptyState();
  const thin = seed(s, { to: asOf(3), statusFor: always('missed') });
  assert.equal(P.worstWeekday(s, thin.id, { asOf: asOf(3) }).found, false);

  const s2 = emptyState();
  const even = seed(s2, { to: asOf(27), statusFor: (d) => (d.endsWith('3') ? 'missed' : 'done') });
  assert.equal(P.worstWeekday(s2, even.id, { asOf: asOf(27) }).found, false);
});

test('trend compares the last two weeks', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(27), statusFor: (d) => (d <= asOf(13) ? 'missed' : 'done') });
  const r = P.trend(s, c.id, { asOf: asOf(27) });
  assert.equal(r.ready, true);
  assert.equal(r.direction, 'improving');
  assert.equal(r.recentRate, 1);
  assert.equal(r.priorRate, 0);
});

test('trend refuses without two comparable windows', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(5), statusFor: always('done') });
  assert.equal(P.trend(s, c.id, { asOf: asOf(5) }).ready, false);
});

test('goalpost-moving notices repeated easing', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'gym', cadence: { type: 'daily' }, createdAt: START });
  A.reviseCommitment(s, c.id, { cadence: { type: 'days', days: [1, 3] } });
  A.reviseCommitment(s, c.id, { cadence: { type: 'perWeek', count: 1 } });
  const r = P.goalpostMoving(s, c.id);
  assert.equal(r.found, true);
  assert.equal(r.direction, 'easier');
  assert.equal(r.downward, 2);
});

test('a single revision is not a pattern', () => {
  const s = emptyState();
  const c = A.addCommitment(s, { text: 'gym', cadence: { type: 'daily' }, createdAt: START });
  A.reviseCommitment(s, c.id, { cadence: { type: 'perWeek', count: 2 } });
  assert.equal(P.goalpostMoving(s, c.id).found, false);
});

test('silent drift catches a commitment that just stopped being mentioned', () => {
  const s = emptyState();
  A.addCommitment(s, { text: 'stretch', cadence: { type: 'daily' }, createdAt: START });
  const drift = P.silentDrift(s, { asOf: asOf(14) });
  assert.equal(drift.length, 1);
  assert.equal(drift[0].text, 'stretch');

  A.checkIn(s, s.commitments[0].id, { date: asOf(12), status: 'missed' });
  assert.equal(P.silentDrift(s, { asOf: asOf(14) }).length, 0, 'a miss is engagement, not drift');
});

test('co-missing finds commitments that fail together', () => {
  const s = emptyState();
  const statusFor = (d) => (d <= asOf(3) ? 'missed' : 'done');
  seed(s, { text: 'gym', to: asOf(13), statusFor });
  seed(s, { text: 'no snacking', to: asOf(13), statusFor });

  const pairs = P.coMissing(s, { asOf: asOf(13) });
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].conditional, 1);
  assert.ok(pairs[0].sharedDays >= 6);
});

test('co-missing stays quiet when failures are independent', () => {
  const s = emptyState();
  seed(s, { text: 'gym', to: asOf(13), statusFor: (d) => (d <= asOf(3) ? 'missed' : 'done') });
  seed(s, { text: 'no snacking', to: asOf(13), statusFor: always('done') });
  assert.equal(P.coMissing(s, { asOf: asOf(13) }).length, 0);
});

test('observations rank the structural problems above the trends', () => {
  const s = emptyState();
  const c = seed(s, { to: asOf(27), statusFor: (d) => (d <= asOf(13) ? 'done' : 'missed') });
  A.reviseCommitment(s, c.id, { cadence: { type: 'perWeek', count: 1 } });
  A.reviseCommitment(s, c.id, { cadence: { type: 'perWeek', count: 1 }, text: 'gym sometimes' });

  const obs = P.observations(s, { asOf: asOf(27) });
  assert.ok(obs.length >= 2);
  assert.equal(obs[0].kind, 'goalpost_moving');
  assert.ok(obs.some((o) => o.kind === 'trend_slipping'));
});

test('a clean slate produces no observations', () => {
  const s = emptyState();
  seed(s, { to: asOf(27), statusFor: always('done') });
  assert.deepEqual(P.observations(s, { asOf: asOf(27) }), []);
});

// ---------------------------------------------------------------- tool dispatch

test('tools add, check in, and report without inventing numbers', () => {
  const s = emptyState();
  const added = dispatch(s, 'add_commitment', {
    text: 'walk after dinner',
    cadence: { type: 'days', days: ['tue', 'thu'] },
  });
  assert.deepEqual(added.added.cadence, { type: 'days', days: [2, 4] });

  const checked = dispatch(s, 'check_in', { commitment_id: added.added.id, status: 'done' });
  assert.equal(checked.recorded, 'done');
  assert.equal(checked.adherence.ready, false, 'one check-in is not an adherence rate');

  const status = dispatch(s, 'get_status', {});
  assert.equal(status.commitments.length, 1);
  assert.equal(status.weight.entries, 0);
});

test('log_weight parses free text and reports a trend, not the raw number', () => {
  const s = emptyState();
  const r = dispatch(s, 'log_weight', { value: '183.4 lb', date: START });
  assert.equal(r.recorded.lb, 183.4);
  assert.equal(r.rate.ready, false, 'one weigh-in is not a rate');

  assert.ok(dispatch(s, 'log_weight', { value: 'banana' }).error);
});

test('tools reject unknown ids and unknown names instead of throwing', () => {
  const s = emptyState();
  assert.ok(dispatch(s, 'check_in', { commitment_id: 'nope', status: 'done' }).error);
  assert.ok(dispatch(s, 'archive_commitment', { commitment_id: 'nope' }).error);
  assert.ok(dispatch(s, 'nonsense', {}).error);
});

// ---------------------------------------------------------------- runner

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
console.log(`\n${passed}/${tests.length} passed${failed ? `, ${failed} failed` : ''}`);
process.exit(failed ? 1 : 0);
