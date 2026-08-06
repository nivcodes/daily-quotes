// Screening and hard gates.
//
// Everything here runs before the model is allowed to talk about a deficit,
// and re-runs on every profile change. The model can see the result and
// explain it warmly; it cannot overturn it. A gate that a sufficiently
// persistent user can argue their way past is not a gate.

import { bmi } from './units.mjs';
import { MAX_RATE_PCT } from './energy.mjs';

export const MIN_AGE = 18;
export const UNDERWEIGHT_BMI = 18.5;
export const CAUTION_BMI = 20;
export const OLDER_ADULT_AGE = 65;

// Target body-fat floors. Below these, in a population that is mostly not
// competitive athletes, you are describing hormonal disruption rather than a
// fitness goal — amenorrhea and bone density loss in women, and in both sexes
// the sort of physique that is maintained for a photoshoot, not a life.
export const BODY_FAT_FLOOR = { male: 0.1, female: 0.18 };
export const BODY_FAT_CAUTION = { male: 0.12, female: 0.22 };

/**
 * SCOFF — a validated 5-item screen for disordered eating. Two or more
 * positives warrants further assessment. It is a *screen*, not a diagnosis,
 * and the product's job on a positive is to stop selling weight loss and hand
 * over a referral, not to make a clinical claim.
 */
export const SCOFF_ITEMS = [
  { id: 'sick', text: 'Do you ever make yourself sick because you feel uncomfortably full?' },
  { id: 'control', text: 'Do you worry you have lost control over how much you eat?' },
  { id: 'recent_loss', text: 'Have you recently lost more than 14 lb (6 kg) in a 3-month period?' },
  { id: 'believe_fat', text: 'Do you believe yourself to be fat when others say you are too thin?' },
  { id: 'dominates', text: 'Would you say that food dominates your life?' },
];

export function scoffScore(answers = {}) {
  const score = SCOFF_ITEMS.reduce((n, item) => n + (answers[item.id] ? 1 : 0), 0);
  return { score, positive: score >= 2 };
}

/** Conditions that don't block the product but do block aggressive dieting. */
export const CLINICAL_FLAGS = {
  diabetes_insulin: 'insulin or sulfonylurea use — calorie changes affect dosing',
  glp1: 'GLP-1 agonist — appetite suppression makes under-eating and lean-mass loss the real risk',
  kidney_disease: 'kidney disease — protein targets need clinician input',
  cardiac: 'heart condition — exercise progression needs clearance',
  bariatric_surgery: 'post-bariatric — intake and micronutrients are already managed',
  eating_disorder_history: 'history of an eating disorder',
};

/**
 * @returns {{allowed: boolean, mode: 'coach'|'maintenance_only'|'blocked',
 *            blocks: object[], cautions: object[], maxRatePctPerWeek: number}}
 */
