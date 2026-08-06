// Energy budget: BMR, TDEE, calorie targets, macros.
//
// This module is deliberately boring, deterministic and unit-tested. The model
// is never allowed to pick a calorie number — it calls in here and reports what
// comes back. An LLM that invents "1,150 calories" for a 200 lb man because the
// conversation had momentum is the single most dangerous failure mode in a
// product like this, and the fix is architectural, not a better prompt.

import { KCAL_PER_KG_FAT, bmi } from './units.mjs';

export const ACTIVITY = {
  sedentary: { multiplier: 1.2, label: 'desk job, little deliberate exercise' },
  light: { multiplier: 1.375, label: 'light exercise 1-3 days/week' },
  moderate: { multiplier: 1.55, label: 'moderate exercise 3-5 days/week' },
  very: { multiplier: 1.725, label: 'hard exercise 6-7 days/week' },
  athlete: { multiplier: 1.9, label: 'physical job or two-a-day training' },
};

// Absolute intake floors. Below these you cannot reliably hit micronutrient
// needs from food, and adherence collapses anyway.
export const ABSOLUTE_FLOOR_KCAL = { female: 1200, male: 1500 };

// Rate of loss as a fraction of bodyweight per week.
export const DEFAULT_RATE_PCT = 0.0075; // 0.75%/wk
export const MAX_RATE_PCT = 0.01; // 1%/wk
export const MAX_DEFICIT_FRACTION = 0.25; // never cut more than 25% below TDEE

/**
 * Mifflin-St Jeor. `sex` is sex assigned at birth, used only because the
 * equation is fitted that way — the intake copy should say so plainly.
 */
export function bmr({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(profile) {
  const activity = ACTIVITY[profile.activity] ?? ACTIVITY.sedentary;
  return bmr(profile) * activity.multiplier;
}

/**
 * The calorie floor that applies to this specific person: the higher of the
 * absolute floor and their own BMR. Eating below BMR for months is how people
 * end up with the metabolic adaptation and binge cycles that make attempt #4
 * harder than attempt #1.
 */
export function calorieFloor(profile) {
  return Math.max(ABSOLUTE_FLOOR_KCAL[profile.sex] ?? 1200, Math.round(bmr(profile)));
}

/**
 * Turn a profile plus a desired rate into an intake target.
 *
 * Returns the achievable rate, not the requested one. If the floor binds, the
 * caller is expected to *tell the user* that their timeline just moved — the
 * honest version of "you asked for 2 lb/week and your body gets a vote".
 */
export function energyTarget(profile, { ratePctPerWeek = DEFAULT_RATE_PCT, goal = 'lose' } = {}) {
  const maintenance = Math.round(tdee(profile));
  const floor = calorieFloor(profile);

  if (goal === 'maintain') {
    return {
      goal,
      maintenanceKcal: maintenance,
      targetKcal: maintenance,
      requestedRatePctPerWeek: 0,
      achievedRatePctPerWeek: 0,
      achievedRateKgPerWeek: 0,
      floorKcal: floor,
      floorBinds: false,
    };
  }

  const direction = goal === 'gain' ? 1 : -1;
  const requested = Math.min(Math.abs(ratePctPerWeek), MAX_RATE_PCT);

  // Lean gain is a slower process than fat loss; a 1%/wk "bulk" is mostly fat.
  const capped = goal === 'gain' ? Math.min(requested, 0.005) : requested;

  const kgPerWeek = profile.weightKg * capped;
  let dailyDelta = (kgPerWeek * KCAL_PER_KG_FAT) / 7;

  if (goal === 'lose') {
    dailyDelta = Math.min(dailyDelta, maintenance * MAX_DEFICIT_FRACTION);
  }

  // Round toward maintenance so integer kcal never nudges the achieved rate
  // past the cap we just applied.
  let target = direction < 0
    ? Math.ceil(maintenance - dailyDelta)
    : Math.floor(maintenance + dailyDelta);
  let floorBinds = false;

  if (goal === 'lose' && target < floor) {
    target = floor;
    floorBinds = true;
  }

  const actualDelta = Math.abs(maintenance - target);
  const actualKgPerWeek = (actualDelta * 7) / KCAL_PER_KG_FAT;

  return {
    goal,
    maintenanceKcal: maintenance,
    targetKcal: target,
    requestedRatePctPerWeek: requested,
    achievedRatePctPerWeek: actualKgPerWeek / profile.weightKg,
    achievedRateKgPerWeek: actualKgPerWeek * direction,
    floorKcal: floor,
    floorBinds,
  };
}

/**
 * Macros. Protein is scaled to a reference weight (goal weight when cutting, so
 * we don't prescribe 200g of protein to someone with a lot of fat mass to lose)
 * and is the one number worth being opinionated about — it protects lean mass
 * in a deficit and it is the most satiating macro, which is an adherence lever
 * rather than a nutrition-nerd detail.
 */
export function macroTargets(profile, targetKcal, { goalWeightKg } = {}) {
  const referenceKg = Math.min(profile.weightKg, goalWeightKg ?? profile.weightKg);

  const proteinG = Math.round(1.6 * referenceKg);
  const fatG = Math.round(Math.max(0.6 * referenceKg, (targetKcal * 0.2) / 9));

  const remaining = targetKcal - proteinG * 4 - fatG * 9;
  const carbG = Math.max(0, Math.round(remaining / 4));

  return { proteinG, fatG, carbG, kcal: targetKcal };
}

/**
 * Estimate the weight a given body-fat percentage implies, holding lean mass
 * constant. Used once, during goal calibration — see docs on why we do not
 * surface body-fat numbers routinely.
 */
export function weightAtBodyFat({ weightKg, currentBodyFatPct }, targetBodyFatPct) {
  const leanKg = weightKg * (1 - currentBodyFatPct);
  return leanKg / (1 - targetBodyFatPct);
}

/** Weeks to get from A to B at a rate expressed as %bodyweight/week. */
export function weeksToTarget(startKg, targetKg, ratePctPerWeek = DEFAULT_RATE_PCT) {
  if (targetKg >= startKg) return 0;
  // Rate is proportional to bodyweight, so this is exponential decay, not linear.
  // Ignoring that is why every "you'll hit your goal by March" estimate is a lie.
  return Math.ceil(Math.log(startKg / targetKg) / -Math.log(1 - ratePctPerWeek));
}

export function summarize(profile, target, macros) {
  return {
    bmi: Number(bmi(profile.weightKg, profile.heightCm).toFixed(1)),
    ...target,
    macros,
  };
}
