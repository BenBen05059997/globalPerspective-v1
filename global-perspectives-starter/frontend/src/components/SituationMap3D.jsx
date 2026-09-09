import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView, WebMercatorViewport, FlyToInterpolator, _GlobeView as GlobeView, _GlobeController as GlobeController, _GlobeViewport as GlobeViewport } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import * as topojson from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import topoData from '../assets/countries-110m.json';
import { ISO3_TO_NUM, ISO3_CENTROID_FALLBACK } from '../utils/countryGeo.js';

// Hue = kind of crisis, as RGB. oklch(0.70 0.155 h) normalised so no axis reads
// as "worse" than another at equal tier (DATA_STRATEGY §5 / map design target).
export const AXIS_RGB = {
  conflict: [238, 119, 84],
  political: [155, 140, 248],
  economic: [56, 182, 222],
  humanitarian: [216, 158, 40],
};
const AXIS_RGB_FALLBACK = [154, 164, 178];
// Severity = luminance + halo radius (NOT size alone): size spans ~1.55× so low pins stay clickable.
const TIER_R = { low: 3.4, moderate: 4.2, elevated: 4.8, high: 5.3 };      // core dot radius (px)
const TIER_HALO = { elevated: 15, high: 24 };                              // soft outer glow radius (px); low/moderate none
const TIER_CORE_ALPHA = { low: 205, moderate: 235, elevated: 255, high: 255 };

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

// Flat overview (pitch 0) is the default — every situation legible, nothing behind a horizon.
// A user toggle swaps to the globe (deck.gl can't morph between the two, so it's a deliberate
// switch, never an auto-transition). Slice 3 / patch design variant C-as-toggle.
const INITIAL_VIEW = { longitude: 12, latitude: 20, zoom: 1.15, pitch: 0, bearing: 0, minZoom: 0.6, maxZoom: 8 };
const GLOBE_VIEW = { longitude: 12, latitude: 18, zoom: 0.55, pitch: 0, bearing: 0, minZoom: -0.5, maxZoom: 6 };

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
function placeCallout(px, py, W, H) {
  const M = 8;
  const cand = [
    { left: px + GAP, top: py - CARD_MINH - GAP },        // NE
    { left: px - CARD_W - GAP, top: py - CARD_MINH - GAP }, // NW
    { left: px + GAP, top: py + GAP },                     // SE
    { left: px - CARD_W - GAP, top: py + GAP },            // SW
  ];
  for (const c of cand) {
    if (c.left >= M && c.top >= M && c.left + CARD_W <= W - M && c.top + CARD_MINH <= H - M) {
      return { left: c.left, top: c.top, leader: null };
    }
  }
  // No quadrant fits — clamp into view and draw a leader from the card's nearest corner.
  const left = Math.min(Math.max(px - CARD_W / 2, M), W - CARD_W - M);
  const top = Math.min(Math.max(py - CARD_MINH / 2, M), H - CARD_MINH - M);
  const cornerX = Math.min(Math.max(px, left), left + CARD_W);
  const cornerY = Math.min(Math.max(py, top), top + CARD_MINH);
  const dist = Math.hypot(px - cornerX, py - cornerY);
  return { left, top, leader: dist > 6 && dist < 180 ? { x1: cornerX, y1: cornerY, x2: px, y2: py } : null };
}

const TIER_W = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };

/**
 * SituationMap3D — deck.gl dark world. Situations are glow DOTS: hue = axis,
 * luminance + halo = tier, white keyline exclusive to high, a slow breathing halo
 * exclusive to escalating (the only motion). An anchored callout shows the hero or the
 * current tour stop; hover → tooltip; click → onSelect(id).
 */
