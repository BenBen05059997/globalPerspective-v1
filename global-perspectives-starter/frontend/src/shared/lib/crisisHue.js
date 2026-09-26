// crisisHue — pure mapping from a story's editorial `category` to the console's crisis-hue
// vocabulary (M5a). Hue = crisis TYPE only, never severity or freshness (those are separate
// tokens — see freshnessState in shared/lib/freshness.js and TIER_R in SituationMap.jsx).
//
// Reuses the exact RGB/hex values situations already use for the four axes (SituationMap.jsx
// AXIS_HUE / SituationMap3D.jsx AXIS_RGB), so a shaded country and a situation pin never disagree
// about what a given hue means. Anything that isn't clearly one of the four crisis types gets the
// neutral grey — this is a deliberate "no claim" colour, not a fifth crisis type.
export const CRISIS_HUE = {
  conflict: '#ee7754',
  political: '#9b8cf8',
  economic: '#38b6e0',
  humanitarian: '#d89e28',
  neutral: '#9aa4b2',
};

export const CRISIS_RGB = {
  conflict: [238, 119, 84],
  political: [155, 140, 248],
  economic: [56, 182, 222],
  humanitarian: [216, 158, 40],
  neutral: [154, 164, 178],
};

export const CRISIS_LABEL = {
  conflict: 'Conflict',
  political: 'Political',
  economic: 'Economic',
  humanitarian: 'Humanitarian',
  neutral: 'Other',
};

// category (as the topics feed spells it, lower-cased) -> crisis type.
const CATEGORY_MAP = {
  conflict: 'conflict',
  military: 'conflict',
  security: 'conflict',
  war: 'conflict',

  politics: 'political',
  political: 'political',
  election: 'political',
  elections: 'political',
  diplomacy: 'political',
  diplomatic: 'political',

  economy: 'economic',
  economic: 'economic',
  energy: 'economic',
  business: 'economic',
  markets: 'economic',
  market: 'economic',
  trade: 'economic',
  finance: 'economic',

  humanitarian: 'humanitarian',
  disaster: 'humanitarian',
  health: 'humanitarian',
  climate: 'humanitarian',
};

/**
 * crisisTypeForCategory — pure, case-insensitive; unknown/missing categories (e.g. "technology",
 * "society") fall to 'neutral' rather than guessing a crisis claim that isn't in the data.
 */
export function crisisTypeForCategory(category) {
  if (!category || typeof category !== 'string') return 'neutral';
  return CATEGORY_MAP[category.trim().toLowerCase()] || 'neutral';
}

export function crisisHueForCategory(category) {
  return CRISIS_HUE[crisisTypeForCategory(category)];
}

export function crisisRgbForCategory(category) {
  return CRISIS_RGB[crisisTypeForCategory(category)];
}
