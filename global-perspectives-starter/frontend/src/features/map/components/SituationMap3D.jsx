import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator, _GlobeView as GlobeView, _GlobeController as GlobeController, _GlobeViewport as GlobeViewport } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer, ArcLayer, BitmapLayer, SolidPolygonLayer, PathLayer } from '@deck.gl/layers';
import * as topojson from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import topoData from '@/features/map/assets/countries-110m.json';
import { ISO3_TO_NUM, ISO3_CENTROID_FALLBACK } from '@/features/map/lib/countryGeo.js';
import { textureUrl, spinStep, spinControlState, globeZoomForHeight, globeFitFraction, GLOBE_LIMB_FACTOR } from '@/features/map/lib/globeSpin.js';
import { CRISIS_RGB } from '@/features/map/lib/crisisHue.js';
import { pulseSet } from '@/features/map/lib/pulse.js';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';
import {
  tierSize, markerKind, situationFreshness, freshnessLook, statusGlyph, desaturateRgb,
} from '@/features/map/lib/legend.js';

// M3 · night-lights globe (operator's option B) — NASA Black Marble, taken from the MIT-licensed
// three-globe package's examples. Loaded well after first paint (idle callback) so it never
// blocks the page shell; until it resolves the existing dark globe shows, and a failed load just
// keeps that look (no error UI — see CLAUDE.md "no placeholder/fallback UI").
const EARTH_TEXTURE_URL = textureUrl(import.meta.env.BASE_URL);
const EARTH_BOUNDS = [-180, -90, 180, 90];
const SPIN_DEG_PER_SEC = 3; // "a few degrees a second at most" (task M3 spec)

// Hue = kind of crisis, as RGB. oklch(0.70 0.155 h) normalised so no axis reads
// as "worse" than another at equal tier (DATA_STRATEGY §5 / map design target).
export const AXIS_RGB = {
  conflict: [238, 119, 84],
  political: [155, 140, 248],
  economic: [56, 182, 222],
  humanitarian: [216, 158, 40],
};
const AXIS_RGB_FALLBACK = [154, 164, 178];

// R4a · the approved map tokens (lib/legend.js, Legend.dc.html) drawn with deck.gl:
//   shape = kind (◆ GDACS alert = a diamond · news situation = a small dot in a soft, feathered
//   halo · selected = HUD brackets), hue = crisis type, size steps + a double ring for HIGH only,
//   brightness = freshness (live glows · plain · older desaturated · 30d+ not drawn), and the
//   ▲●◆▼ badges as small glyph shapes. The ◆, badges and brackets are drawn as geometry on the
//   sphere (sized in pixels from the current zoom), like the land and the country wash — deck.gl's
//   IconLayer drew nothing on this GlobeView (checked in R4a: attributes and atlas were fine).
const DEG = Math.PI / 180;
// Every marker layer sits a little above the sphere: drawn exactly on it, flat marks z-fight with
// the night texture / land mesh once the globe is zoomed in (half a ring or badge vanished). 30 km
// is invisible at globe scale; the sphere still hides the far side.
const MARK_LIFT_M = 30000;
// Translucent halos/rings are flat discs on the tangent plane, which sits slightly OUTSIDE the
// sphere at their edges — if they wrote depth they would hide the ◆ / badges drawn after them.
const NO_DEPTH_WRITE = { depthWriteEnabled: false };
/** Degrees of arc per screen pixel at the centre of the visible disc, for a globe zoom. */
function degPerPx(zoom) {
  return 360 / (GLOBE_LIMB_FACTOR * 512 * 2 ** zoom);
}
const lonScale = (lat) => Math.max(0.2, Math.cos(lat * DEG));
/** A pixel-space polygon (points in px around 0,0; +y = north) placed at [lon, lat]. */
function pxPolygon([lon, lat], pts, d, [dx, dy] = [0, 0]) {
  const c = lonScale(lat);
  return pts.map(([x, y]) => [lon + ((x + dx) * d) / c, lat + ((y + dy) * d), MARK_LIFT_M]);
}
const diamondPts = (k) => [[0, k], [k, 0], [0, -k], [-k, 0]];
const GLYPH_PTS = {
  escalating: [[0, 4.5], [4.5, -3.5], [-4.5, -3.5]],
  cooling: [[-4.5, 3.5], [4.5, 3.5], [0, -4.5]],
  steady: diamondPts(4.5),
  new: Array.from({ length: 10 }, (_, i) => [3.8 * Math.cos((i / 10) * 2 * Math.PI), 3.8 * Math.sin((i / 10) * 2 * Math.PI)]),
};
/** Four L-shaped HUD bracket paths around a `b`-pixel box, placed at [lon, lat]. */
function bracketPaths(pos, b, d) {
  const l = Math.min(7, b * 0.6);
  return [
    [[-b, b - l], [-b, b], [-b + l, b]], [[b - l, b], [b, b], [b, b - l]],
    [[b, -b + l], [b, -b], [b - l, -b]], [[-b + l, -b], [-b, -b], [-b, -b + l]],
  ].map((pts) => pxPolygon(pos, pts, d));
}
const BADGE_RGB = [238, 245, 249];
const EDGE_RGB = [4, 7, 12];
const outerR = (m) => m.size.ringR || m.size.r;

