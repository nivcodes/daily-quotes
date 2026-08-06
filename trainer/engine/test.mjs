// Run with: node trainer/engine/test.mjs
import assert from 'node:assert/strict';
import {
  bmr, tdee, energyTarget, calorieFloor, macroTargets, weightAtBodyFat, weeksToTarget,
  smoothWeights, observedRate, proposeAdjustment, detectPlateau,
  screen, screenTarget, scoffScore, checkRapidLoss,
  calibrateGoal, buildPlan,
  lbToKg, feetInchesToCm, parseHeight, parseWeight, bmi,
} from './index.mjs';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const male = { weightKg: lbToKg(220), heightCm: feetInchesToCm(5, 11), age: 34, sex: 'male', activity: 'light', goal: 'lose' };
const female = { weightKg: lbToKg(155), heightCm: feetInchesToCm(5, 5), age: 29, sex: 'female', activity: 'moderate', goal: 'lose' };

// ---------------------------------------------------------------- units

test('parseHeight handles the formats people actually text', () => {
  assert.equal(Math.round(parseHeight("5'10")), 178);
  assert.equal(Math.round(parseHeight('5 ft 10 in')), 178);
  assert.equal(parseHeight('178cm'), 178);
  assert.equal(Math.round(parseHeight('1.78m')), 178);
  assert.equal(parseHeight('178'), 178);          // bare cm
  assert.equal(Math.round(parseHeight('70')), 178); // bare inches
  assert.equal(parseHeight('banana'), null);
});

test('parseWeight defaults to lb but respects explicit units', () => {
  assert.equal(Math.round(parseWeight('185')), Math.round(lbToKg(185)));
  assert.equal(parseWeight('84 kg'), 84);
  assert.equal(parseWeight('185', true), 185);
});

// ---------------------------------------------------------------- energy

test('Mifflin-St Jeor matches published values', () => {
  // 80kg, 180cm, 30y male => 10*80 + 6.25*180 - 5*30 + 5 = 1780
  assert.equal(bmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }), 1780);
  // same but female => 1780 - 5 - 161 = 1614
  assert.equal(bmr({ weightKg: 80, heightCm: 180, age: 30, sex: 'female' }), 1614);
});

test('TDEE scales with activity', () => {
  const sedentary = tdee({ ...male, activity: 'sedentary' });
  const athlete = tdee({ ...male, activity: 'athlete' });
  assert.ok(athlete > sedentary * 1.5);
});

test('default target produces a sane deficit', () => {
  const t = energyTarget(male);
  assert.ok(t.targetKcal < t.maintenanceKcal, 'should be a deficit');
  assert.ok(t.targetKcal > t.maintenanceKcal * 0.7, 'should not be a crash diet');
  assert.ok(Math.abs(t.achievedRateKgPerWeek) > 0.4 && Math.abs(t.achievedRateKgPerWeek) < 1.2);
});

test('deficit is capped at 25% of maintenance even at high requested rates', () => {
  const t = energyTarget(male, { ratePctPerWeek: 0.05 }); // absurd request
  assert.ok(t.targetKcal >= t.maintenanceKcal * 0.75 - 1);
  assert.equal(t.requestedRatePctPerWeek, 0.01, 'request is clamped to the max rate');
});

test('calorie floor binds for a small person and is reported honestly', () => {
  const small = { weightKg: 47, heightCm: 152, age: 62, sex: 'female', activity: 'sedentary', goal: 'lose' };
  const t = energyTarget(small, { ratePctPerWeek: 0.01 });
  assert.equal(t.floorBinds, true);
  assert.ok(t.targetKcal >= 1200);
  assert.ok(t.achievedRatePctPerWeek < 0.01, 'achieved rate is lower than requested, and we say so');
});

test('target never drops below BMR', () => {
  const t = energyTarget(male, { ratePctPerWeek: 0.01 });
  assert.ok(t.targetKcal >= bmr(male));
  assert.equal(calorieFloor(male), Math.round(bmr(male)));
});

test('maintain goal returns maintenance', () => {
  const t = energyTarget(male, { goal: 'maintain' });
  assert.equal(t.targetKcal, t.maintenanceKcal);
});

test('gain is capped harder than loss', () => {
  const t = energyTarget(male, { ratePctPerWeek: 0.01, goal: 'gain' });
  assert.ok(t.targetKcal > t.maintenanceKcal);
  assert.ok(t.achievedRatePctPerWeek <= 0.005 + 1e-9);
});

test('macros hit the calorie target and protect protein', () => {
  const t = energyTarget(male);
  const m = macroTargets(male, t.targetKcal, { goalWeightKg: lbToKg(185) });
  const kcal = m.proteinG * 4 + m.fatG * 9 + m.carbG * 4;
  assert.ok(Math.abs(kcal - t.targetKcal) < 5, `macros sum to ${kcal}, target ${t.targetKcal}`);
  assert.ok(m.proteinG >= 1.5 * lbToKg(185));
});

