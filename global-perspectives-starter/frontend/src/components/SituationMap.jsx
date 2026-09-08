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
// Marker radius by tier (severity) — widened so severity reads (interim until S5's 2.5D columns).
const TIER_R = { low: 4, moderate: 6.5, elevated: 9, high: 13 };
const STATE_WORD = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing', closed: 'Ended' };
const TIER_WORD = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };

const land = topojson.feature(topoData, topoData.objects.countries);
// Frame roughly ±60° latitude — drop Antarctica, which is ~15% of canvas for zero information.
const FRAME = { type: 'Polygon', coordinates: [[[-180, -58], [180, -58], [180, 72], [-180, 72], [-180, -58]]] };

function agoShort(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * SituationMap — dark "world at night" map. Situations are light sources: hue = axis, radius = tier,
 * pulsing ring = escalating. Pre-resolved centroids from the bundle (no name→ISO matching). Cropped
 * to ~±60°, hover tooltip, zoom/pan. Top labels only; click a marker → onSelect(id).
 */
export default function SituationMap({ situations = [], selectedId, onSelect, height = 520 }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const svg = d3.select(ref.current);
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap) return;

    function draw() {
      const width = wrap.clientWidth || 900;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

      const projection = d3.geoEqualEarth().fitSize([width, height], FRAME);
      const path = d3.geoPath(projection);
      const root = svg.append('g').attr('class', 'sm-root');

      root.append('g').selectAll('path').data(land.features).join('path')
        .attr('d', path).attr('fill', '#1a2230').attr('stroke', '#2b3547').attr('stroke-width', 0.5);

      const active = situations.filter((s) => s.state !== 'closed' && s.centroid);
      const closed = situations.filter((s) => s.state === 'closed' && s.centroid);
      const proj = (s) => projection([s.centroid.lon, s.centroid.lat]) || [-9, -9];

      const defs = svg.append('defs');
      const f = defs.append('filter').attr('id', 'sm-glow').attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
      f.append('feGaussianBlur').attr('stdDeviation', 3.2).attr('result', 'b');
      const mg = f.append('feMerge'); mg.append('feMergeNode').attr('in', 'b'); mg.append('feMergeNode').attr('in', 'SourceGraphic');

      root.append('g').selectAll('circle').data(closed).join('circle')
        .attr('cx', (s) => proj(s)[0]).attr('cy', (s) => proj(s)[1])
        .attr('r', 4).attr('fill', 'none').attr('stroke', '#4b5563').attr('stroke-width', 1).attr('opacity', 0.5);

      root.append('g').selectAll('circle.ring').data(active.filter((s) => s.escalating)).join('circle')
        .attr('class', 'sm-ring')
        .attr('cx', (s) => proj(s)[0]).attr('cy', (s) => proj(s)[1])
        .attr('r', (s) => (TIER_R[s.tier] || 5) + 4)
        .attr('fill', 'none').attr('stroke', (s) => AXIS_HUE[s.axis] || AXIS_FALLBACK).attr('stroke-width', 1.5);

      const showTip = (e, s) => {
        const [x, y] = d3.pointer(e, wrap);
        tip.style.opacity = 1; tip.style.left = `${x + 12}px`; tip.style.top = `${y + 12}px`;
        tip.innerHTML = `<b>${s.verb_label}</b><br>${TIER_WORD[s.tier] || s.tier} · ${STATE_WORD[s.state] || s.state} · ${agoShort(s.last_change_at)}`;
      };
      const hideTip = () => { tip.style.opacity = 0; };

      const nodes = root.append('g').selectAll('g.marker').data(active, (s) => s.id).join('g')
        .attr('class', 'sm-marker')
        .attr('transform', (s) => { const p = proj(s); return `translate(${p[0]},${p[1]})`; })
        .style('cursor', 'pointer')
        .on('click', (_e, s) => onSelect && onSelect(s.id))
        .on('mouseenter', showTip).on('mousemove', showTip).on('mouseleave', hideTip);

      nodes.append('circle')
        .attr('r', (s) => TIER_R[s.tier] || 5)
        .attr('fill', (s) => AXIS_HUE[s.axis] || AXIS_FALLBACK)
        .attr('stroke', (s) => (s.id === selectedId ? '#fff' : 'rgba(255,255,255,0.4)'))
        .attr('stroke-width', (s) => (s.id === selectedId ? 2 : 0.75))
        .attr('filter', (s) => (s.tier === 'high' || s.tier === 'elevated' ? 'url(#sm-glow)' : null));

      const labelable = active
        .filter((s) => s.tier === 'high' || s.tier === 'elevated')
        .sort((a, b) => (TIER_R[b.tier] || 0) - (TIER_R[a.tier] || 0)).slice(0, 6);
      root.append('g').selectAll('text.label').data(labelable).join('text')
        .attr('class', 'sm-label')
        .attr('x', (s) => proj(s)[0] + (TIER_R[s.tier] || 5) + 4)
        .attr('y', (s) => proj(s)[1] + 3)
        .text((s) => s.verb_label).attr('fill', '#dfe6f2').attr('font-size', 11)
        .attr('paint-order', 'stroke').attr('stroke', '#0d1017').attr('stroke-width', 3);

      // zoom / pan
      const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (e) => root.attr('transform', e.transform));
      svg.call(zoom).on('dblclick.zoom', null);
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [situations, selectedId, onSelect, height]);

  return (
    <div ref={wrapRef} className="sm-wrap">
      <svg ref={ref} role="img" aria-label="World map of current situations" />
      <div ref={tipRef} className="sm-tip" />
    </div>
  );
}
