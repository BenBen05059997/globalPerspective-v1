import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AXIS_HUE, TIER_R, land, FRAME } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';
import { bearingDeg, beamCrossed, scanGlow, sweepControlState } from '@/features/map/lib/radar.js';
import { ISO3_TO_NUM } from '@/features/map/lib/countryGeo.js';

// iso3 -> country polygon, for H2 country shading (M5a). Built once from the same bundled
// topojson RadarMap already draws coastlines from.
const NUM_TO_FEATURE = {};
for (const f of land.features) NUM_TO_FEATURE[f.id] = f;
function shadeFeature(iso3) { const num = ISO3_TO_NUM[iso3]; return num ? NUM_TO_FEATURE[num] : null; }

const SWEEP_MS = 10000; // one lap ≈ 10s (CONSOLE_WIREFRAME_TECHNIQUE.md §3 / --c-motion-sweep)
const TRAIL_DEG = 40;   // how far behind the leading edge the afterglow/label stays lit
const SCAN_MARK_MS = 3000; // how long the feed's "◉ scanned" mark stays up after a pass

const TIER_W = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };
const CARD_W = 288;
const CARD_MINH = 128;
const GAP = 14;

function placeOf(s) {
  if (s.affected_names?.length) return s.affected_names[0];
  if (s.iso3_affected?.length) return iso3Name(s.iso3_affected[0]);
  return null;
}

// Same anchored-callout placement logic as SituationMap3D's placeCallout (kept local rather than
// touching that M3 file for an M4 task; if a third caller ever needs it, promote to a shared lib).
function placeCallout(px, py, W, H) {
  const M = 8;
  const cand = [
    { left: px + GAP, top: py - CARD_MINH - GAP },
    { left: px - CARD_W - GAP, top: py - CARD_MINH - GAP },
    { left: px + GAP, top: py + GAP },
    { left: px - CARD_W - GAP, top: py + GAP },
  ];
  for (const c of cand) {
    if (c.left >= M && c.top >= M && c.left + CARD_W <= W - M && c.top + CARD_MINH <= H - M) {
      return { left: c.left, top: c.top };
    }
  }
  const left = Math.min(Math.max(px - CARD_W / 2, M), W - CARD_W - M);
  const top = Math.min(Math.max(py - CARD_MINH / 2, M), H - CARD_MINH - M);
  return { left, top };
}

