// globeSpin — pure helpers for M3 (night-lights globe): the texture URL builder, the
// idle-rotation step, and the spin/mode defaults. Kept free of deck.gl / DOM so they're
// testable in jsdom (WebGL isn't available there).

/** Build the night-lights texture URL, respecting Vite's configured base path (normally '/'). */
export function textureUrl(base = '/') {
  const b = String(base || '/').replace(/\/+$/, '');
  return `${b}/textures/earth-night.jpg`;
}

/** Wrap a longitude into (-180, 180]. */
export function wrapLongitude(lon) {
  let l = lon % 360;
  if (l > 180) l -= 360;
  if (l <= -180) l += 360;
  return l;
}

/** Advance longitude by `degPerSec` degrees over `dtMs` milliseconds (idle globe drift). */
export function spinStep(longitude, dtMs, degPerSec = 3) {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return longitude;
  return wrapLongitude(longitude + (degPerSec * dtMs) / 1000);
}

/**
 * M4: the console has two modes now, GLOBE and RADAR (the old deck.gl "flat" map is gone —
 * radar replaces it as both the phone default and the no-WebGL fallback, since it's drawn with
 * SVG/canvas and never touches WebGL). Desktop opens on the spinning globe when WebGL works;
 * phones and any device without WebGL open on radar (cheap to draw, per the design brief).
 */
export function defaultMapView(width, webglOk) {
  if (!webglOk) return 'radar';
  return width >= 900 ? 'globe' : 'radar';
}

/**
 * Normalise a `gp_map_view` value read back from localStorage: an old 'flat' choice (from
 * before M4 removed the deck.gl flat mode) migrates to 'radar'; an unrecognised/missing value
 * returns null so the caller falls back to `defaultMapView`.
 */
export function normalizeStoredView(saved) {
  if (saved === 'globe') return 'globe';
  if (saved === 'radar' || saved === 'flat') return 'radar';
  return null;
}

/** Props for the small spin toggle control: reduced motion disables it outright. */
export function spinControlState(reduceMotion, spinOn) {
  if (reduceMotion) return { disabled: true, pressed: false, label: 'Spin off (reduced motion)' };
  return { disabled: false, pressed: !!spinOn, label: spinOn ? 'Pause spin' : 'Resume spin' };
}
