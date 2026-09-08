import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import topoData from '../assets/countries-110m.json';

// Hue = kind of crisis (DATA_STRATEGY §5 / plan WS4). Colour-blind-checked; no red/green pair.
export const AXIS_HUE = {
  conflict: '#E4572E',      // red-orange
  political: '#8E6CEF',     // violet
  economic: '#2BB3D6',      // cyan
  humanitarian: '#F2B134',  // amber
};
const AXIS_FALLBACK = '#9aa4b2';
// Marker radius by tier (severity). low = flat dot … high = large.
const TIER_R = { low: 3, moderate: 5, elevated: 7, high: 10 };

const land = topojson.feature(topoData, topoData.objects.countries);

/**
 * SituationMap — dark "world at night" map. Situations are light sources:
 * hue = axis, radius = tier, pulsing ring = escalating. Pre-resolved centroids from the bundle,
 * so no name→ISO matching here. Top labels only; click a marker → onSelect(id).
 */
export default function SituationMap({ situations = [], selectedId, onSelect, height = 520 }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(ref.current);
    const wrap = wrapRef.current;
    if (!wrap) return;

    function draw() {
      const width = wrap.clientWidth || 900;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

      const projection = d3.geoEqualEarth().fitSize([width, height], land);
      const path = d3.geoPath(projection);

      // base land — matte dark relief
      svg.append('g').selectAll('path').data(land.features).join('path')
        .attr('d', path).attr('fill', '#1a2230').attr('stroke', '#2b3547').attr('stroke-width', 0.5);

      const active = situations.filter((s) => s.state !== 'closed' && s.centroid);
      const closed = situations.filter((s) => s.state === 'closed' && s.centroid);
      const proj = (s) => projection([s.centroid.lon, s.centroid.lat]);
      // (spread-arc rendering lands in S5 with the WebGL map)

      // closed = grey outline (fading), no ring
      svg.append('g').selectAll('circle').data(closed).join('circle')
        .attr('cx', (s) => (proj(s) || [-9, -9])[0]).attr('cy', (s) => (proj(s) || [-9, -9])[1])
        .attr('r', 4).attr('fill', 'none').attr('stroke', '#4b5563').attr('stroke-width', 1).attr('opacity', 0.5);

      // escalating ring (static ripple — CSS animates it)
      const g = svg.append('g');
      g.selectAll('circle.ring').data(active.filter((s) => s.escalating)).join('circle')
        .attr('class', 'sm-ring')
        .attr('cx', (s) => (proj(s) || [-9, -9])[0]).attr('cy', (s) => (proj(s) || [-9, -9])[1])
        .attr('r', (s) => (TIER_R[s.tier] || 4) + 4)
        .attr('fill', 'none').attr('stroke', (s) => AXIS_HUE[s.axis] || AXIS_FALLBACK).attr('stroke-width', 1.5);

      // markers
      const nodes = g.selectAll('g.marker').data(active, (s) => s.id).join('g')
        .attr('class', 'sm-marker')
        .attr('transform', (s) => { const p = proj(s) || [-9, -9]; return `translate(${p[0]},${p[1]})`; })
        .style('cursor', 'pointer')
        .on('click', (_e, s) => onSelect && onSelect(s.id));

      nodes.append('circle')
        .attr('r', (s) => TIER_R[s.tier] || 4)
        .attr('fill', (s) => AXIS_HUE[s.axis] || AXIS_FALLBACK)
        .attr('stroke', (s) => (s.id === selectedId ? '#fff' : 'rgba(255,255,255,0.35)'))
        .attr('stroke-width', (s) => (s.id === selectedId ? 2 : 0.75))
        .attr('filter', (s) => (s.tier === 'high' ? 'url(#sm-glow)' : null));

      // labels for the top few by tier (high/elevated), capped
      const labelable = active
        .filter((s) => s.tier === 'high' || s.tier === 'elevated')
        .sort((a, b) => (TIER_R[b.tier] || 0) - (TIER_R[a.tier] || 0)).slice(0, 6);
      g.selectAll('text.label').data(labelable).join('text')
        .attr('class', 'sm-label')
        .attr('x', (s) => (proj(s) || [-9, -9])[0] + (TIER_R[s.tier] || 4) + 4)
        .attr('y', (s) => (proj(s) || [-9, -9])[1] + 3)
        .text((s) => s.verb_label).attr('fill', '#dfe6f2').attr('font-size', 11)
        .attr('paint-order', 'stroke').attr('stroke', '#0d1017').attr('stroke-width', 3);

      // glow filter
      const defs = svg.append('defs');
      const f = defs.append('filter').attr('id', 'sm-glow').attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
      f.append('feGaussianBlur').attr('stdDeviation', 3.2).attr('result', 'b');
      const m = f.append('feMerge'); m.append('feMergeNode').attr('in', 'b'); m.append('feMergeNode').attr('in', 'SourceGraphic');
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [situations, selectedId, onSelect, height]);

  return (
    <div ref={wrapRef} className="sm-wrap">
      <svg ref={ref} role="img" aria-label="World map of current situations" />
    </div>
  );
}
