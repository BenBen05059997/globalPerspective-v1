// pulse — the console's motion-budget helper (STORY_WEB_RETHINK_PLAN.md §8 / M6): of the three
// things allowed to move (radar sweep, a 2.4s breathing pulse, travelling dashes on a selected
// story's arcs), the pulse is capped — only situations that are NEW or ▲ escalating within the
// last 24 hours pulse, at most `cap` of them, highest tier first. Everything else is static; old
// items never move. Pure and DOM-free so both map modes (globe, radar) agree on exactly which
// ids pulse, and it's testable without a browser.

const TIER_WEIGHT = { high: 3, elevated: 2, moderate: 1, low: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;

function msAgo(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const age = now - t;
  return age >= 0 ? age : null; // a future timestamp is never "recent" (clock skew, bad data)
}

/**
 * pulseSet(situations, now, cap) -> Set<id>
 *  - "new" = opened within the last 24h (`opened_at`).
 *  - "escalating" = `escalating` is true AND the change that made it so was within the last 24h,
 *    using whichever timestamp the bundle actually carries: `tier_changed_at`, else
 *    `last_change_at`, else `opened_at` (some sources only ever set one of these).
 *  - ties broken by the most recent of `tier_changed_at`/`last_change_at`/`opened_at`.
 */
export function pulseSet(situations = [], now = Date.now(), cap = 8) {
  const list = Array.isArray(situations) ? situations : [];
  const scored = [];
  for (const s of list) {
    if (!s || s.id == null) continue;
    const changedAt = s.tier_changed_at || s.last_change_at || s.opened_at || null;
    const isNew = msAgo(s.opened_at, now) != null && msAgo(s.opened_at, now) <= DAY_MS;
    const isEscalating = !!s.escalating && msAgo(changedAt, now) != null && msAgo(changedAt, now) <= DAY_MS;
    if (!isNew && !isEscalating) continue;
    const recency = msAgo(changedAt, now) ?? msAgo(s.opened_at, now) ?? DAY_MS;
    scored.push({ id: s.id, tierWeight: TIER_WEIGHT[s.tier] ?? 0, recency });
  }
  scored.sort((a, b) => (b.tierWeight - a.tierWeight) || (a.recency - b.recency));
  return new Set(scored.slice(0, Math.max(0, cap)).map((x) => x.id));
}

export default pulseSet;
