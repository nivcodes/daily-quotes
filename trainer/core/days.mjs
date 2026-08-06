// Date helpers. Everything is a local-time YYYY-MM-DD string — the unit an
// accountability system actually reasons in. Timestamps would invite timezone
// bugs for no benefit: "did you go to the gym Tuesday" has no time component.

export const today = (d = new Date()) => d.toLocaleDateString('en-CA');

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00`); // noon avoids DST edges
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

export const dayDiff = (a, b) =>
  Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

/** 0 = Sunday. */
export const weekday = (date) => new Date(`${date}T12:00:00`).getDay();

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayName = (date) => WEEKDAY_NAMES[weekday(date)];

/** Monday-anchored week key, so "this week" matches how people talk. */
export function weekKey(date) {
  const dow = weekday(date);
  return addDays(date, -((dow + 6) % 7));
}

/** Inclusive range of dates, ascending. */
export function range(from, to) {
  const out = [];
  for (let d = from; dayDiff(d, to) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}
