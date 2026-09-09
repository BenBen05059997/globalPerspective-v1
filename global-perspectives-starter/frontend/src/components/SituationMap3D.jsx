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

// Flat map (pitch 0) with depth cues in CSS — a static perspective transform distorts pin
// geography for no informational gain; deck.gl keeps the option of real tilt later.
const INITIAL_VIEW = { longitude: 12, latitude: 20, zoom: 1.15, pitch: 0, bearing: 0, minZoom: 0.6, maxZoom: 8 };

/**
 * SituationMap3D — deck.gl dark world. Situations are glow DOTS: hue = axis,
 * luminance + halo = tier (severity), white keyline exclusive to high tier,
 * a slow breathing halo exclusive to escalating (the only motion on the page).
 * Hero situation gets an anchored HTML callout. Hover → tooltip; click → onSelect(id).
 */
export default function SituationMap3D({ situations = [], selectedId, hero = null, onSelect, height = 560 }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const userMoved = useRef(false);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ width: 1, height });
  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);

  // Breathing phase (0..1) drives only the escalating halo. One timer, disabled under reduced-motion.
  const [phase, setPhase] = useState(0.6);
  useEffect(() => {
    if (reduceMotion) return undefined;
    let raf; const t0 = performance.now();
    const tick = (t) => { setPhase(0.5 + 0.5 * Math.sin(((t - t0) / 2000) * Math.PI * 2)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  // Track container size so we can project lon/lat → screen for the hero callout.
  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect; if (r) setDims({ width: r.width, height: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fly to the selected situation; fly back to the overview when cleared.
  useEffect(() => {
    const sel = situations.find((s) => s.id === selectedId && s.centroid);
    if (sel) {
      setViewState((v) => ({ ...v, longitude: sel.centroid.lon, latitude: sel.centroid.lat, zoom: 3.4, transitionDuration: 1300, transitionInterpolator: new FlyToInterpolator({ speed: 1.4 }) }));
    } else if (userMoved.current) {
      setViewState((v) => ({ ...v, ...INITIAL_VIEW, transitionDuration: 1100, transitionInterpolator: new FlyToInterpolator() }));
    }
  }, [selectedId, situations]);

  const active = useMemo(() => situations.filter((s) => s.state !== 'closed' && s.centroid), [situations]);
  const hue = (s) => AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
  const pos = (s) => [s.centroid.lon, s.centroid.lat];

  const layers = [
    new GeoJsonLayer({
      id: 'land', data: landFeatures, stroked: true, filled: true, extruded: false,
      getFillColor: [24, 31, 44], getLineColor: [40, 50, 68], lineWidthMinPixels: 0.5,
    }),
    // Soft outer glow for elevated + high (severity channel #2).
    new ScatterplotLayer({
      id: 'halo', data: active.filter((s) => TIER_HALO[s.tier]),
      getPosition: pos, radiusUnits: 'pixels', stroked: false, pickable: false,
      getRadius: (s) => TIER_HALO[s.tier], getFillColor: (s) => [...hue(s), 34],
      updateTriggers: { getRadius: [], getFillColor: [] },
    }),
    // Breathing halo — escalating only, the single exclusive motion channel.
    new ScatterplotLayer({
      id: 'escalating', data: active.filter((s) => s.escalating),
      getPosition: pos, radiusUnits: 'pixels', stroked: false, pickable: false,
      getRadius: (s) => (TIER_HALO[s.tier] || 14) * (0.8 + 0.5 * phase),
      getFillColor: (s) => [...hue(s), Math.round(24 + 40 * phase)],
      updateTriggers: { getRadius: [phase], getFillColor: [phase] },
    }),
    // Core dots — all tiers. White keyline exclusive to high tier.
    new ScatterplotLayer({
      id: 'core', data: active, pickable: true, radiusUnits: 'pixels',
      getPosition: pos,
      getRadius: (s) => (TIER_R[s.tier] || 3.4) * (s.id === selectedId ? 1.25 : 1),
      getFillColor: (s) => [...hue(s), TIER_CORE_ALPHA[s.tier] || 205],
      stroked: true, lineWidthUnits: 'pixels',
      getLineColor: (s) => (s.tier === 'high' || s.id === selectedId ? [255, 255, 255, 235] : [...hue(s), 0]),
      getLineWidth: (s) => (s.id === selectedId ? 2 : (s.tier === 'high' ? 1.25 : 0)),
      onClick: (info) => info.object && onSelect && onSelect(info.object.id),
      updateTriggers: {
        getRadius: [selectedId], getLineColor: [selectedId], getLineWidth: [selectedId],
      },
    }),
  ];

  const getTooltip = useCallback(({ object }) => {
    if (!object || !object.verb_label) return null;
    const tierW = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' }[object.tier] || object.tier;
    const stW = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing' }[object.state] || object.state;
    return { html: `<b>${object.verb_label}</b><br/>${tierW} · ${stW}`, style: { background: '#0d1017', color: '#dfe6f2', fontSize: '12px', borderRadius: '7px', padding: '6px 9px', border: '1px solid #232c3a' } };
  }, []);

  // Project the hero's centroid to screen space for the anchored callout.
  const heroXY = useMemo(() => {
    if (!hero?.centroid || !dims.width) return null;
    try {
      const vp = new WebMercatorViewport({ ...viewState, width: dims.width, height: dims.height });
      const [x, y] = vp.project([hero.centroid.lon, hero.centroid.lat]);
      if (x < 0 || y < 0 || x > dims.width || y > dims.height) return null;
      return { x, y };
    } catch { return null; }
  }, [hero, viewState, dims]);

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
      {hero && heroXY && hero.id !== selectedId ? (
        <button
          className="sm-callout"
          style={{ left: Math.min(Math.max(heroXY.x + 14, 12), dims.width - 300), top: Math.min(Math.max(heroXY.y - 20, 12), dims.height - 130) }}
          onClick={() => onSelect && onSelect(hero.id)}
        >
          <span className="sm-callout-top">
            <span className={`sh-badge sh-badge-${hero.tier}`}>{({ high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' })[hero.tier] || hero.tier}</span>
            <span className="sm-callout-axis" style={{ color: `rgb(${hue(hero).join(',')})` }}>{hero.axis}</span>
            {hero.escalating ? <span className="sm-callout-esc">▲ escalating</span> : null}
          </span>
          <span className="sm-callout-title">{hero.verb_label}</span>
          {hero.what_changed ? <span className="sm-callout-what">{hero.what_changed}</span> : null}
          <span className="sm-callout-open">Open →</span>
        </button>
      ) : null}
    </div>
  );
}
