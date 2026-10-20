// board — the board's drawing rules, shared with the backend (PLAN_2026-10-20_board.md, Stage 1).
// The block between the markers is kept identical to backend/shared/src/record.js (newsBoard) by
// scripts/check-shared-sync.mjs. Pure: no network, no clock.

// --- board rules core (identical in the frontend copy) ---
const PIN_BUDGET = 12;

/** pairKey('b', 'a') -> 'a__b'. One key per pair of pins, whichever order they are given in. */
function pairKey(a, b) {
  if (a === b) throw new Error('pairKey: a string needs two different pins');
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/** An actor name as compared everywhere: trimmed, whitespace collapsed, lowercase (the key newsSystemsAnalysis
 *  normalizeActors uses). */
function normalizeActor(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** How a string is drawn. A cut string is 'cut' whoever owns it. Ours with a confirmed strength (weak | medium |
 *  strong) is 'solid'; ours 'inferred' or with no strength is 'dashed' (slice 1: every ours-string is inferred);
 *  yours is 'dashed-alt'. */
function stringTexture(str) {
  if (!str) return 'dashed';
  if (str.cutAt) return 'cut';
  if (str.owner === 'yours') return 'dashed-alt';
  return ['weak', 'medium', 'strong'].includes(str.strength) ? 'solid' : 'dashed';
}
// --- end board rules core ---

export { PIN_BUDGET, pairKey, normalizeActor, stringTexture };
