// A seeded six weeks, so the pattern detectors have something real to find.
//
// Written into a separate file from your actual data — poking at the demo can
// never clobber a live history.

import { today, addDays, weekday, range } from './days.mjs';
import { emptyState } from './store.mjs';
import * as A from './accountability.mjs';
import { lbToKg } from '../engine/units.mjs';

const WEEKS = 6;

export function buildDemoState({ asOf = today() } = {}) {
  const state = emptyState();
  const start = addDays(asOf, -(WEEKS * 7 - 1));
  const dayIndex = (d) => range(start, d).length - 1;

  const commit = (text, cadence) => A.addCommitment(state, { text, cadence, createdAt: start });
  const fill = (c, statusFor) => {
    for (const date of range(start, asOf)) {
      if (!A.isDueOn(c, date)) continue;
      const status = statusFor(date, dayIndex(date));
      if (status) A.checkIn(state, c.id, { date, status });
    }
  };

  // The one that's going well — a long clean streak to contrast against.
  fill(commit('walk after dinner', { type: 'daily' }), () => 'done');

  // Tue/Thu gym where Thursday never survives contact with the week.
  fill(commit('gym', { type: 'days', days: [2, 4] }), (d) => (weekday(d) === 4 ? 'missed' : 'done'));

  // Held for a month, then came apart — should read as slipping, not as a bad day.
  fill(commit('no snacking after 9pm', { type: 'daily' }), (d, i) => {
    if (i < WEEKS * 7 - 14) return i % 9 === 0 ? 'missed' : 'done';
    return i % 3 === 0 ? 'done' : 'missed';
  });

  // Quietly abandoned: answered for a month, then simply stopped being mentioned.
  fill(commit('stretch 10 minutes', { type: 'daily' }), (d, i) =>
    i < WEEKS * 7 - 13 ? (i % 4 === 0 ? 'missed' : 'done') : null,
  );

  // Eased twice. The point isn't the misses — it's that the target keeps moving.
  const prep = commit('meal prep', { type: 'daily' });
  A.reviseCommitment(state, prep.id, { cadence: { type: 'perWeek', count: 3 }, at: addDays(asOf, -24) });
  A.reviseCommitment(state, prep.id, {
    text: 'meal prep on Sundays',
    cadence: { type: 'perWeek', count: 1 },
    at: addDays(asOf, -9),
  });
  for (const w of [0, 1, 2, 4]) {
    A.checkIn(state, prep.id, { date: addDays(start, w * 7 + 6), status: 'done' });
  }

  // Weigh-ins: a real downward trend buried in a couple of pounds of daily noise.
  for (const date of range(start, asOf)) {
    const i = dayIndex(date);
    if (i % 7 === 3) continue; // people miss days
    const lb = 198 - i * 0.14 + Math.sin(i * 1.7) * 1.1;
    state.weights.push({ date, weightKg: lbToKg(Number(lb.toFixed(1))) });
  }

  state.notes.push(
    { date: addDays(asOf, -30), text: 'wants to stop being winded on the stairs at work' },
    { date: addDays(asOf, -11), text: 'Thursdays are late meetings, gym closes before they finish' },
  );

  return state;
}
