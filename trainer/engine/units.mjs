// Unit conversion. Everything inside the engine is metric; imperial is an
// edge concern belonging to the message layer.

export const LB_PER_KG = 2.2046226218;
export const KCAL_PER_KG_FAT = 7700;

export const lbToKg = (lb) => lb / LB_PER_KG;
export const kgToLb = (kg) => kg * LB_PER_KG;
export const inToCm = (inches) => inches * 2.54;
export const cmToIn = (cm) => cm / 2.54;

export const feetInchesToCm = (feet, inches = 0) => inToCm(feet * 12 + inches);

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Parse "5'10", "5 ft 10", "178cm", "70in" into cm. Returns null if unparseable. */
export function parseHeight(input) {
  const s = String(input).trim().toLowerCase();

  const feetInches = s.match(/^(\d+)\s*(?:'|ft|feet|foot)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch(?:es)?)?$/);
  if (feetInches) return feetInchesToCm(Number(feetInches[1]), Number(feetInches[2] || 0));

  const explicit = s.match(/^(\d+(?:\.\d+)?)\s*(cm|m|in|inch(?:es)?)$/);
  if (explicit) {
    const v = Number(explicit[1]);
    if (explicit[2] === 'cm') return v;
    if (explicit[2] === 'm') return v * 100;
    return inToCm(v);
  }

  // Bare number: disambiguate by plausible human range.
  const bare = Number(s);
  if (Number.isFinite(bare)) {
    if (bare >= 120 && bare <= 250) return bare; // cm
    if (bare >= 48 && bare <= 90) return inToCm(bare); // inches
    if (bare >= 1.2 && bare <= 2.5) return bare * 100; // metres
  }
  return null;
}

/** Parse "185", "185lb", "84 kg" into kg. Ambiguous bare numbers use `preferKg`. */
export function parseWeight(input, preferKg = false) {
  const s = String(input).trim().toLowerCase();

  const explicit = s.match(/^(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|lb|lbs|pounds?)$/);
  if (explicit) {
    const v = Number(explicit[1]);
    return /^k/.test(explicit[2]) ? v : lbToKg(v);
  }

  const bare = Number(s);
  if (!Number.isFinite(bare) || bare <= 0) return null;
  return preferKg ? bare : lbToKg(bare);
}
