// pulse — the console's motion-budget helper (STORY_WEB_RETHINK_PLAN.md §8 / M6), now the
// "happening now" rule (colour plan C6 R2, operator 2026-10-19): a situation is happening now when
// it CHANGED within the last 12 hours, at most `cap` of them, highest tier first, then the most
// recent. Those markers breathe (a soft ~2.4s glow); everything else is still. Pure and DOM-free so
// both map modes (globe, radar) agree on exactly which ids move, and it's testable without a browser.

/**
 * The motion budget (STORY_WEB_RETHINK_PLAN §8 / T4): at most `movers` kinds of thing may move at
 * once and at most `pulses` items breathe. The maps and the legend both read these numbers.
 */
export const MOTION_BUDGET = Object.freeze({ movers: 3, pulses: 5 });

/** How recent a change must be for a situation to count as happening now. */
export const HAPPENING_NOW_MS = 12 * 60 * 60 * 1000;

const TIER_WEIGHT = { high: 3, elevated: 2, moderate: 1, low: 0 };

/**
 * When a situation last changed, from whichever timestamp the bundle actually carries:
 * `tier_changed_at`, else `last_change_at`, else `opened_at` (some sources only set one of these).
 */
export function changedAt(s) {
  return (s && (s.tier_changed_at || s.last_change_at || s.opened_at)) || null;
}

function msAgo(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const age = now - t;
  return age >= 0 ? age : null; // a future timestamp is never "recent" (clock skew, bad data)
}

/**
 * pulseSet(situations, now, cap) -> Set<id> of the happening-now situations: changed within
 * HAPPENING_NOW_MS, ordered by tier (highest first) then most recent change, capped at `cap`.
 */
export function pulseSet(situations = [], now = Date.now(), cap = MOTION_BUDGET.pulses) {
  const list = Array.isArray(situations) ? situations : [];
  const scored = [];
  for (const s of list) {
    if (!s || s.id == null) continue;
    const age = msAgo(changedAt(s), now);
    if (age == null || age > HAPPENING_NOW_MS) continue;
    scored.push({ id: s.id, tierWeight: TIER_WEIGHT[s.tier] ?? 0, age });
  }
  scored.sort((a, b) => (b.tierWeight - a.tierWeight) || (a.age - b.age));
  return new Set(scored.slice(0, Math.max(0, cap)).map((x) => x.id));
}

export default pulseSet;
