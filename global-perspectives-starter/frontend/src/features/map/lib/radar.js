// radar — pure geometry/timing helpers for RadarMap (M4: the flat radar mode). Kept UI-free
// (no DOM/canvas/SVG) so the sweep maths is testable in plain vitest. See
// project-docs/redesign-ux/_active/CONSOLE_WIREFRAME_TECHNIQUE.md §3 for the design this mirrors.

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
 * this tick? Handles the wrap at 360→0. A zero-length tick (no movement, e.g. the sweep is
 * paused) never counts as a pass. This is what fires the one-per-revolution "scanned" mark in
 * the feed — a marker is only crossed once per lap, so callers don't need extra debouncing.
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

/**
 * Afterglow for a marker the beam just passed: 1 right at the leading edge, fading linearly to
 * 0 across `trailDeg`, then 0 for the rest of the revolution. Because a sweep only revisits a
 * given marker once per lap, this single decaying value *is* the "one brief flare per pass" —
 * no separate flash/flag state is needed to avoid flashing (WCAG 2.3).
 */
export function scanGlow(sweepAngle, markerAngle, trailDeg = 40) {
  if (!Number.isFinite(sweepAngle) || !Number.isFinite(markerAngle) || trailDeg <= 0) return 0;
  const behind = norm360(sweepAngle - markerAngle);
  return behind < trailDeg ? 1 - behind / trailDeg : 0;
}

/** Props for the radar's sweep stop/resume control — same shape as globeSpin's spinControlState. */
export function sweepControlState(reduceMotion, sweepOn) {
  if (reduceMotion) return { disabled: true, pressed: false, label: 'Sweep off (reduced motion)' };
  return { disabled: false, pressed: !!sweepOn, label: sweepOn ? 'Pause sweep' : 'Resume sweep' };
}
