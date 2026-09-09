import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView, WebMercatorViewport, FlyToInterpolator } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import * as topojson from 'topojson-client';
import topoData from '../assets/countries-110m.json';

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

// Flat overview (pitch 0). Variant C of the patch design: the globe is the click/tour fly-to
// (S5.5·T slice 3); the overview stays flat so no situation hides behind a horizon.
const INITIAL_VIEW = { longitude: 12, latitude: 20, zoom: 1.15, pitch: 0, bearing: 0, minZoom: 0.6, maxZoom: 8 };

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
  situations = [], focusId, callout = null, tour = null, newIds = null, onSelect, onOpenCallout, height = 560,
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const userMoved = useRef(false);
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
      setViewState((v) => ({ ...v, longitude: lon, latitude: lat, zoom: 3.4, transitionDuration: 1300, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }));
    } else if (userMoved.current) {
      setViewState((v) => ({ ...v, ...INITIAL_VIEW, transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator() }));
    }
  }, [focusCentroid]);

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
      getFillColor: (s) => [...hue(s), TIER_CORE_ALPHA[s.tier] || 205],
      stroked: true, lineWidthUnits: 'pixels',
      getLineColor: (s) => (s.tier === 'high' || s.id === focusId ? [255, 255, 255, 235] : [...hue(s), 0]),
      getLineWidth: (s) => (s.id === focusId ? 2 : (s.tier === 'high' ? 1.25 : 0)),
      onClick: (info) => info.object && onSelect && onSelect(info.object.id),
      updateTriggers: { getRadius: [focusId], getLineColor: [focusId], getLineWidth: [focusId] },
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

  // Order: land, halo, escalating, new-marker, core (core last = top for picking).
  const layers = [baseLayers[0], baseLayers[1], baseLayers[2], baseLayers[4], baseLayers[3]];

  const getTooltip = useCallback(({ object }) => {
    if (!object || !object.verb_label) return null;
    const tierW = TIER_W[object.tier] || object.tier;
    const stW = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing' }[object.state] || object.state;
    return { html: `<b>${object.verb_label}</b><br/>${tierW} · ${stW}`, style: { background: '#0d1017', color: '#dfe6f2', fontSize: '12px', borderRadius: '7px', padding: '6px 9px', border: '1px solid #232c3a' } };
  }, []);

  // Project the callout situation's centroid to screen space and place the card.
  const place = useMemo(() => {
    if (!callout?.centroid || !dims.width) return null;
    try {
      const vp = new WebMercatorViewport({ ...viewState, width: dims.width, height: dims.height });
      const [x, y] = vp.project([callout.centroid.lon, callout.centroid.lat]);
      if (x < -40 || y < -40 || x > dims.width + 40 || y > dims.height + 40) return null;
      return { px: x, py: y, ...placeCallout(x, y, dims.width, dims.height) };
    } catch { return null; }
  }, [callout, viewState, dims]);

  return (
    <div className="sm-wrap" style={{ height }} ref={wrapRef}>
      <DeckGL
        views={new MapView({ repeat: false })}
        viewState={viewState}
        onViewStateChange={(e) => { if (e.interactionState?.isDragging || e.interactionState?.isZooming) userMoved.current = true; setViewState(e.viewState); }}
        controller={{ dragRotate: false }}
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
