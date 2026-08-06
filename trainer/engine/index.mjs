// Public surface of the deterministic engine.
//
// The orchestrator exposes these as tools to the model. The model chooses when
// to call them and how to say the result out loud; it never computes a target
// itself and never sees a path around a block.

export * from './units.mjs';
export * from './energy.mjs';
export * from './trend.mjs';
export * from './safety.mjs';
export * from './calibrate.mjs';

import { energyTarget, macroTargets, summarize, DEFAULT_RATE_PCT } from './energy.mjs';
import { screen } from './safety.mjs';

/**
 * Single entry point for "give this person a plan". Returns either a refusal
 * with a reason the model can deliver kindly, or a full target.
 */
export function buildPlan(profile, { ratePctPerWeek = DEFAULT_RATE_PCT, goalWeightKg } = {}) {
  const screening = screen(profile);

  if (screening.mode === 'blocked') {
    return { ok: false, screening, plan: null };
  }

  const goal = screening.mode === 'maintenance_only' ? 'maintain' : profile.goal ?? 'lose';
  const rate = Math.min(ratePctPerWeek, screening.maxRatePctPerWeek);

  const target = energyTarget(profile, { ratePctPerWeek: rate, goal });
  const macros = macroTargets(profile, target.targetKcal, { goalWeightKg });

  return { ok: true, screening, plan: summarize(profile, target, macros) };
}