test('weightAtBodyFat holds lean mass constant', () => {
  // 100kg at 30% bf => 70kg lean => at 15% bf => 70/0.85 = 82.35kg
  const w = weightAtBodyFat({ weightKg: 100, currentBodyFatPct: 0.3 }, 0.15);
  assert.ok(Math.abs(w - 82.35) < 0.05);
});

test('weeksToTarget is exponential, not linear', () => {
  const weeks = weeksToTarget(100, 80, 0.0075);
  // linear would say 20/(0.75) ≈ 27 weeks; the honest answer is longer
  assert.ok(weeks > 28, `got ${weeks}`);
  assert.equal(weeksToTarget(80, 90), 0, 'no weeks needed if already below target');
});

// ---------------------------------------------------------------- trend

const series = (startKg, perDay, days, noise = []) =>
  Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    weightKg: startKg + perDay * i + (noise[i] ?? 0),
  }));

test('smoothing damps daily noise', () => {
  const noisy = series(90, 0, 30, Array.from({ length: 30 }, (_, i) => (i % 2 ? 1.2 : -1.2)));
  const out = smoothWeights(noisy);
  const last = out[out.length - 1];
  assert.ok(Math.abs(last.trendKg - 90) < 0.5, `trend ${last.trendKg} should sit near 90`);
});

test('observedRate refuses to guess from thin data', () => {
  const r = observedRate(series(90, -0.1, 5));
  assert.equal(r.ready, false);
  assert.equal(r.reason, 'not_enough_weighins');
});

test('observedRate recovers a known rate', () => {
  // -0.1 kg/day = -0.7 kg/week
  const r = observedRate(series(90, -0.1, 30));
  assert.equal(r.ready, true);
  assert.ok(Math.abs(r.kgPerWeek + 0.7) < 0.1, `got ${r.kgPerWeek}`);
});

test('no adjustment while on track', () => {
  const observed = observedRate(series(90, -0.1, 30));
  const p = proposeAdjustment({ observed, targetKcal: 2200, intendedKgPerWeek: -0.7, floorKcal: 1600 });
  assert.equal(p.adjust, false);
  assert.equal(p.reason, 'on_track');
});

test('cuts calories when loss has stalled', () => {
  const observed = observedRate(series(90, -0.01, 30)); // -0.07 kg/wk, basically flat
  const p = proposeAdjustment({ observed, targetKcal: 2200, intendedKgPerWeek: -0.7, floorKcal: 1600 });
  assert.equal(p.adjust, true);
  assert.equal(p.reason, 'slower_than_intended');
  assert.ok(p.toKcal < 2200);
  assert.ok(p.toKcal >= 2200 * 0.85 - 1, 'step is capped at 15%');
});

test('raises calories when loss is too fast', () => {
  const observed = observedRate(series(90, -0.25, 30)); // -1.75 kg/wk
  const p = proposeAdjustment({ observed, targetKcal: 2200, intendedKgPerWeek: -0.7, floorKcal: 1600 });
  assert.equal(p.adjust, true);
  assert.equal(p.reason, 'faster_than_intended');
  assert.ok(p.toKcal > 2200);
});

test('at the floor we recommend activity, never a smaller number', () => {
  const observed = observedRate(series(70, -0.005, 30));
  const p = proposeAdjustment({ observed, targetKcal: 1250, intendedKgPerWeek: -0.5, floorKcal: 1250 });
  assert.equal(p.adjust, false);
  assert.equal(p.reason, 'at_floor');
});

test('adjustments are rate-limited', () => {
  const observed = observedRate(series(90, -0.01, 30));
  const p = proposeAdjustment({ observed, targetKcal: 2200, intendedKgPerWeek: -0.7, floorKcal: 1600, daysSinceLastAdjustment: 3 });
  assert.equal(p.adjust, false);
  assert.equal(p.reason, 'too_soon');
});

test('plateau needs four flat weeks, not one', () => {
  assert.equal(detectPlateau(series(90, 0, 30)).plateau, true);
  assert.equal(detectPlateau(series(90, 0, 10)).plateau, false);
  assert.equal(detectPlateau(series(90, -0.1, 30)).plateau, false);
});

// ---------------------------------------------------------------- safety

test('minors are blocked outright', () => {
  const s = screen({ ...female, age: 16 });
  assert.equal(s.mode, 'blocked');
  assert.ok(s.blocks.some((b) => b.code === 'under_18'));
});

test('underweight users cannot start a cut, but can still get help', () => {
  const s = screen({ weightKg: 46, heightCm: 170, age: 25, sex: 'female', activity: 'light', goal: 'lose' });
  assert.equal(s.mode, 'maintenance_only');
  assert.ok(s.blocks.some((b) => b.code === 'underweight'));
});

test('SCOFF routes to referral rather than coaching', () => {
  assert.equal(scoffScore({ sick: true }).positive, false);
  assert.equal(scoffScore({ sick: true, control: true }).positive, true);
  const s = screen({ ...female, scoff: { sick: true, dominates: true } });
  assert.equal(s.mode, 'blocked');
  assert.ok(s.blocks.some((b) => b.referral));
});

