// radar — pure geometry/timing helpers for RadarMap (M4: the flat radar mode; colour plan C6: one
// sweep that reveals). Kept UI-free (no DOM/canvas/SVG) so the sweep maths, the lap timing and the
// beam-pass card queue are testable in plain vitest. See
// project-docs/redesign-ux/_active/CONSOLE_WIREFRAME_TECHNIQUE.md §3 for the original sweep design.
import { AXIS_LABELS } from '@/shared/lib/riskTiers.js';
import { TIER_LABEL } from '@/shared/lib/situationLabels.js';
import { changedAt } from '@/shared/map/pulse.js';

/**
 * Bearing of a point (x, y) from the map centre (cx, cy), in the same convention the sweep
 * angle uses: degrees clockwise from due east (screen space, y grows downward), 0..360.
 */
export function bearingDeg(x, y, cx, cy) {
  const rad = Math.atan2(y - cy, x - cx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

const norm360 = (d) => ((d % 360) + 360) % 360;

/**
 * Did the sweep pass over `markerAngle` moving forward (clockwise) from `prevAngle` to `angle`
 * this tick? Handles the wrap at 360→0. A zero-length tick (no movement) never counts as a pass.
 * A marker is only crossed once per lap, so callers don't need extra debouncing.
 */
export function beamCrossed(prevAngle, angle, markerAngle) {
  if (prevAngle == null || angle == null || markerAngle == null) return false;
  if (![prevAngle, angle, markerAngle].every(Number.isFinite)) return false;
  const p = norm360(prevAngle);
  const a = norm360(angle);
  const m = norm360(markerAngle);
  if (p === a) return false;
  const span = norm360(a - p);          // how far the beam travelled this tick, going forward
  const offset = norm360(m - p);        // how far the marker sits ahead of p, same direction
  return offset > 0 && offset <= span;
}

/** One sweep lap (C6 R1): about 4-5s, starting from due north, then the beam stops. */
export const LAP_MS = 4500;
export const LAP_START_DEG = 270; // due north in the bearingDeg convention

/**
 * Where the beam is `elapsedMs` into a lap: { angle, done }. The angle runs clockwise once from
 * LAP_START_DEG and holds there once the lap is done (elapsed is clamped to the lap length).
 */
export function lapAngle(elapsedMs, lapMs = LAP_MS) {
  const t = Number.isFinite(elapsedMs) && lapMs > 0 ? Math.min(1, Math.max(0, elapsedMs / lapMs)) : 1;
  return { angle: norm360(LAP_START_DEG + 360 * t), done: t >= 1 };
}

/**
 * True when `ids` holds an id not in `seen` (C6 R1/R5): the radar runs one lap the first time it
 * has markers, and again whenever fresh data adds a situation while the page is open.
 */
export function gainedIds(seen, ids) {
  for (const id of ids || []) if (!seen || !seen.has(id)) return true;
  return false;
}

/**
 * The beam-pass card queue (C6 R4): one card on screen at a time for `showMs`, the rest wait in
 * order. A plain value — { current: { id, until } | null, queue: [id] } — so RadarMap only keeps
 * it in a ref and the timing is testable without timers.
 */
export const NO_CARDS = Object.freeze({ current: null, queue: Object.freeze([]) });

/** Add `id` (shown at once if nothing is up). An id already up or waiting is ignored. */
export function enqueueCard(q, id, now, showMs) {
  if (q.current?.id === id || q.queue.includes(id)) return q;
  if (!q.current) return { current: { id, until: now + showMs }, queue: q.queue };
  return { current: q.current, queue: [...q.queue, id] };
}

/** Once the current card's time is up, show the next waiting one (or nothing). */
export function advanceCards(q, now, showMs) {
  if (!q.current || now < q.current.until) return q;
  const [next, ...rest] = q.queue;
  return { current: next == null ? null : { id: next, until: now + showMs }, queue: rest };
}

/** Short relative time ("just now", "12m ago", "3h ago", "2d ago"); '' for a missing/bad time. */
export function agoShort(iso, now = Date.now()) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const m = Math.round((now - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * The words on a beam-pass card (C6 R4): headline, crisis type, risk tier word, and how long ago
 * it changed (the same timestamp that made it "happening now"). A part the bundle lacks is null.
 */
export function scanCardText(s, now = Date.now()) {
  return {
    headline: s.verb_label || null,
    type: AXIS_LABELS[s.axis] || null,
    tier: TIER_LABEL[s.tier] || null,
    ago: agoShort(changedAt(s), now) || null,
  };
}

/**
 * The words on the radar's "Scan again" control (one more lap; a press mid-lap restarts it). It is
 * never disabled, so keyboard focus is not dropped when a lap starts; the visible text is the
 * accessible name. Not rendered at all under reduced motion.
 */
export function scanControlLabel(scanning) {
  return scanning ? 'Scanning…' : 'Scan again';
}
