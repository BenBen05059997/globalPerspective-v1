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

// deck.gl's GlobeView draws the sphere at `TILE_SIZE * 2^zoom / (2π)` pixels of radius (the same
// Web-Mercator "world size" math as its flat views, just wrapped onto a sphere). M6: the globe
// rendered small (~⅓ of the panel height) at the old fixed zoom (0.55); size it from the panel's
// own height instead, so the Earth fills a fixed, legible fraction of it regardless of viewport.
const GLOBE_TILE_SIZE = 512;
const GLOBE_DEFAULT_ZOOM = 0.55; // pre-M6 fallback, kept for a missing/invalid height

/**
 * globeZoomForHeight(height, fraction) — the zoom that makes the globe's diameter equal to
 * `fraction` of `height` pixels (default 0.8, the middle of the approved 75–85% band).
 */
export function globeZoomForHeight(height, fraction = 0.8) {
  if (!Number.isFinite(height) || height <= 0) return GLOBE_DEFAULT_ZOOM;
  if (!Number.isFinite(fraction) || fraction <= 0) fraction = 0.8;
  const diameter = fraction * height;
  const zoom = Math.log2((diameter * Math.PI) / GLOBE_TILE_SIZE);
  return Number.isFinite(zoom) ? zoom : GLOBE_DEFAULT_ZOOM;
}

// deck.gl's GlobeView looks at the sphere in perspective, so its visible disc (the limb) is
// smaller than the nominal `TILE_SIZE * 2^zoom / π` diameter above. Measured on the console
// (R4a, Playwright pixel scan at 1440×900 and 1280×720): visible ≈ 0.85 × nominal.
export const GLOBE_LIMB_FACTOR = 0.85;

/**
 * globeFitFraction(width, height, visible) — R4a full-bleed console: the NOMINAL fraction to pass
 * to globeZoomForHeight so the globe's VISIBLE disc is `visible` of the map height (default 0.78),
 * shrunk only when the band between the HUD columns is narrower than that (visible disc ≤ 92% of
 * the band's width, so the columns never crop it). Missing/invalid sizes keep the default.
 */
export function globeFitFraction(width, height, visible = 0.78) {
  let v = visible;
  if (Number.isFinite(height) && height > 0 && Number.isFinite(width) && width > 0) {
    v = Math.min(visible, (0.92 * width) / height);
  }
  return v / GLOBE_LIMB_FACTOR;
}
