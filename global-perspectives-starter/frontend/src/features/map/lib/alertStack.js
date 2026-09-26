// alertStack — the desktop console's alert stack (Console.dc.html, "Civilization-style"): every
// open situation (GDACS alerts + news situations) as a small card at the map's edge. It replaces
// /breaking on desktop (the route stays). Pure so ordering + the honest empty line are testable.
import { situationFreshness } from '@/features/map/lib/legend.js';

const TIER_WEIGHT = { high: 3, elevated: 2, moderate: 1, low: 0 };

function ts(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Most recent of last_change_at / opened_at, as epoch ms (0 when neither parses). */
export function lastActivity(s) {
  return Math.max(ts(s?.last_change_at), ts(s?.opened_at));
}

/**
 * alertStackItems(situations, now) -> { items, hiddenCount }
 *  - keeps open situations only (state !== 'closed') that have a map position (a card click flies
 *    the map to it — an alert with nowhere to fly to would be a dead click);
 *  - drops the 30d+ ones (freshness 'hidden'), returned as `hiddenCount` so the stack can say so;
 *  - orders most severe first (tier), then escalating first, then newest activity first.
 */
export function alertStackItems(situations = [], now = Date.now()) {
  const items = [];
  let hiddenCount = 0;
  for (const s of Array.isArray(situations) ? situations : []) {
    if (!s || s.id == null || s.state === 'closed' || !s.centroid) continue;
    if (situationFreshness(s, now) === 'hidden') { hiddenCount += 1; continue; }
    items.push(s);
  }
  items.sort((a, b) => ((TIER_WEIGHT[b.tier] ?? 0) - (TIER_WEIGHT[a.tier] ?? 0))
    || ((b.escalating ? 1 : 0) - (a.escalating ? 1 : 0))
    || (lastActivity(b) - lastActivity(a)));
  return { items, hiddenCount };
}

/**
 * alertEmptyText(paused) — the honest line when no situation is open. Computed from the same
 * `pausedSince()` result the status line uses, never typed: when news analysis is paused it says
 * so with the real date, otherwise the plain "nothing open" fact.
 */
export function alertEmptyText(paused) {
  if (!paused) return 'No disaster alerts or news situations open right now.';
  return paused.beyondLookback
    ? `No disaster alerts open · news situations paused — ${paused.text}`
    : `No disaster alerts open · news situations paused since ${paused.label}`;
}

/**
 * alertStackNote({ items, paused }) — a footer line for a non-empty stack that holds only GDACS
 * alerts while the news layer is paused (so an all-disaster stack isn't read as "no news risk").
 */
export function alertStackNote(items = [], paused = null) {
  if (!paused || !items.length) return null;
  if (items.some((s) => s.source !== 'gdacs')) return null;
  return paused.beyondLookback
    ? `News situations paused — ${paused.text}`
    : `News situations paused since ${paused.label}`;
}

/** Short age for a card: "just now" · "25m" · "5h" · "3d" (from the last activity). */
export function ageShort(s, now = Date.now()) {
  const t = lastActivity(s);
  if (!t) return '';
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