const landFeatures = topojson.feature(topoData, topoData.objects.countries).features;
// ISO-3 → country geometry / centroid, for spread arcs + affected-country fill (slice 2b).
const NUM_TO_FEATURE = {};
const NUM_TO_CENTROID = {};
for (const f of landFeatures) { NUM_TO_FEATURE[f.id] = f; NUM_TO_CENTROID[f.id] = geoCentroid(f); }
function iso3Centroid(iso3) {
  const num = ISO3_TO_NUM[iso3];
  const c = num ? NUM_TO_CENTROID[num] : ISO3_CENTROID_FALLBACK[iso3];
  return c && Number.isFinite(c[0]) ? c : null;
}
function iso3Feature(iso3) { const num = ISO3_TO_NUM[iso3]; return num ? NUM_TO_FEATURE[num] : null; }

// This component is globe-only: the flat "MapView" overview mode was replaced by RadarMap (M4),
// which is now both the phone default and the no-WebGL fallback. The single call site
// (SituationHome.jsx) always passes view="globe"; the flat-mode branches this file used to carry
// (INITIAL_VIEW, MapView, WebMercatorViewport, the dragRotate:false controller) were unreachable
// dead code and were removed (F2.21, map-console review R1).
const GLOBE_VIEW_BASE = { longitude: 12, latitude: 18, pitch: 0, bearing: 0, minZoom: -0.5, maxZoom: 6 };
// M6: the globe fills ~75–85% of the map panel's own height, computed from `height` — not a
// fixed zoom that reads small on a tall panel and cramped on a short one.
// R4a: in the full-bleed console the globe sits in the band between the HUD columns, so a narrow
// band shrinks it (globeFitFraction) rather than letting the columns crop it.
const globeViewFor = (height, width) => ({ ...GLOBE_VIEW_BASE, zoom: globeZoomForHeight(height, globeFitFraction(width, height)) });
// A callout must never render under the top-right control cluster (Walk-through / Globe·Radar /
// Key), which sits at top:12 and runs to roughly y=54 — keep callouts clear of that band (M6).
const CALLOUT_TOP_MARGIN = 58;

// Is a lon/lat on the near-facing hemisphere of a globe centred at (cLon,cLat)? (cull far-side callouts)
function onNearSide(lon, lat, cLon, cLat) {
  const r = Math.PI / 180;
  const v = [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
  const c = [Math.cos(cLat * r) * Math.cos(cLon * r), Math.cos(cLat * r) * Math.sin(cLon * r), Math.sin(cLat * r)];
  return v[0] * c[0] + v[1] * c[1] + v[2] * c[2] > 0.05; // within ~87° of the sub-view point
}

const CARD_W = 288;
const CARD_MINH = 128;
const GAP = 14;

// Place the anchored callout in the first of NE/NW/SE/SW that fully fits (8px margin);
// only a literal-corner pin clamps and grows a short leader (design 3c).
function placeCallout(px, py, W, H, topMargin = 8) {
  const M = 8;
  const cand = [
    { left: px + GAP, top: py - CARD_MINH - GAP },        // NE
    { left: px - CARD_W - GAP, top: py - CARD_MINH - GAP }, // NW
    { left: px + GAP, top: py + GAP },                     // SE
    { left: px - CARD_W - GAP, top: py + GAP },            // SW
  ];
  for (const c of cand) {
    if (c.left >= M && c.top >= topMargin && c.left + CARD_W <= W - M && c.top + CARD_MINH <= H - M) {
      return { left: c.left, top: c.top, leader: null };
    }
  }
  // No quadrant fits — clamp into view (never above topMargin) and draw a leader from the card's
  // nearest corner.
  const left = Math.min(Math.max(px - CARD_W / 2, M), W - CARD_W - M);
  const top = Math.min(Math.max(py - CARD_MINH / 2, topMargin), H - CARD_MINH - M);
  const cornerX = Math.min(Math.max(px, left), left + CARD_W);
  const cornerY = Math.min(Math.max(py, top), top + CARD_MINH);
  const dist = Math.hypot(px - cornerX, py - cornerY);
  return { left, top, leader: dist > 6 && dist < 180 ? { x1: cornerX, y1: cornerY, x2: px, y2: py } : null };
}

const TIER_W = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };

/**
 * SituationMap3D — deck.gl night globe drawn with the approved map tokens (lib/legend.js): shape =
 * kind, hue = crisis type, size + double ring = HIGH, brightness = freshness, ▲●◆▼ badges, HUD
 * brackets for the selection. The only marker motion is the capped 24h pulse (lib/pulse.js). An
 * anchored callout shows the current tour stop; hover → tooltip; click → onSelect(id).
 */