export function screen(profile) {
  const blocks = [];
  const cautions = [];
  let maxRate = MAX_RATE_PCT;

  const currentBmi = profile.weightKg && profile.heightCm ? bmi(profile.weightKg, profile.heightCm) : null;
  const wantsLoss = profile.goal === 'lose';

  if (profile.age != null && profile.age < MIN_AGE) {
    blocks.push({
      code: 'under_18',
      message:
        "This isn't built for under-18s — bodies that are still growing need a different approach, " +
        'and it should come from a doctor or dietitian who can actually see you.',
    });
  }

  if (profile.pregnantOrBreastfeeding && wantsLoss) {
    blocks.push({
      code: 'pregnancy',
      message:
        'Deliberate weight loss during pregnancy or breastfeeding is something to plan with your ' +
        "provider, not an app. I can help with eating well at maintenance if that's useful.",
      fallbackMode: 'maintenance_only',
    });
  }

  if (wantsLoss && currentBmi != null && currentBmi < UNDERWEIGHT_BMI) {
    blocks.push({
      code: 'underweight',
      message:
        `At ${currentBmi.toFixed(1)} BMI you're below the healthy range, so I'm not going to help ` +
        'set up a deficit. If you want to work on strength or eating better, I am glad to do that.',
      fallbackMode: 'maintenance_only',
    });
  }

  const scoff = profile.scoff ? scoffScore(profile.scoff) : null;
  if (scoff?.positive || profile.conditions?.includes('eating_disorder_history')) {
    blocks.push({
      code: 'ed_screen',
      message:
        "Some of your answers are ones I take seriously, and calorie targets and daily weigh-ins can " +
        'make things harder rather than better. I would rather point you to people who are properly ' +
        'trained for this than coach you through it.',
      referral: true,
    });
  }

  if (wantsLoss && currentBmi != null && currentBmi >= UNDERWEIGHT_BMI && currentBmi < CAUTION_BMI) {
    cautions.push({
      code: 'low_normal_bmi',
      message:
        "You're already at the lower end of the healthy range. Recomposition — same weight, more " +
        'muscle — will probably get you what you actually want better than losing more.',
    });
    maxRate = Math.min(maxRate, 0.005);
  }

  if (profile.age != null && profile.age >= OLDER_ADULT_AGE) {
    cautions.push({
      code: 'older_adult',
      message:
        'Past 65 the priority shifts to holding onto muscle and bone, so we go slower and lean on ' +
        'protein and resistance work.',
    });
    maxRate = Math.min(maxRate, 0.005);
  }

  for (const condition of profile.conditions ?? []) {
    if (condition === 'eating_disorder_history') continue;
    if (CLINICAL_FLAGS[condition]) {
      cautions.push({ code: condition, message: CLINICAL_FLAGS[condition], clinicianReview: true });
      maxRate = Math.min(maxRate, 0.005);
    }
  }

  const hardBlock = blocks.find((b) => !b.fallbackMode);
  const softBlock = blocks.find((b) => b.fallbackMode);

  return {
    allowed: blocks.length === 0,
    mode: hardBlock ? 'blocked' : softBlock ? 'maintenance_only' : 'coach',
    blocks,
    cautions,
    maxRatePctPerWeek: maxRate,
    scoff,
  };
}

/**
 * Gate a goal *target* — the weight or body-fat level someone says they want.
 * This is the check that the goal-photo flow runs, and the reason that flow is
 * safe to ship at all.
 */
export function screenTarget(profile, { goalWeightKg, goalBodyFatPct }) {
  const problems = [];
  const cautions = [];

  if (goalBodyFatPct != null) {
    const floor = BODY_FAT_FLOOR[profile.sex] ?? 0.15;
    const caution = BODY_FAT_CAUTION[profile.sex] ?? 0.2;
    if (goalBodyFatPct < floor) {
      problems.push({
        code: 'body_fat_below_floor',
        message:
          `That's around ${Math.round(goalBodyFatPct * 100)}% body fat. Below roughly ` +
          `${Math.round(floor * 100)}% is stage-prep territory — it is held for a few weeks, with ` +
          'real hormonal cost, and it is not a place to live. I can get you to lean and keep you there.',
      });
    } else if (goalBodyFatPct < caution) {
      cautions.push({
        code: 'body_fat_low',
        message: 'That is genuinely lean. Reachable, but it takes longer than most people expect.',
      });
    }
  }

  if (goalWeightKg != null && profile.heightCm) {
    const goalBmi = bmi(goalWeightKg, profile.heightCm);
    if (goalBmi < UNDERWEIGHT_BMI) {
      problems.push({
        code: 'goal_underweight',
        message:
          `That goal weight puts you at ${goalBmi.toFixed(1)} BMI, which is under the healthy range. ` +
          "I won't set that as a target.",
      });
    } else if (goalBmi < CAUTION_BMI) {
      cautions.push({ code: 'goal_low_normal', message: 'That is at the bottom of the healthy range.' });
    }
  }

  return { acceptable: problems.length === 0, problems, cautions };
}

/**
 * Runs on every weigh-in. Sustained loss well past what we prescribed means
 * either the person is eating far less than they are telling us, or something
 * medical is happening. Both are worth interrupting the program for.
 */
export function checkRapidLoss(observed, { intendedKgPerWeek, weightKg }) {
  if (!observed?.ready) return { flag: false };
  const pct = Math.abs(observed.kgPerWeek) / weightKg;
  const overshoot = Math.abs(observed.kgPerWeek) > Math.abs(intendedKgPerWeek) * 1.75;

  if (observed.kgPerWeek < 0 && pct > 0.015 && overshoot) {
    return {
      flag: true,
      code: 'rapid_loss',
      pctPerWeek: pct,
      message:
        'You are dropping noticeably faster than we planned. That usually means intake is lower ' +
        'than it looks on paper. Let us bring calories up — and if it keeps up, get it checked out.',
    };
  }
  return { flag: false };
}