export default function SituationMap3D({
  situations = [], focusId, callout = null, tour = null, newIds = null, view = 'flat', onSelect, onOpenCallout, height = 560,
}) {
  const globe = view === 'globe';
  const [viewState, setViewState] = useState(globe ? GLOBE_VIEW : INITIAL_VIEW);
  const userMoved = useRef(false);
  // On toggle, reset to that view's default (a gentle transition; not a morph between view types).
  useEffect(() => {
    userMoved.current = false;
    setViewState((v) => ({ ...(globe ? GLOBE_VIEW : INITIAL_VIEW), longitude: v.longitude, latitude: globe ? 15 : v.latitude, transitionDuration: 600, transitionInterpolator: new FlyToInterpolator() }));
  }, [globe]);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ width: 1, height });
  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);

  const active = useMemo(() => situations.filter((s) => s.state !== 'closed' && s.centroid), [situations]);
  const hue = (s) => AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
  const pos = (s) => [s.centroid.lon, s.centroid.lat];
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

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect; if (r) setDims({ width: r.width, height: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fly to the focused situation; fly back on clear. Keyed on focusId + the resolved centroid
  // string only, so the 5-min poll (new `situations` array) never re-fires the same fly-to.
  const focusCentroid = useMemo(() => {
    const s = situations.find((x) => x.id === focusId && x.centroid);
    return s ? `${s.centroid.lon},${s.centroid.lat}` : null;
  }, [situations, focusId]);
  useEffect(() => {
    if (focusCentroid) {
      const [lon, lat] = focusCentroid.split(',').map(Number);
      setViewState((v) => ({ ...v, longitude: lon, latitude: globe ? lat - 4 : lat, zoom: globe ? 2.1 : 3.4, transitionDuration: 1300, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }));
    } else if (userMoved.current) {
      setViewState((v) => ({ ...v, ...(globe ? GLOBE_VIEW : INITIAL_VIEW), transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator() }));
    }
  }, [focusCentroid, globe]);

  // Static (non-animated) layers — memoised so the pickable `core` layer keeps a stable instance
  // across breathing-halo frames (a fresh instance each frame was eating clicks).
  const baseLayers = useMemo(() => [
    new GeoJsonLayer({
      id: 'land', data: landFeatures, stroked: true, filled: true, extruded: false,
      getFillColor: [24, 31, 44], getLineColor: [40, 50, 68], lineWidthMinPixels: 0.5,
    }),
    new ScatterplotLayer({
      id: 'halo', data: active.filter((s) => TIER_HALO[s.tier]),
      getPosition: pos, radiusUnits: 'pixels', stroked: false, pickable: false,
      getRadius: (s) => TIER_HALO[s.tier], getFillColor: (s) => [...hue(s), 34],
    }),
    // Escalating — a distinct STATIC double-ring (bigger, brighter, plus a hollow outer ring).
    // Static (not breathing) so the animation loop can never re-render mid-click and eat a tap.
    new ScatterplotLayer({
      id: 'escalating', data: active.filter((s) => s.escalating),
      getPosition: pos, radiusUnits: 'pixels', pickable: false,
      getRadius: (s) => (TIER_HALO[s.tier] || 14) * 1.15, getFillColor: (s) => [...hue(s), 60],
      stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.2, getLineColor: (s) => [...hue(s), 150],
    }),
    new ScatterplotLayer({
      id: 'core', data: active, pickable: true, radiusUnits: 'pixels',
      getPosition: pos,
      getRadius: (s) => (TIER_R[s.tier] || 3.4) * (s.id === focusId ? 1.25 : 1),
      // When a situation is focused, dim every other pin ~40% so the selection reads.
      getFillColor: (s) => {
        const a = TIER_CORE_ALPHA[s.tier] || 205;
        return [...hue(s), focusId && s.id !== focusId ? Math.round(a * 0.4) : a];
      },
      stroked: true, lineWidthUnits: 'pixels',
      getLineColor: (s) => (s.tier === 'high' || s.id === focusId ? [255, 255, 255, focusId && s.id !== focusId ? 90 : 235] : [...hue(s), 0]),
      getLineWidth: (s) => (s.id === focusId ? 2 : (s.tier === 'high' ? 1.25 : 0)),
      onClick: (info) => info.object && onSelect && onSelect(info.object.id),
      updateTriggers: { getRadius: [focusId], getFillColor: [focusId], getLineColor: [focusId], getLineWidth: [focusId] },
    }),
    // "New since your last visit" — a hollow white ring around new pins (design 3f).
    new ScatterplotLayer({
      id: 'new-marker', data: newIds ? active.filter((s) => newIds.has(s.id)) : [],
      getPosition: pos, radiusUnits: 'pixels', pickable: false,
      getRadius: (s) => (TIER_R[s.tier] || 3.4) + 4, getFillColor: [0, 0, 0, 0],
      stroked: true, getLineColor: [255, 255, 255, 200], getLineWidth: 1, lineWidthUnits: 'pixels',
      updateTriggers: { getRadius: [newIds] },
    }),
  ], [active, focusId, newIds]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Order: land, affected-fill, arcs, halo, escalating, new-marker, core (top=picking), dest-rings.
  const layers = [
    baseLayers[0],
    ...selectionLayers.filter((l) => l.id !== 'dest-rings'),
    baseLayers[1], baseLayers[2], baseLayers[4], baseLayers[3],
    ...selectionLayers.filter((l) => l.id === 'dest-rings'),
  ];

  const getTooltip = useCallback(({ object }) => {
    if (!object || !object.verb_label) return null;
    const tierW = TIER_W[object.tier] || object.tier;
    const stW = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing' }[object.state] || object.state;
    return { html: `<b>${object.verb_label}</b><br/>${tierW} · ${stW}`, style: { background: '#0d1017', color: '#dfe6f2', fontSize: '12px', borderRadius: '7px', padding: '6px 9px', border: '1px solid #232c3a' } };
  }, []);

  // Project the callout situation's centroid to screen space and place the card. On the globe,
  // use the globe viewport and hide the card when the pin is on the far side of the sphere.
  const place = useMemo(() => {
    if (!callout?.centroid || !dims.width) return null;
    try {
      if (globe && !onNearSide(callout.centroid.lon, callout.centroid.lat, viewState.longitude, viewState.latitude)) return null;
      const VP = globe ? GlobeViewport : WebMercatorViewport;
      const vp = new VP({ ...viewState, width: dims.width, height: dims.height });
      const [x, y] = vp.project([callout.centroid.lon, callout.centroid.lat]);
      if (x < -40 || y < -40 || x > dims.width + 40 || y > dims.height + 40) return null;
      return { px: x, py: y, ...placeCallout(x, y, dims.width, dims.height) };
    } catch { return null; }
  }, [callout, viewState, dims, globe]);

  return (
    <div className="sm-wrap" style={{ height }} ref={wrapRef}>
      <DeckGL
        views={globe ? new GlobeView() : new MapView({ repeat: false })}
        viewState={viewState}
        onViewStateChange={(e) => { if (e.interactionState?.isDragging || e.interactionState?.isZooming) userMoved.current = true; setViewState(e.viewState); }}
        controller={globe ? { type: GlobeController } : { dragRotate: false }}
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
            <span className="sm-callout-title">{callout.verb_label}</span>
            {callout.what_changed ? <span className="sm-callout-what">{callout.what_changed}</span> : null}
            <span className="sm-callout-open">Open →</span>
          </button>
          {tour ? <div className="sm-tourticks">{Array.from({ length: tour.total }).map((_, i) => <i key={i} className={i === tour.index ? 'on' : ''} />)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
