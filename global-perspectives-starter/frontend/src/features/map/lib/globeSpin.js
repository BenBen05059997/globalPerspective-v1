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

/** Desktop opens on the spinning globe when WebGL works; phones (<900px) keep today's default. */
export function defaultMapView(width, webglOk) {
  if (!webglOk) return 'flat';
  return width >= 900 ? 'globe' : 'flat';
}

/** Props for the small spin toggle control: reduced motion disables it outright. */
export function spinControlState(reduceMotion, spinOn) {
  if (reduceMotion) return { disabled: true, pressed: false, label: 'Spin off (reduced motion)' };
  return { disabled: false, pressed: !!spinOn, label: spinOn ? 'Pause spin' : 'Resume spin' };
}