export default function SituationMap3D({
  situations = [], focusId, callout = null, tour = null, newIds = null, view = 'globe', onSelect, onOpenCallout, height = 560, width = null,
  shading = [], storyFocusIso3 = null, onSelectCountry, onHoverCountry, onFocusCountry, onLeaveCountry,
}) {
  // `view` is accepted for API back-compat with the single call site (SituationHome.jsx always
  // passes "globe" — see the comment above GLOBE_VIEW_BASE); it no longer changes any behaviour.
  void view;
  // M6: the globe's default zoom is computed from the panel height (~75–85% fill), read through a
  // ref so a later window resize alone never resets a zoom the visitor already chose by
  // interacting — only clearing a selection re-applies it.
  const heightRef = useRef(height);
  heightRef.current = height;
  const widthRef = useRef(width);
  widthRef.current = width;
  const [viewState, setViewStateReact] = useState(() => globeViewFor(height, width));
  // F1.2 (map-console review R1): the spin/pulse loops used to call setState every animation
  // frame, which made deck.gl rebuild its layers 60x/sec (76 long tasks / 20s on weak GPUs). Both
  // loops now read/write this ref every frame and push the new view straight to the deck.gl
  // instance via `deckRef.current.setProps(...)` — no React re-render per frame. `viewState`
  // (the React state above) is still the source of truth for the initial paint, user drags/zooms
  // (deck.gl's own onViewStateChange, which fires at input rate, not 60fps) and fly-tos, and is
  // synced from it below so the ref never goes stale between renders.
  // R4a: the ref is the single source of truth for the camera; `setViewState` keeps ref + React
  // state together, and the DeckGL element always renders from the ref, so an unrelated
  // re-render can never snap the globe back to a stale copy. deck.gl v9's React ref exposes the
  // instance as `.deck` (the R1 loops called `.setProps` on the ref handle itself, which threw
  // on the first frame and silently stopped both the spin and the pulse).
  const viewStateRef = useRef(viewState);
  const setViewState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(viewStateRef.current) : updater;
    if (next === viewStateRef.current) return;
    viewStateRef.current = next;
    setViewStateReact(next);
  }, []);
  const deckInstance = () => deckRef.current?.deck || null;
  const deckRef = useRef(null);
  const userMoved = useRef(false);
  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);
  // Idle spin: stops for the session on any drag/zoom/click or a selection; the small control
  // below can restart it. Reduced motion never spins.
  const [spinOn, setSpinOn] = useState(!reduceMotion);
  const stopSpin = useCallback(() => setSpinOn(false), []);
  // F2.1: resuming spin after a drag did nothing — the spin tick's `!userMoved.current` guard
  // stayed tripped forever because only stopSpin (never a resume) ever touched it. Resuming must
  // clear it so the drift actually restarts.
  const resumeSpin = useCallback(() => { userMoved.current = false; setSpinOn(true); }, []);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ width: 1, height });

  // F1.2: pause both animation loops (spin, pulse) when the tab is hidden or the map panel has
  // scrolled off-screen — a plain visibility/IntersectionObserver check read inside the rAF loops
  // below, not a dependency that would tear the loop down and rebuild it.
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    if (!wrapRef.current || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((entries) => setOnScreen(entries[0]?.isIntersecting ?? true), { threshold: 0.01 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);
  const onScreenRef = useRef(onScreen);
  onScreenRef.current = onScreen;
  const animationPaused = useCallback(() => (typeof document !== 'undefined' && document.hidden) || !onScreenRef.current, []);

  // Night-lights texture: probed with a plain Image() after an idle tick so a slow/failed load
  // never touches deck.gl or throws — it only ever flips `textureReady` on success. F1.2: the
  // idle callback now carries a 2s timeout so a continuously-busy main thread can't starve it
  // forever (the fallback setTimeout path is unchanged — it has no such starvation risk).
  const [textureReady, setTextureReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      const img = new Image();
      img.onload = () => { if (!cancelled) setTextureReady(true); };
      img.onerror = () => { /* keep the existing dark globe; no error UI (CLAUDE.md) */ };
      img.src = EARTH_TEXTURE_URL;
    };
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 200);
    const cic = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;
    const handle = ric(load, { timeout: 2000 });
    return () => { cancelled = true; cic(handle); };
  }, []);

  // Brightness = freshness: 30d+ situations are not drawn (SituationHome counts them instead).
  const active = useMemo(
    () => situations.filter((s) => s.state !== 'closed' && s.centroid && situationFreshness(s) !== 'hidden'),
    [situations],
  );
  const hue = (s) => AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
  const pos = (s) => [s.centroid.lon, s.centroid.lat, MARK_LIFT_M];
  // One derived record per drawn situation, so every layer reads the same token decisions.
  const marks = useMemo(() => active.map((s) => {
    const fresh = situationFreshness(s);
    const look = freshnessLook(fresh);
    const base = AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
    return {
      s, fresh, look, kind: markerKind(s), size: tierSize(s.tier), glyph: statusGlyph(s),
      rgb: look.desaturate ? desaturateRgb(base) : base, position: [s.centroid.lon, s.centroid.lat, MARK_LIFT_M],
    };
  }), [active]);
  // `newIds` (since-your-last-visit) stays a feed-only marker: the map draws only the approved
  // ▲●◆▼ badges, never an extra undocumented ring.
  void newIds;
  // reduceMotion kept for future globe-view motion; the map itself is now static (see below).
  void reduceMotion;

  // Spread arcs + affected fill are a SELECTION STATE, never a base layer (the spaghetti answer):
  // they exist only while one situation is focused. Origin → each affected-country centroid.
  const selectionGeo = useMemo(() => {
    const s = focusId && situations.find((x) => x.id === focusId && x.centroid);
    if (!s) return null;
    const rgb = AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
    const origin = [s.centroid.lon, s.centroid.lat];
    const originNum = (s.iso3_affected || []).map((c) => ISO3_TO_NUM[c]).find(Boolean);
    const fills = []; const arcs = []; const dests = [];
    for (const iso of (s.iso3_affected || [])) {
      const feat = iso3Feature(iso); if (feat && ISO3_TO_NUM[iso] !== originNum) fills.push(feat);
      const c = iso3Centroid(iso);
      if (c && Math.hypot(c[0] - origin[0], c[1] - origin[1]) > 1.5) { arcs.push({ from: origin, to: c }); dests.push(c); }
    }
    return { rgb, fills, arcs, dests };
  }, [focusId, situations]);

  // Country shading (H2, M5a): a story with no exact place shades its country instead of getting
  // a made-up pin. `shading` entries are pre-computed upstream (storyShading.js) and already
  // exclude stories that have a real situation pin or no resolvable ISO3.
  const countryAnchor = useCallback((x, y) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { getBoundingClientRect: () => ({ top: rect.top + y - 2, bottom: rect.top + y + 2, left: rect.left + x - 2, right: rect.left + x + 2 }) };
  }, []);
  const storyShadeFeatures = useMemo(() => (shading || []).map((e) => {
    const feat = iso3Feature(e.iso3);
    if (!feat) return null;
    return { ...feat, properties: { ...feat.properties, __iso3: e.iso3, __count: e.count, __dim: e.dim, __rgb: CRISIS_RGB[e.crisisType] || CRISIS_RGB.neutral } };
  }).filter(Boolean), [shading]);
  const storyShadeLayer = useMemo(() => (
    storyShadeFeatures.length
      ? new GeoJsonLayer({
        id: 'story-shade', data: storyShadeFeatures, stroked: true, filled: true, pickable: true,
        getFillColor: (f) => [...f.properties.__rgb, f.properties.__dim ? 26 : 46],
        getLineColor: (f) => (f.properties.__iso3 === storyFocusIso3 ? [255, 255, 255, 230] : [...f.properties.__rgb, 130]),
        getLineWidth: (f) => (f.properties.__iso3 === storyFocusIso3 ? 2.5 : 1),
        lineWidthUnits: 'pixels', lineWidthMinPixels: 1,
        onClick: (info) => info.object && onSelectCountry && onSelectCountry(info.object.properties.__iso3),
        onHover: (info) => {
          if (info.object) { const a = countryAnchor(info.x, info.y); if (a) onHoverCountry && onHoverCountry(info.object.properties.__iso3, a); }
          else onLeaveCountry && onLeaveCountry();
        },
        updateTriggers: { getLineColor: [storyFocusIso3], getLineWidth: [storyFocusIso3] },
      })
      : null
  ), [storyShadeFeatures, storyFocusIso3, onSelectCountry, onHoverCountry, onLeaveCountry, countryAnchor]);
  // onFocusCountry (keyboard) has no deck.gl equivalent for individual GeoJSON features — same
  // limitation the existing situation pins have (pickable ScatterplotLayer, pointer-only).
  void onFocusCountry;

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect; if (r) setDims({ width: r.width, height: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fly to the focused situation, or (M5b) to a selected story's country centroid when no
  // situation is focused — `focusId` and a story selection are mutually exclusive (SituationHome).
  // Fly back on clear. Keyed on focusId/storyFocusIso3 + the resolved centroid string only, so
  // the 5-min poll (new `situations` array) never re-fires the same fly-to.
  const focusCentroid = useMemo(() => {
    const s = situations.find((x) => x.id === focusId && x.centroid);
    if (s) return `${s.centroid.lon},${s.centroid.lat}`;
    if (storyFocusIso3) {
      const c = iso3Centroid(storyFocusIso3);
      if (c) return `${c[0]},${c[1]}`;
    }
    return null;
  }, [situations, focusId, storyFocusIso3]);
  useEffect(() => {
    if (focusCentroid) {
      stopSpin(); // a selection turns the globe to face the story and stays stopped (task M3)
      const [lon, lat] = focusCentroid.split(',').map(Number);
      setViewState((v) => ({
        ...v, longitude: lon, latitude: lat - 4, zoom: 2.1,
        ...(reduceMotion ? {} : { transitionDuration: 1300, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }),
      }));
    } else if (userMoved.current) {
      setViewState((v) => ({
        ...v, ...globeViewFor(heightRef.current, widthRef.current),
        ...(reduceMotion ? {} : { transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator() }),
      }));
    }
  }, [focusCentroid, reduceMotion, stopSpin, setViewState]);

  // R4a: re-fit the globe when the console band is measured or resized — only while the visitor
  // hasn't dragged/zoomed it and nothing is focused, so it never overrides a zoom they chose.
  useEffect(() => {
    if (userMoved.current || focusCentroid) return;
    const zoom = globeZoomForHeight(height, globeFitFraction(width, height));
    setViewState((v) => (Math.abs((v.zoom ?? 0) - zoom) < 0.01 ? v : { ...v, zoom }));
  }, [height, width]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle spin: only while on, and not mid-drag. Strips any leftover transitionDuration/
  // interpolator each frame so the drift itself is never animated/eased.
  // R4a: the camera advances in the ref every frame and is committed through React at ~30fps.
  // (R1 pushed it straight into the deck instance instead, but deck.gl 9.4's React wrapper
  // re-applies its last React props on its own re-renders, so a direct viewState write is
  // reverted within a frame.) All layers are memoised, so a commit only re-sends the camera —
  // no layer is rebuilt per frame.
  useEffect(() => {
    if (!spinOn || reduceMotion) return undefined;
    let raf; let last = null; let lastSync = 0;
    const SYNC_INTERVAL_MS = 1000 / 30;
    const tick = (t) => {
      if (last != null && !userMoved.current && !animationPaused()) {
        const dt = t - last;
        const { transitionDuration, transitionInterpolator, ...rest } = viewStateRef.current; // eslint-disable-line no-unused-vars
        viewStateRef.current = { ...rest, longitude: spinStep(rest.longitude, dt, SPIN_DEG_PER_SEC) };
        if (t - lastSync >= SYNC_INTERVAL_MS) { lastSync = t; setViewStateReact(viewStateRef.current); }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinOn, reduceMotion, animationPaused]);  

  // Static (non-animated) layers — memoised so the pickable `core` layer keeps a stable instance
  // across breathing-halo frames (a fresh instance each frame was eating clicks).
  // In globe mode, once the night-lights texture is showing, the opaque land fill would muddy
  // it — fall back to a faint fill + dimmer border so the texture (and the crisis markers) read.
  const landDimmed = textureReady;
  // Bottom-most layer, globe only, added only once the texture has actually loaded (kept a
  // separate memo so its presence never changes the other layers' instances).
  const earthLayer = useMemo(() => (
    textureReady
      ? new BitmapLayer({
        id: 'earth-night', image: EARTH_TEXTURE_URL, bounds: EARTH_BOUNDS,
        opacity: 0.8, pickable: false, // dimmed so crisis markers stay the brightest thing on the globe
      })
      : null
  ), [textureReady]);
  const landLayer = useMemo(() => new GeoJsonLayer({
    id: 'land', data: landFeatures, stroked: true, filled: true, extruded: false,
    getFillColor: landDimmed ? [24, 31, 44, 30] : [24, 31, 44, 255],
    getLineColor: landDimmed ? [90, 105, 130, 130] : [40, 50, 68, 255],
    lineWidthMinPixels: 0.5,
  }), [landDimmed]);

  // Marker layers (R4a tokens), all static — memoised so the pickable layers keep stable
  // instances across pulse frames (a fresh instance each frame used to eat clicks).
  // Geometry for the ◆ / badges / brackets is sized from the zoom, quantised so a drag or the
  // spin (which never changes zoom) never rebuilds it; only zooming / a fly-to does.
  const zoomQ = Math.round((viewState.zoom ?? 0) * 20) / 20;
  const markerLayers = useMemo(() => {
    const d = degPerPx(zoomQ);
    const dimA = (m, a) => (focusId && m.s.id !== focusId ? Math.round(a * 0.4) : a);
    const situationsOnly = marks.filter((m) => m.kind === 'situation');
    const alerts = marks.filter((m) => m.kind === 'alert');
    const trig = { getFillColor: [focusId], getColor: [focusId] };
    const onClick = (info) => info.object && onSelect && onSelect(info.object.s.id);
    const surface = (id, data, getPolygon, getFillColor, extra = {}) => new SolidPolygonLayer({
      id, data, getPolygon, getFillColor, filled: true, extruded: false, updateTriggers: { getFillColor: [focusId] }, ...extra,
    });
    const glyphed = marks.filter((m) => m.glyph);
    const selected = marks.filter((m) => m.s.id === focusId);
    return {
      // Brightness = freshness: only LIVE (<24h) items glow.
      glow: new ScatterplotLayer({
        id: 'fresh-glow', parameters: NO_DEPTH_WRITE, data: marks.filter((m) => m.look.glow), getPosition: (m) => m.position,
        radiusUnits: 'pixels', stroked: false, pickable: false,
        getRadius: (m) => outerR(m) + 9, getFillColor: (m) => [...m.rgb, dimA(m, 70)], updateTriggers: trig,
      }),
      // Shape: a news situation's soft, feathered halo = an approximate place (two falloff rings).
      softOuter: new ScatterplotLayer({
        id: 'soft-outer', parameters: NO_DEPTH_WRITE, data: situationsOnly, getPosition: (m) => m.position,
        radiusUnits: 'pixels', stroked: false, pickable: false,
        getRadius: (m) => m.size.r + 12, getFillColor: (m) => [...m.rgb, dimA(m, m.look.desaturate ? 16 : 28)], updateTriggers: trig,
      }),
      softInner: new ScatterplotLayer({
        id: 'soft-inner', parameters: NO_DEPTH_WRITE, data: situationsOnly, getPosition: (m) => m.position,
        radiusUnits: 'pixels', stroked: false, pickable: false,
        getRadius: (m) => m.size.r + 5, getFillColor: (m) => [...m.rgb, dimA(m, m.look.desaturate ? 34 : 64)], updateTriggers: trig,
      }),
      // Size: the double ring is reserved for HIGH.
      highRing: new ScatterplotLayer({
        id: 'high-ring', parameters: NO_DEPTH_WRITE, data: marks.filter((m) => m.size.doubleRing), getPosition: (m) => m.position,
        radiusUnits: 'pixels', filled: false, stroked: true, pickable: false, lineWidthUnits: 'pixels',
        getRadius: (m) => m.size.ringR, getLineWidth: 1.5, getLineColor: (m) => [...m.rgb, dimA(m, 230)],
        updateTriggers: { getLineColor: [focusId] },
      }),
      dots: new ScatterplotLayer({
        id: 'core', data: situationsOnly, pickable: true, radiusUnits: 'pixels', getPosition: (m) => m.position,
        getRadius: (m) => Math.max(3, m.size.r * 0.6),
        getFillColor: (m) => [...m.rgb, dimA(m, m.look.desaturate ? 215 : 255)],
        stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1, getLineColor: [...EDGE_RGB, 255],
        onClick, updateTriggers: trig,
      }),
      // ◆ official alert: a dark edge diamond under the hue diamond (MIL-STD alert frame).
      alertEdge: surface('alert-edge', alerts, (m) => pxPolygon(m.position, diamondPts(m.size.r * 1.2 + 1.5), d),
        (m) => [...EDGE_RGB, dimA(m, 255)], { parameters: NO_DEPTH_WRITE }),
      alertCore: surface('alert-core', alerts, (m) => pxPolygon(m.position, diamondPts(m.size.r * 1.2), d),
        (m) => [...m.rgb, dimA(m, m.look.desaturate ? 215 : 255)], { pickable: true, onClick }),
      // Badges: ▲ escalating · ● new · ◆ steady · ▼ cooling — glyph shapes up-right of the mark,
      // one neutral colour (hue stays crisis type only), with a dark edge so they read on land.
      badgeEdge: surface('badge-edge', glyphed, (m) => pxPolygon(m.position, GLYPH_PTS[m.glyph.key].map(([x, y]) => [x * 1.45, y * 1.45]), d, [outerR(m) + 6, outerR(m) + 6]),
        (m) => [...EDGE_RGB, dimA(m, 230)], { parameters: NO_DEPTH_WRITE }),
      badges: surface('badges', glyphed, (m) => pxPolygon(m.position, GLYPH_PTS[m.glyph.key], d, [outerR(m) + 6, outerR(m) + 6]),
        (m) => [...BADGE_RGB, dimA(m, 255)]),
      // Selected = HUD brackets (L4), replacing the old white keyline.
      brackets: new PathLayer({
        id: 'brackets', data: selected.flatMap((m) => bracketPaths(m.position, outerR(m) + 9, d)), getPath: (p) => p,
        getColor: [...BADGE_RGB, 255], getWidth: 2, widthUnits: 'pixels', pickable: false,
      }),
    };
  }, [marks, focusId, zoomQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // A selected STORY (no exact place) gets the same HUD brackets, at its shaded country's centre.
  const storyBrackets = useMemo(() => {
    const c = storyFocusIso3 ? iso3Centroid(storyFocusIso3) : null;
    return c ? new PathLayer({
      id: 'story-brackets', data: bracketPaths(c, 16, degPerPx(zoomQ)), getPath: (p) => p,
      getColor: [...BADGE_RGB, 255], getWidth: 2, widthUnits: 'pixels', pickable: false,
    }) : null;
  }, [storyFocusIso3, zoomQ]);

  // Motion budget (M6, STORY_WEB_RETHINK_PLAN.md §8): only 3 things on the whole page may move —
  // the radar sweep, this 2.4s breathing pulse (NEW/▲ situations from the last 24h, capped at 8,
  // highest tier first — see lib/pulse.js), and the selected story's travelling arc dashes.
  // Everything else stays static. Recomputed only when `active` changes (the 5-min poll), not
  // per animation frame.
  const pulseIds = useMemo(() => pulseSet(active, Date.now(), 8), [active]);
  const pulseData = useMemo(() => active.filter((s) => pulseIds.has(s.id)), [active, pulseIds]);
  const buildPulseLayer = useCallback((t) => (!reduceMotion && pulseData.length)
    ? new ScatterplotLayer({
      id: 'pulse', parameters: NO_DEPTH_WRITE, data: pulseData, getPosition: pos, radiusUnits: 'pixels', pickable: false,
      getRadius: (s) => (tierSize(s.tier).ringR || tierSize(s.tier).r) + 6 + t * 18,
      getFillColor: (s) => [...hue(s), Math.round(150 * (1 - t))],
    })
    : null, [reduceMotion, pulseData]);
  // Reduced motion → a still ring instead of a pulse (never nothing, never moving). Memoised (like
  // the layers below it) so composeLayers gets a stable reference instead of a new instance every
  // render.
  const pulseStillLayer = useMemo(() => (reduceMotion && pulseData.length)
    ? new ScatterplotLayer({
      id: 'pulse-still', parameters: NO_DEPTH_WRITE, data: pulseData, getPosition: pos, radiusUnits: 'pixels', pickable: false,
      getRadius: (s) => (tierSize(s.tier).ringR || tierSize(s.tier).r) + 7, filled: false, stroked: true,
      getLineColor: (s) => [...hue(s), 190], getLineWidth: 1.5, lineWidthUnits: 'pixels',
    })
    : null, [reduceMotion, pulseData]);
  // Static (t=0) frame for the initial/non-animated JSX render below — the rAF loop (further
  // down) takes over via deckRef.current.setProps on the very next frame.
  const pulsePhaseRef = useRef(0);
  const pulseLayer = buildPulseLayer(pulsePhaseRef.current);

  // Selection-state layers (only when a situation is focused): affected-country tint, spread arcs,
  // hollow destination rings. Drawn under the pins (fill/arcs) and beside them (dest rings).
  const selectionLayers = useMemo(() => {
    if (!selectionGeo) return [];
    const { rgb, fills, arcs, dests } = selectionGeo;
    const out = [];
    if (fills.length) out.push(new GeoJsonLayer({
      id: 'affected-fill', data: { type: 'FeatureCollection', features: fills },
      stroked: true, filled: true, getFillColor: [...rgb, 24], getLineColor: [...rgb, 90],
      lineWidthMinPixels: 1, pickable: false,
    }));
    if (arcs.length) out.push(new ArcLayer({
      id: 'spread-arcs', data: arcs, getSourcePosition: (d) => d.from, getTargetPosition: (d) => d.to,
      getSourceColor: [...rgb, 210], getTargetColor: [...rgb, 40], getWidth: 1.5, pickable: false,
    }));
    if (dests.length) out.push(new ScatterplotLayer({
      id: 'dest-rings', data: dests, getPosition: (d) => d, radiusUnits: 'pixels', getRadius: 5,
      filled: false, stroked: true, getLineColor: [...rgb, 200], getLineWidth: 1.2, lineWidthUnits: 'pixels', pickable: false,
    }));
    return out;
  }, [selectionGeo]);

  // Order (bottom → top): earth-night, land, story country wash, selection fill/arcs, freshness
  // glow, soft halos, HIGH ring, pulse (the only animated marker layer, capped), news dots,
  // alert diamonds, badges, selected brackets, destination rings.
  const composeLayers = useCallback((pulseAlpha) => [
    ...(earthLayer ? [earthLayer] : []),
    landLayer,
    ...(storyShadeLayer ? [storyShadeLayer] : []),
    ...selectionLayers.filter((l) => l.id !== 'dest-rings'),
    markerLayers.glow, markerLayers.softOuter, markerLayers.softInner, markerLayers.highRing,
    ...(pulseAlpha ? [pulseAlpha] : []), ...(pulseStillLayer ? [pulseStillLayer] : []),
    markerLayers.dots, markerLayers.alertEdge, markerLayers.alertCore, markerLayers.badgeEdge, markerLayers.badges, markerLayers.brackets,
    ...(storyBrackets ? [storyBrackets] : []),
    ...selectionLayers.filter((l) => l.id === 'dest-rings'),
  ], [earthLayer, landLayer, storyShadeLayer, selectionLayers, markerLayers, storyBrackets, pulseStillLayer]);
  const layers = composeLayers(pulseLayer);

  // F1.2: the 2.4s breathing pulse used to be driven by a `pulseT` React state updated every
  // frame — deck.gl rebuilt every layer on every tick as a result. It now keeps its phase in a
  // plain closure variable and pushes a freshly-built pulse layer straight to the deck.gl
  // instance (deckRef.current.setProps), so only the `pulse` layer itself is ever replaced.
  useEffect(() => {
    if (reduceMotion || pulseData.length === 0) return undefined;
    let raf; let start = null;
    const PULSE_MS = 2400;
    const tick = (t) => {
      if (start == null) start = t;
      if (!animationPaused()) {
        const phase = ((t - start) % PULSE_MS) / PULSE_MS;
        pulsePhaseRef.current = phase; // a React render in between keeps the same phase
        deckInstance()?.setProps({ layers: composeLayers(buildPulseLayer(phase)) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, pulseData.length, composeLayers, buildPulseLayer, animationPaused]);  

  const getTooltip = useCallback(({ object }) => {
    const sit = object?.s;
    if (!sit || !sit.verb_label) return null;
    const tierW = TIER_W[sit.tier] || sit.tier;
    const level = gdacsLevelBadge(sit);
    const glyph = statusGlyph(sit);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const bits = [tierW, level, glyph ? `${glyph.glyph} ${glyph.label}` : null].filter(Boolean).map(esc).join(' · ');
    return { html: `<b>${esc(sit.verb_label)}</b><br/>${bits}`, style: { background: '#0d1017', color: '#dfe6f2', fontSize: '12px', borderRadius: '7px', padding: '6px 9px', border: '1px solid #232c3a' } };
  }, []);

  // Project the callout situation's centroid to screen space and place the card. On the globe,
  // use the globe viewport and hide the card when the pin is on the far side of the sphere.
  const place = useMemo(() => {
    if (!callout?.centroid || !dims.width) return null;
    try {
      const vs = viewStateRef.current;
      if (!onNearSide(callout.centroid.lon, callout.centroid.lat, vs.longitude, vs.latitude)) return null;
      const vp = new GlobeViewport({ ...vs, width: dims.width, height: dims.height });
      const [x, y] = vp.project([callout.centroid.lon, callout.centroid.lat]);
      if (x < -40 || y < -40 || x > dims.width + 40 || y > dims.height + 40) return null;
      return { px: x, py: y, ...placeCallout(x, y, dims.width, dims.height, CALLOUT_TOP_MARGIN) };
    } catch { return null; }
  }, [callout, viewState, dims]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sm-wrap" style={{ height }} ref={wrapRef}>
      <DeckGL
        ref={deckRef}
        views={new GlobeView()}
        viewState={viewStateRef.current}
        onViewStateChange={(e) => {
          if (e.interactionState?.isDragging || e.interactionState?.isZooming) { userMoved.current = true; stopSpin(); }
          setViewState(e.viewState);
        }}
        controller={{ type: GlobeController }}
        layers={layers}
        getTooltip={getTooltip}
        pickingRadius={16}
        getCursor={({ isDragging, isHovering }) => (isDragging ? 'grabbing' : (isHovering ? 'pointer' : 'grab'))}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      />
      {place?.leader ? (
        <svg className="sm-leader" width={dims.width} height={dims.height} aria-hidden="true">
          <line x1={place.leader.x1} y1={place.leader.y1} x2={place.leader.x2} y2={place.leader.y2} />
        </svg>
      ) : null}
      {callout && place ? (
        <div className="sm-callout" style={{ left: place.left, top: place.top, width: CARD_W }}>
          {tour ? (
            <div className="sm-tourbar">
              <span>Tour <b>{tour.index + 1}</b> of {tour.total}</span>
              <span className="sm-tourbtns">
                <button onClick={tour.onPrev} aria-label="Previous">←</button>
                <button onClick={tour.onNext} aria-label="Next">→</button>
                <button onClick={tour.onStop}>Stop</button>
              </span>
            </div>
          ) : null}
          <button className="sm-callout-body" onClick={() => onOpenCallout && onOpenCallout(callout.id)}>
            <span className="sm-callout-top">
              <span className={`sh-badge sh-badge-${callout.tier}`}>{TIER_W[callout.tier] || callout.tier}</span>
              <span className="sm-callout-axis" style={{ color: `rgb(${hue(callout).join(',')})` }}>{callout.axis}</span>
              {callout.escalating ? <span className="sm-callout-esc">▲ escalating</span> : null}
            </span>
            {gdacsLevelBadge(callout) ? <span className="sh-gdacs-badge">{gdacsLevelBadge(callout)}</span> : null}
            <span className="sm-callout-title">{callout.verb_label}</span>
            {callout.what_changed ? <span className="sm-callout-what">{callout.what_changed}</span> : null}
            <span className="sm-callout-open">Open →</span>
          </button>
          {tour ? <div className="sm-tourticks">{Array.from({ length: tour.total }).map((_, i) => <i key={i} className={i === tour.index ? 'on' : ''} />)}</div> : null}
        </div>
      ) : null}
      <div className="sm-globe-foot">
        <span className="sm-attrib">Earth at night: NASA Black Marble</span>
        {(() => {
          const sc = spinControlState(reduceMotion, spinOn);
          return (
            <button
              className="sm-spin-ctl" aria-pressed={sc.pressed} aria-label={sc.label} title={sc.label}
              disabled={sc.disabled} onClick={() => (spinOn ? setSpinOn(false) : resumeSpin())}
            >
              {sc.disabled ? '⏸' : (sc.pressed ? '⏸' : '▶')}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
