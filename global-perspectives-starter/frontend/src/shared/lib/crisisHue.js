// crisisHue — pure mapping from a story's editorial `category` to the console's crisis-hue
// vocabulary (M5a). Hue = crisis TYPE only, never severity or freshness (those are separate
// tokens — see freshnessState in shared/lib/freshness.js).
//
// Values come from the tokens (shared/styles/tokens.js mirrors tokens.css), so every map renderer
// and every CSS rule agree about what a given hue means. Anything that isn't clearly one of the
// four crisis types gets the neutral grey — this is a deliberate "no claim" colour, not a fifth crisis type.
import { TOKENS } from '@/shared/styles/tokens.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const CRISIS_HUE = {
  conflict: TOKENS['hue-conflict'],
  political: TOKENS['hue-political'],
  economic: TOKENS['hue-economic'],
  humanitarian: TOKENS['hue-humanitarian'],
  neutral: '#9aa4b2',
};

export const CRISIS_RGB = Object.fromEntries(Object.entries(CRISIS_HUE).map(([k, v]) => [k, hexRgb(v)]));

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

/**
 * crisisDotVar — the CSS colour for a topic's dot: `var(--hue-<crisis type>)` for the four crisis
 * types, `undefined` (no dot) for unmapped topics. Dot colour = crisis type only, never a topic palette.
 */
export function crisisDotVar(category) {
  const t = crisisTypeForCategory(category);
  return t === 'neutral' ? undefined : `var(--hue-${t})`;
}

export function crisisRgbForCategory(category) {
  return CRISIS_RGB[crisisTypeForCategory(category)];
}
