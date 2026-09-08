import { useState, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView } from '@deck.gl/core';
import { GeoJsonLayer, ColumnLayer, ScatterplotLayer } from '@deck.gl/layers';
import * as topojson from 'topojson-client';
import topoData from '../assets/countries-110m.json';

// Hue = kind of crisis, as RGB (DATA_STRATEGY §5 / plan WS4).
export const AXIS_RGB = {
  conflict: [228, 87, 46],
  political: [142, 108, 239],
  economic: [43, 179, 214],
  humanitarian: [242, 177, 52],
};
const AXIS_RGB_FALLBACK = [154, 164, 178];
// Column height by tier (severity) — the point of 2.5D: height reads instantly.
const TIER_H = { low: 1.4, moderate: 3, elevated: 5, high: 9 };
const ELEVATION_SCALE = 420000; // metres per height unit (tuned so severity reads at world view)
const COLUMN_RADIUS = 95000;  // metres

const landFeatures = topojson.feature(topoData, topoData.objects.countries).features;

const INITIAL_VIEW = { longitude: 12, latitude: 18, zoom: 1.2, pitch: 54, bearing: 0, minZoom: 0.6, maxZoom: 8 };

/**
 * SituationMap3D — deck.gl "world at night" in 2.5D. Situations are extruded COLUMNS: hue = axis,
 * height = tier (severity), escalating = a bright beacon halo. Pre-resolved centroids from the bundle.
 * Hover → tooltip; click → onSelect(id). Fly-to / tour / scrubber land in S5·T2.
 */
export default function SituationMap3D({ situations = [], selectedId, onSelect, height = 560 }) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  const active = useMemo(() => situations.filter((s) => s.state !== 'closed' && s.centroid), [situations]);
  const closed = useMemo(() => situations.filter((s) => s.state === 'closed' && s.centroid), [situations]);
  // Spread arcs need the affected countries' own centroids (not yet resolved) — land in S5·T2.
  const hue = (s) => AXIS_RGB[s.axis] || AXIS_RGB_FALLBACK;
  const pos = (s) => [s.centroid.lon, s.centroid.lat];

  const layers = [
    new GeoJsonLayer({
      id: 'land', data: landFeatures, stroked: true, filled: true, extruded: false,
      getFillColor: [26, 34, 48], getLineColor: [43, 53, 71], lineWidthMinPixels: 0.5,
    }),
    new ScatterplotLayer({
      id: 'escalating-halo', data: active.filter((s) => s.escalating),
      getPosition: pos, getRadius: COLUMN_RADIUS * 1.9, radiusUnits: 'meters',
      getFillColor: (s) => [...hue(s), 40], stroked: false, pickable: false,
    }),
    new ColumnLayer({
      id: 'situations', data: active, diskResolution: 24, radius: COLUMN_RADIUS,
      extruded: true, pickable: true, elevationScale: ELEVATION_SCALE,
      getPosition: pos,
      getElevation: (s) => (TIER_H[s.tier] || 1) * (s.escalating ? 1.35 : 1),
      getFillColor: (s) => [...hue(s), s.id === selectedId ? 255 : 220],
      getLineColor: [255, 255, 255], stroked: true, getLineWidth: (s) => (s.id === selectedId ? 3 : 0),
      lineWidthUnits: 'pixels',
      onClick: (info) => info.object && onSelect && onSelect(info.object.id),
      updateTriggers: { getFillColor: [selectedId], getLineWidth: [selectedId] },
    }),
    new ColumnLayer({
      id: 'closed', data: closed, diskResolution: 16, radius: COLUMN_RADIUS * 0.5,
      extruded: false, getPosition: pos, getFillColor: [75, 85, 99, 120], pickable: false,
    }),
  ];

  const getTooltip = useCallback(({ object }) => {
    if (!object || !object.verb_label) return null;
    const tierW = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' }[object.tier] || object.tier;
    const stW = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing' }[object.state] || object.state;
    return { html: `<b>${object.verb_label}</b><br/>${tierW} · ${stW}`, style: { background: '#0d1017', color: '#dfe6f2', fontSize: '12px', borderRadius: '7px', padding: '6px 9px', border: '1px solid #232c3a' } };
  }, []);

  return (
    <div className="sm-wrap" style={{ height }}>
      <DeckGL
        views={new MapView({ repeat: false })}
        viewState={viewState}
        onViewStateChange={(e) => setViewState(e.viewState)}
        controller={{ dragRotate: true }}
        layers={layers}
        getTooltip={getTooltip}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      />
    </div>
  );
}