test('pregnancy falls back to maintenance instead of a hard door', () => {
  const s = screen({ ...female, pregnantOrBreastfeeding: true });
  assert.equal(s.mode, 'maintenance_only');
});

test('clinical flags slow the plan down without blocking it', () => {
  const s = screen({ ...male, conditions: ['glp1'] });
  assert.equal(s.mode, 'coach');
  assert.equal(s.maxRatePctPerWeek, 0.005);
  assert.ok(s.cautions.some((c) => c.clinicianReview));
});

test('low-normal BMI gets a recomp nudge and a slower cap', () => {
  const s = screen({ weightKg: 56, heightCm: 170, age: 25, sex: 'female', activity: 'light', goal: 'lose' });
  assert.equal(s.mode, 'coach');
  assert.equal(s.maxRatePctPerWeek, 0.005);
  assert.ok(s.cautions.some((c) => c.code === 'low_normal_bmi'));
});

test('goal targets below the body-fat floor are refused', () => {
  assert.equal(screenTarget(male, { goalBodyFatPct: 0.06 }).acceptable, false);
  assert.equal(screenTarget(female, { goalBodyFatPct: 0.14 }).acceptable, false);
  assert.equal(screenTarget(male, { goalBodyFatPct: 0.13 }).acceptable, true);
});

test('goal weights in the underweight range are refused', () => {
  const g = screenTarget(female, { goalWeightKg: 45 });
  assert.equal(g.acceptable, false);
  assert.ok(g.problems.some((p) => p.code === 'goal_underweight'));
});

test('rapid loss is flagged', () => {
  const observed = observedRate(series(90, -0.3, 30)); // ~2.1 kg/wk
  const r = checkRapidLoss(observed, { intendedKgPerWeek: -0.7, weightKg: 90 });
  assert.equal(r.flag, true);
  const ok = checkRapidLoss(observedRate(series(90, -0.1, 30)), { intendedKgPerWeek: -0.7, weightKg: 90 });
  assert.equal(ok.flag, false);
});

// ---------------------------------------------------------------- calibration

test('an achievable goal photo produces a plan with a near-term milestone', () => {
  const r = calibrateGoal(male, { currentBodyFatPct: 0.28, goalBodyFatPct: 0.15, muscleGap: 'some', confidence: 'medium' });
  assert.equal(r.accepted, true);
  assert.equal(r.goalType, 'cut_then_build');
  assert.ok(r.milestone.weeks <= 12 && r.milestone.weeks >= 6);
  assert.ok(r.milestone.lossKg > 0);
  assert.ok(r.totalWeeks > r.cutWeeks, 'building time is added, not hidden');
  assert.equal(r.photoRetention, 'discard_after_estimate');
});

test('an unachievable goal photo is refused with a counter-offer, not a lecture', () => {
  const r = calibrateGoal(male, { currentBodyFatPct: 0.3, goalBodyFatPct: 0.05, muscleGap: 'substantial' });
  assert.equal(r.accepted, false);
  assert.ok(r.problems.some((p) => p.code === 'body_fat_below_floor'));
  assert.ok(r.counterOffer.goalBodyFatPct === 0.12);
  assert.ok(r.counterOffer.weeks > 0);
});

test('a substantial muscle gap is stated in months, up front', () => {
  const r = calibrateGoal(male, { currentBodyFatPct: 0.22, goalBodyFatPct: 0.14, muscleGap: 'substantial' });
  assert.equal(r.goalType, 'recomp_long');
  assert.ok(r.buildMonths >= 24);
  assert.match(r.honestHorizon, /multi-year/);
});

// ---------------------------------------------------------------- integration

test('buildPlan returns a usable plan for a typical user', () => {
  const { ok, plan } = buildPlan(male, { goalWeightKg: lbToKg(185) });
  assert.equal(ok, true);
  assert.ok(plan.targetKcal > 1800 && plan.targetKcal < 2600, `got ${plan.targetKcal}`);
  assert.ok(plan.macros.proteinG > 120);
  assert.equal(plan.bmi, Number(bmi(male.weightKg, male.heightCm).toFixed(1)));
});

test('buildPlan refuses when screening blocks', () => {
  const { ok, plan, screening } = buildPlan({ ...male, age: 15 });
  assert.equal(ok, false);
  assert.equal(plan, null);
  assert.equal(screening.mode, 'blocked');
});

test('buildPlan downgrades to maintenance instead of dieting a pregnant user', () => {
  const { ok, plan } = buildPlan({ ...female, pregnantOrBreastfeeding: true });
  assert.equal(ok, true);
  assert.equal(plan.goal, 'maintain');
  assert.equal(plan.targetKcal, plan.maintenanceKcal);
});

test('screening caps override a user-requested aggressive rate', () => {
  const { plan } = buildPlan({ ...male, conditions: ['cardiac'] }, { ratePctPerWeek: 0.01 });
  assert.ok(plan.achievedRatePctPerWeek <= 0.005 + 1e-9);
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
