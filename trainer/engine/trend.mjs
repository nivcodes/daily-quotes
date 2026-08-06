// Weight trend + the feedback loop that makes calorie estimation error stop
// mattering.
//
// The premise: a logged calorie count is a hypothesis, the scale is the
// measurement. Both the user's food estimates and our TDEE equation are wrong
// by 10-20%. Rather than chase precision on the input side, we watch the
// observed trend and move the target until reality matches intent. After ~3
// weeks the system is calibrated to that individual and the initial error is
// irrelevant.

import { KCAL_PER_KG_FAT } from './units.mjs';

export const EMA_ALPHA = 0.25; // ~1 week of effective smoothing on daily data

/**
 * Exponentially smoothed weight. Daily scale weight swings 1-2 kg on sodium,
 * carbs and water; showing people the raw number teaches them that the diet
 * "stopped working" every Tuesday.
 *
 * @param {{date: string, weightKg: number}[]} entries - any order
 * @returns {{date: string, weightKg: number, trendKg: number}[]} ascending
 */
export function smoothWeights(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let ema = null;
  return sorted.map((e) => {
    ema = ema === null ? e.weightKg : EMA_ALPHA * e.weightKg + (1 - EMA_ALPHA) * ema;
    return { ...e, trendKg: ema };
  });
}

const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/**
 * Observed rate of change, measured on the smoothed series over the trailing
 * window. Returns `null` when there is not enough data to say anything — which
 * is most of the first three weeks, and the system should say "too early to
 * tell" rather than invent a trend from four data points.
 */
export function observedRate(entries, { windowDays = 21, minEntries = 10, minSpanDays = 14 } = {}) {
  const smoothed = smoothWeights(entries);
  if (smoothed.length < 2) return null;

  const last = smoothed[smoothed.length - 1];
  const window = smoothed.filter((e) => dayDiff(e.date, last.date) <= windowDays);

  if (window.length < minEntries) {
    return { ready: false, reason: 'not_enough_weighins', entries: window.length, needed: minEntries };
  }

  const first = window[0];
  const spanDays = dayDiff(first.date, last.date);
  if (spanDays < minSpanDays) {
    return { ready: false, reason: 'window_too_short', spanDays, needed: minSpanDays };
  }

  const deltaKg = last.trendKg - first.trendKg;
  const kgPerWeek = (deltaKg / spanDays) * 7;

  return {
    ready: true,
    spanDays,
    entries: window.length,
    trendKg: last.trendKg,
    kgPerWeek,
    pctPerWeek: kgPerWeek / last.trendKg,
  };
}

/**
 * Compare observed to intended and propose a calorie change.
 *
 * Guardrails, all of which exist because the naive version oscillates:
 *  - never adjust more often than every `minDaysBetween`
 *  - never move more than 15% of the current target in one step
 *  - never below the person's floor (passed in from energy.calorieFloor)
 *  - ignore differences inside a dead band; weekly noise is not a signal
 */
export function proposeAdjustment({
  observed,
  targetKcal,
  intendedKgPerWeek,
  floorKcal,
  daysSinceLastAdjustment = Infinity,
  minDaysBetween = 14,
  deadBandKgPerWeek = 0.15,
  maxStepFraction = 0.15,
}) {
  if (!observed?.ready) {
    return { adjust: false, reason: 'insufficient_data', detail: observed?.reason ?? 'no_data' };
  }
  if (daysSinceLastAdjustment < minDaysBetween) {
    return { adjust: false, reason: 'too_soon', daysSinceLastAdjustment };
  }

  const gap = observed.kgPerWeek - intendedKgPerWeek; // +ve => losing slower than intended
  if (Math.abs(gap) < deadBandKgPerWeek) {
    return { adjust: false, reason: 'on_track', gapKgPerWeek: gap };
  }

  const rawDelta = (gap * KCAL_PER_KG_FAT) / 7; // kcal/day implied by the gap
  const maxStep = targetKcal * maxStepFraction;
  const step = Math.round(Math.max(-maxStep, Math.min(maxStep, -rawDelta)));

  let next = targetKcal + step;
  let floorBinds = false;
  if (next < floorKcal) {
    next = floorKcal;
    floorBinds = true;
  }

  if (next === targetKcal) {
    return { adjust: false, reason: floorBinds ? 'at_floor' : 'no_change', gapKgPerWeek: gap };
  }

  return {
    adjust: true,
    reason: gap > 0 ? 'slower_than_intended' : 'faster_than_intended',
    gapKgPerWeek: gap,
    fromKcal: targetKcal,
    toKcal: next,
    deltaKcal: next - targetKcal,
    floorBinds,
    // When the floor binds we have run out of room to cut. The correct next
    // move is more activity or a maintenance break, never a lower number.
    recommendation: floorBinds ? 'increase_activity_or_diet_break' : 'adjust_intake',
  };
}

/**
 * A plateau is a *real* stall on the smoothed series, not a flat week. Four
 * weeks is roughly the point where it stops being water retention and starts
 * being either adaptation or under-reporting.
 */
export function detectPlateau(entries, { weeks = 4, toleranceKg = 0.5 } = {}) {
  const smoothed = smoothWeights(entries);
  if (smoothed.length < 8) return { plateau: false, reason: 'insufficient_data' };

  const last = smoothed[smoothed.length - 1];
  const window = smoothed.filter((e) => dayDiff(e.date, last.date) <= weeks * 7);
  if (window.length < 8) return { plateau: false, reason: 'insufficient_data' };

  const spanDays = dayDiff(window[0].date, last.date);
  if (spanDays < weeks * 7 - 3) return { plateau: false, reason: 'window_too_short' };

  const change = last.trendKg - window[0].trendKg;
  return {
    plateau: Math.abs(change) < toleranceKg,
    changeKg: change,
    spanDays,
  };
}