function agoShort(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * RadarMap — the flat console mode (M4): real coastlines (the same bundled countries-110m data
 * and crop as SituationMap), drawn once with d3/SVG, plus a rotating conic-gradient sweep. No
 * WebGL, so it's also the automatic fallback when the globe can't run.
 *
 * Perf: land + markers are drawn once per data/selection change (an ordinary React effect); the
 * sweep itself runs on a single requestAnimationFrame loop that only (a) rewrites the beam
 * element's `background`, and (b) sets opacity/radius attributes directly on the already-drawn
 * marker DOM nodes — no React re-render, no re-drawing land, per frame. The loop is skipped
 * entirely under reduced motion, and stops while the tab is hidden.
 */
export default function RadarMap({
  situations = [], focusId, callout = null, newIds = null, onSelect, onOpenCallout, onScan, height = 560,
  shading = [], storyFocusIso3 = null, onSelectCountry, onHoverCountry, onFocusCountry, onLeaveCountry,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const beamRef = useRef(null);
  const tipRef = useRef(null);
  const markerElsRef = useRef(new Map());   // situation id -> { halo, core }
  const bearingsRef = useRef(new Map());    // situation id -> bearing deg from map centre
  const projectionRef = useRef(null);
  const sweepRef = useRef(355);             // starts just past a "recent pass" look, per the mock
  const onSelectRef = useRef(onSelect);
  const onScanRef = useRef(onScan);
  const onSelectCountryRef = useRef(onSelectCountry);
  const onHoverCountryRef = useRef(onHoverCountry);
  const onFocusCountryRef = useRef(onFocusCountry);
  const onLeaveCountryRef = useRef(onLeaveCountry);
  onSelectRef.current = onSelect;
  onScanRef.current = onScan;
  onSelectCountryRef.current = onSelectCountry;
  onHoverCountryRef.current = onHoverCountry;
  onFocusCountryRef.current = onFocusCountry;
  onLeaveCountryRef.current = onLeaveCountry;

  const reduceMotion = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);
  const [sweepOn, setSweepOn] = useState(!reduceMotion);
  const [dims, setDims] = useState({ width: 1, height });

  const active = useMemo(() => situations.filter((s) => s.state !== 'closed' && s.centroid), [situations]);

  // Draw land + markers once per data/selection change — never per animation frame.
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap) return undefined;

    function draw() {
      const width = wrap.clientWidth || 900;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

      const projection = d3.geoEqualEarth().fitSize([width, height], FRAME);
      projectionRef.current = projection;
      const path = d3.geoPath(projection);
      const root = svg.append('g').attr('class', 'rd-root');
      const cx = width / 2, cy = height / 2;

      root.append('g').selectAll('path').data(land.features).join('path')
        .attr('d', path).attr('fill', 'none').attr('stroke', 'rgba(95, 212, 255, 0.3)').attr('stroke-width', 0.6);

      // Country shading (H2, M5a): a story with no exact place shades its whole country instead
      // of getting a made-up pin — low-alpha wash in the crisis hue, a count badge when >1, a
      // brighter outline for the currently-selected story's country. Freshness (`dim`) is
      // computed once upstream (SituationHome) from the shared topics timestamp.
      const shadeData = (shading || [])
        .map((e) => ({ ...e, feature: shadeFeature(e.iso3) }))
        .filter((e) => e.feature);
      root.append('g').selectAll('path.rd-shade').data(shadeData, (d) => d.iso3).join('path')
        .attr('class', 'rd-shade')
        .attr('d', (d) => path(d.feature))
        .attr('fill', (d) => d.hue)
        .attr('fill-opacity', (d) => (d.dim ? 0.10 : 0.20))
        .attr('stroke', (d) => (d.iso3 === storyFocusIso3 ? '#fff' : d.hue))
        .attr('stroke-opacity', (d) => (d.iso3 === storyFocusIso3 ? 0.9 : 0.5))
        .attr('stroke-width', (d) => (d.iso3 === storyFocusIso3 ? 2 : 0.8))
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', (d) => `${d.top?.title || d.iso3}${d.count > 1 ? `, ${d.count} stories` : ''}`)
        .style('cursor', 'pointer')
        .on('click', (_e, d) => onSelectCountryRef.current && onSelectCountryRef.current(d.iso3))
        .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCountryRef.current && onSelectCountryRef.current(d.iso3); } })
        .on('mouseenter', function onEnter(_e, d) { onHoverCountryRef.current && onHoverCountryRef.current(d.iso3, this); })
        .on('mouseleave', () => onLeaveCountryRef.current && onLeaveCountryRef.current())
        .on('focus', function onFocusIn(_e, d) { onFocusCountryRef.current && onFocusCountryRef.current(d.iso3, this); })
        .on('blur', () => onLeaveCountryRef.current && onLeaveCountryRef.current());

      root.append('g').selectAll('text.rd-shade-count').data(shadeData.filter((d) => d.count > 1), (d) => d.iso3).join('text')
        .attr('class', 'rd-shade-count')
        .attr('x', (d) => path.centroid(d.feature)[0])
        .attr('y', (d) => path.centroid(d.feature)[1])
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#fff').attr('font-size', 10).attr('font-weight', 700)
        .attr('pointer-events', 'none')
        .text((d) => d.count);

      const proj = (s) => projection([s.centroid.lon, s.centroid.lat]) || [-9, -9];
      bearingsRef.current = new Map(active.map((s) => {
        const [x, y] = proj(s);
        return [s.id, bearingDeg(x, y, cx, cy)];
      }));

      const defs = svg.append('defs');
      const f = defs.append('filter').attr('id', 'rd-glow').attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
      f.append('feGaussianBlur').attr('stdDeviation', 3.2).attr('result', 'b');
      const mg = f.append('feMerge'); mg.append('feMergeNode').attr('in', 'b'); mg.append('feMergeNode').attr('in', 'SourceGraphic');

      root.append('g').selectAll('circle').data(active.filter((s) => s.escalating)).join('circle')
        .attr('class', 'sm-ring')
        .attr('cx', (s) => proj(s)[0]).attr('cy', (s) => proj(s)[1])
        .attr('r', (s) => (TIER_R[s.tier] || 5) + 4)
        .attr('fill', 'none').attr('stroke', (s) => AXIS_HUE[s.axis] || '#9aa4b2').attr('stroke-width', 1.5);

      const showTip = (e, s) => {
        const [x, y] = d3.pointer(e, wrap);
        tip.style.opacity = 1; tip.style.left = `${x + 12}px`; tip.style.top = `${y + 12}px`;
        tip.innerHTML = `<b>${s.verb_label}</b><br>${TIER_W[s.tier] || s.tier} · ${agoShort(s.last_change_at)}`;
      };
      const hideTip = () => { tip.style.opacity = 0; };

      markerElsRef.current = new Map();
      const nodes = root.append('g').selectAll('g.rd-marker').data(active, (s) => s.id).join('g')
        .attr('class', 'rd-marker')
        .attr('transform', (s) => { const p = proj(s); return `translate(${p[0]},${p[1]})`; })
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', (s) => {
          const place = placeOf(s);
          return `${s.verb_label}${place ? `, ${place}` : ''}, ${TIER_LABEL[s.tier] || s.tier} severity, ${s.axis}`;
        })
        .style('cursor', 'pointer')
        .style('outline', 'none')
        .on('click', (_e, s) => onSelectRef.current && onSelectRef.current(s.id))
        .on('keydown', (e, s) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRef.current && onSelectRef.current(s.id); }
        })
        .on('mouseenter', showTip).on('mousemove', showTip).on('mouseleave', hideTip)
        .on('focus', showTip).on('blur', hideTip);

      nodes.append('circle').attr('class', 'rd-halo')
        .attr('r', (s) => (TIER_R[s.tier] || 5) + 10)
        .attr('fill', (s) => AXIS_HUE[s.axis] || '#9aa4b2')
        .attr('opacity', 0);

      nodes.append('circle').attr('class', 'rd-core')
        .attr('r', (s) => TIER_R[s.tier] || 5)
        .attr('fill', (s) => AXIS_HUE[s.axis] || '#9aa4b2')
        .attr('stroke', (s) => (s.id === focusId ? '#fff' : 'rgba(255,255,255,0.4)'))
        .attr('stroke-width', (s) => (s.id === focusId ? 2 : 0.75))
        .attr('filter', (s) => (s.tier === 'high' || s.tier === 'elevated' ? 'url(#rd-glow)' : null));

      nodes.each(function assignRefs(s) {
        markerElsRef.current.set(s.id, { halo: this.querySelector('.rd-halo'), core: this.querySelector('.rd-core') });
      });

      // "New since your last visit" — same hollow-ring convention as the globe (design 3f).
      root.append('g').selectAll('circle.new-marker').data(newIds ? active.filter((s) => newIds.has(s.id)) : []).join('circle')
        .attr('class', 'new-marker')
        .attr('cx', (s) => proj(s)[0]).attr('cy', (s) => proj(s)[1])
        .attr('r', (s) => (TIER_R[s.tier] || 5) + 4)
        .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 1).attr('stroke-opacity', 0.8)
        .attr('pointer-events', 'none');

      const labelable = active.filter((s) => s.tier === 'high' || s.tier === 'elevated')
        .sort((a, b) => (TIER_R[b.tier] || 0) - (TIER_R[a.tier] || 0)).slice(0, 6);
      root.append('g').selectAll('text.sm-label').data(labelable).join('text')
        .attr('class', 'sm-label')
        .attr('x', (s) => proj(s)[0] + (TIER_R[s.tier] || 5) + 4)
        .attr('y', (s) => proj(s)[1] + 3)
        .text((s) => s.verb_label).attr('fill', '#dfe6f2').attr('font-size', 11)
        .attr('paint-order', 'stroke').attr('stroke', '#0d1017').attr('stroke-width', 3);

      const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (e) => root.attr('transform', e.transform));
      svg.call(zoom).on('dblclick.zoom', null);

      setDims({ width, height });
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [active, focusId, newIds, height, shading, storyFocusIso3]);

  // The sweep: one rAF loop, paused under reduced motion, while the sweep control is off, or
  // while the tab is hidden. Reads/writes only refs + DOM attributes — no setState per frame.
  useEffect(() => {
    if (reduceMotion || !sweepOn) return undefined;
    let raf;
    let last = null;
    const degPerMs = 360 / SWEEP_MS;
    const tick = (t) => {
      if (last != null && document.visibilityState !== 'hidden') {
        const dt = t - last;
        const prev = sweepRef.current;
        const next = (prev + dt * degPerMs) % 360;
        sweepRef.current = next;

        if (beamRef.current) {
          const from = next + 90 - TRAIL_DEG; // screen-bearing → CSS conic-gradient convention (§3)
          beamRef.current.style.background =
            `conic-gradient(from ${from}deg, transparent 0deg, rgba(95,212,255,0.22) ${TRAIL_DEG * 0.75}deg, ` +
            `var(--c-accent, #5fd4ff) ${TRAIL_DEG}deg, var(--c-accent, #5fd4ff) ${TRAIL_DEG + 0.6}deg, transparent ${TRAIL_DEG + 1.2}deg, transparent 360deg)`;
        }

        for (const [id, angle] of bearingsRef.current) {
          const els = markerElsRef.current.get(id);
          if (!els) continue;
          const glow = scanGlow(next, angle, TRAIL_DEG);
          if (els.halo) els.halo.setAttribute('opacity', String(glow * 0.55));
          if (els.core) els.core.setAttribute('stroke-width', glow > 0.5 ? '1.5' : (id === focusId ? '2' : '0.75'));
          if (beamCrossed(prev, next, angle) && onScanRef.current) onScanRef.current(id);
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, sweepOn, focusId]);

  const beamBackground = useMemo(() => {
    const from = sweepRef.current + 90 - TRAIL_DEG;
    return `conic-gradient(from ${from}deg, transparent 0deg, rgba(95,212,255,0.22) ${TRAIL_DEG * 0.75}deg, ` +
      `var(--c-accent, #5fd4ff) ${TRAIL_DEG}deg, var(--c-accent, #5fd4ff) ${TRAIL_DEG + 0.6}deg, transparent ${TRAIL_DEG + 1.2}deg, transparent 360deg)`;
  }, []); // computed once from the initial sweep angle; the rAF loop takes over from the first frame

  const calloutPlace = useMemo(() => {
    if (!callout?.centroid || !projectionRef.current || !dims.width) return null;
    const p = projectionRef.current([callout.centroid.lon, callout.centroid.lat]);
    if (!p) return null;
    const [x, y] = p;
    return { ...placeCallout(x, y, dims.width, dims.height) };
  }, [callout, dims]);

  const sc = sweepControlState(reduceMotion, sweepOn);
  const hue = (s) => AXIS_HUE[s.axis] || '#9aa4b2';

  return (
    <div className="sm-wrap" style={{ height }} ref={wrapRef}>
      <svg ref={svgRef} role="img" aria-label="Radar view of current situations, real coastlines with a rotating scan" />
      {!reduceMotion ? (
        <div
          ref={beamRef} className="rd-beam"
          style={{
            width: Math.hypot(dims.width, dims.height) * 1.3, height: Math.hypot(dims.width, dims.height) * 1.3,
            left: dims.width / 2, top: dims.height / 2, background: beamBackground,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div ref={tipRef} className="sm-tip" />

      {callout && calloutPlace ? (
        <div className="sm-callout" style={{ left: calloutPlace.left, top: calloutPlace.top, width: CARD_W }}>
          <button className="sm-callout-body" onClick={() => onOpenCallout && onOpenCallout(callout.id)}>
            <span className="sm-callout-top">
              <span className={`sh-badge sh-badge-${callout.tier}`}>{TIER_W[callout.tier] || callout.tier}</span>
              <span className="sm-callout-axis" style={{ color: hue(callout) }}>{callout.axis}</span>
              {callout.escalating ? <span className="sm-callout-esc">▲ escalating</span> : null}
            </span>
            <span className="sm-callout-title">{callout.verb_label}</span>
            {callout.what_changed ? <span className="sm-callout-what">{callout.what_changed}</span> : null}
            <span className="sm-callout-open">Open →</span>
          </button>
        </div>
      ) : null}

      <div className="sm-globe-foot">
        <span className="sm-attrib">Radar · real coastlines</span>
        <button
          className="sm-spin-ctl" aria-pressed={sc.pressed} aria-label={sc.label} title={sc.label}
          disabled={sc.disabled} onClick={() => setSweepOn((v) => !v)}
        >
          {sc.disabled ? '⏸' : (sc.pressed ? '⏸' : '▶')}
        </button>
      </div>
    </div>
  );
}
