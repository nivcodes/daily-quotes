// Goal-photo calibration.
//
// This is the feature the product was asked for, rebuilt so it does the
// opposite of what goal-body features usually do. The photo is not stored, not
// shown again, and never placed next to a picture of the user. It is consumed
// once to answer one question: what would that actually take, for you?
//
// Almost everyone who quits a diet quits because reality diverged from an
// expectation nobody ever checked. So we check it, in week zero, in writing.

import { energyTarget, weightAtBodyFat, weeksToTarget, DEFAULT_RATE_PCT } from './energy.mjs';
import { screenTarget } from './safety.mjs';
import { kgToLb } from './units.mjs';

/**
 * Rough visual body-fat bands. Deliberately coarse: a vision model cannot
 * resolve body fat to a percentage point, and a range that admits it is more
 * trustworthy than a decimal that is quietly wrong.
 */
export const COMPOSITION_BANDS = {
  very_lean: { male: [0.06, 0.1], female: [0.14, 0.19], label: 'visible abs, striated, stage-lean' },
  lean: { male: [0.1, 0.14], female: [0.19, 0.24], label: 'clear definition, visible abs relaxed' },
  athletic: { male: [0.14, 0.18], female: [0.24, 0.28], label: 'athletic, some definition' },
  average: { male: [0.18, 0.25], female: [0.28, 0.35], label: 'healthy, little visible definition' },
  higher: { male: [0.25, 0.4], female: [0.35, 0.5], label: 'higher body fat' },
};

/** Does the goal need muscle the person does not have yet, or just fat loss? */
export function classifyGoalType({ currentBodyFatPct, goalBodyFatPct, muscleGap }) {
  if (muscleGap === 'substantial') return 'recomp_long';
  if (goalBodyFatPct < currentBodyFatPct - 0.02) return muscleGap === 'some' ? 'cut_then_build' : 'cut';
  return 'build';
}

/**
 * Produce an honest plan from a goal-composition estimate.
 *
 * `muscleGap` is the vision model's read on how much more muscle the reference
 * physique carries than the user does: 'none' | 'some' | 'substantial'. It is
 * the term everyone leaves out, and it is usually the dominant one — the gap
 * between a photo and a person is far more often muscle than fat.
 */
export function calibrateGoal(profile, estimate, { ratePctPerWeek = DEFAULT_RATE_PCT } = {}) {
  const { goalBodyFatPct, currentBodyFatPct, muscleGap = 'none', confidence = 'low' } = estimate;

  const gate = screenTarget(profile, { goalBodyFatPct });
  if (!gate.acceptable) {
    return { accepted: false, ...gate, counterOffer: counterOffer(profile, currentBodyFatPct) };
  }

  const goalWeightKg = weightAtBodyFat({ weightKg: profile.weightKg, currentBodyFatPct }, goalBodyFatPct);
  const weightGate = screenTarget(profile, { goalWeightKg });
  if (!weightGate.acceptable) {
    return { accepted: false, ...weightGate, counterOffer: counterOffer(profile, currentBodyFatPct) };
  }

  const goalType = classifyGoalType({ currentBodyFatPct, goalBodyFatPct, muscleGap });
  const cutWeeks = weeksToTarget(profile.weightKg, goalWeightKg, ratePctPerWeek);

  // Muscle accrues at roughly 0.25-0.5 kg/month for a trained lifter and much
  // slower after the first year or two. Ignoring that is how a physique that
  // takes four years gets sold as a twelve-week transformation.
  const buildMonths = { none: 0, some: 9, substantial: 24 }[muscleGap] ?? 0;
  const totalWeeks = cutWeeks + buildMonths * 4.33;

  const target = energyTarget({ ...profile, goal: 'lose' }, { ratePctPerWeek, goal: 'lose' });

  // The milestone is the actual product. Twelve weeks is long enough for a
  // visible change and short enough to stay real.
  const milestoneWeeks = Math.min(12, Math.max(6, cutWeeks));
  const milestoneWeightKg = profile.weightKg * Math.pow(1 - ratePctPerWeek, milestoneWeeks);

  return {
    accepted: true,
    confidence,
    goalType,
    goalWeightKg,
    goalWeightLb: kgToLb(goalWeightKg),
    cutWeeks,
    buildMonths,
    totalWeeks: Math.round(totalWeeks),
    honestHorizon: describeHorizon(totalWeeks, goalType, muscleGap),
    milestone: {
      weeks: milestoneWeeks,
      weightKg: milestoneWeightKg,
      weightLb: kgToLb(milestoneWeightKg),
      lossKg: profile.weightKg - milestoneWeightKg,
    },
    target,
    cautions: [...(gate.cautions ?? []), ...(weightGate.cautions ?? [])],
    // Enforced by the storage layer, not by the model remembering to.
    photoRetention: 'discard_after_estimate',
  };
}

function describeHorizon(totalWeeks, goalType, muscleGap) {
  const months = Math.round(totalWeeks / 4.33);
  if (goalType === 'cut') {
    return `Roughly ${months} month${months === 1 ? '' : 's'} of consistent eating gets you there. No muscle-building phase needed — you already carry the shape, it is under a layer.`;
  }
  if (muscleGap === 'substantial') {
    return `Honestly: ${months}+ months, and most of that is building muscle you do not have yet, not losing fat. That physique is a multi-year project and it is worth knowing that on day one rather than in week six.`;
  }
  return `About ${months} months — a fat-loss phase first, then a stretch of eating at maintenance and lifting to fill it out.`;
}

function counterOffer(profile, currentBodyFatPct) {
  const floorish = profile.sex === 'male' ? 0.12 : 0.21;
  if (currentBodyFatPct <= floorish) return null;
  const goalWeightKg = weightAtBodyFat({ weightKg: profile.weightKg, currentBodyFatPct }, floorish);
  return {
    goalBodyFatPct: floorish,
    goalWeightKg,
    goalWeightLb: kgToLb(goalWeightKg),
    weeks: weeksToTarget(profile.weightKg, goalWeightKg),
    message: 'Here is the lean-and-sustainable version of the same goal, if you want it.',
  };
}
