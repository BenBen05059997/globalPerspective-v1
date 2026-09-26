import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { land, FRAME } from '@/features/map/lib/landGeometry.js';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';
import { bearingDeg, beamCrossed, scanGlow, sweepControlState } from '@/features/map/lib/radar.js';
import { ISO3_TO_NUM } from '@/features/map/lib/countryGeo.js';
import { pulseSet } from '@/features/map/lib/pulse.js';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';
import {
  tierSize, markerKind, kindLabel, situationFreshness, freshnessLook, freshnessClass, statusGlyph, markerHex,
} from '@/features/map/lib/legend.js';

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
// topMargin keeps the card clear of the top-right control cluster (Walk-through / Globe·Radar /
// Key) — same convention as SituationMap3D's placeCallout (M6).
const CALLOUT_TOP_MARGIN = 58;
function placeCallout(px, py, W, H, topMargin = 8) {
  const M = 8;
  const cand = [
    { left: px + GAP, top: py - CARD_MINH - GAP },
    { left: px - CARD_W - GAP, top: py - CARD_MINH - GAP },
    { left: px + GAP, top: py + GAP },
    { left: px - CARD_W - GAP, top: py + GAP },
  ];
  for (const c of cand) {
    if (c.left >= M && c.top >= topMargin && c.left + CARD_W <= W - M && c.top + CARD_MINH <= H - M) {
      return { left: c.left, top: c.top };
    }
  }
  const left = Math.min(Math.max(px - CARD_W / 2, M), W - CARD_W - M);
  const top = Math.min(Math.max(py - CARD_MINH / 2, topMargin), H - CARD_MINH - M);
  return { left, top };
}

// F2.21: `verb_label` is server data rendered via `.innerHTML` below (copied from the removed
// SituationMap.jsx flat component) — escape it so a label containing `<`/`&`/etc. can never be
// interpreted as markup in the tooltip.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const hue = (s) => AXIS_HUE[s.axis] || '#9aa4b2';
const freshOf = (s) => situationFreshness(s, Date.now());

// ◆ — a square rotated 45°, `k` = half its diagonal.
function diamondPath(k) {
  return `M0,${-k}L${k},0L0,${k}L${-k},0Z`;
}
// HUD target brackets (legend §1 "selected"): four 6px L-corners around a `b`-radius box.
function bracketsPath(b) {
  const l = 6;
  return `M${-b},${-b + l}V${-b}H${-b + l}M${b - l},${-b}H${b}V${-b + l}`
    + `M${b},${b - l}V${b}H${b - l}M${-b + l},${b}H${-b}V${b - l}`;
}

function markerAriaLabel(s, fresh) {
  const place = placeOf(s);
  const level = gdacsLevelBadge(s);
  const glyph = statusGlyph(s);
  return [
    s.verb_label, place, kindLabel(markerKind(s)), level,
    `${TIER_LABEL[s.tier] || s.tier} severity`, s.axis,
    glyph ? glyph.label : null, fresh === 'older' ? 'older' : null,
  ].filter(Boolean).join(', ');
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
  const zoomRef = useRef(null);             // the d3-zoom behavior, rebound on every redraw
  const zoomTransformRef = useRef(null);    // F2.2: last user zoom/pan, reapplied after each redraw
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

  // Brightness = freshness: 30d+ situations are hidden from the map (SituationHome counts them).
  const active = useMemo(
    () => situations.filter((s) => s.state !== 'closed' && s.centroid && situationFreshness(s) !== 'hidden'),
    [situations],
  );
  // `newIds` (since-your-last-visit) is shown in the feed only — the map's badges are the
  // approved ▲●◆▼ set, so no extra undocumented ring is drawn here any more.
  void newIds;

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

      // A selected story (country wash) gets the HUD brackets too, at its country's centre.
      const focusShade = shadeData.find((d) => d.iso3 === storyFocusIso3);
      if (focusShade) {
        const [bx, by] = path.centroid(focusShade.feature);
        if (Number.isFinite(bx) && Number.isFinite(by)) {
          root.append('path').attr('class', 'rd-brackets').attr('transform', `translate(${bx},${by})`)
            .attr('d', bracketsPath(14)).attr('fill', 'none').attr('stroke', '#eef5f9').attr('stroke-width', 2)
            .attr('pointer-events', 'none');
        }
      }

      const proj = (s) => projection([s.centroid.lon, s.centroid.lat]) || [-9, -9];
      bearingsRef.current = new Map(active.map((s) => {
        const [x, y] = proj(s);
        return [s.id, bearingDeg(x, y, cx, cy)];
      }));

      const defs = svg.append('defs');
      // Brightness = freshness (legend §4): only LIVE (<24h) markers get this glow.
      const f = defs.append('filter').attr('id', 'rd-glow').attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
      f.append('feGaussianBlur').attr('stdDeviation', 3.2).attr('result', 'b');
      const mg = f.append('feMerge'); mg.append('feMergeNode').attr('in', 'b'); mg.append('feMergeNode').attr('in', 'SourceGraphic');
      // Shape = kind (legend §1): a news situation sits at an APPROXIMATE place, drawn as a soft,
      // feathered halo around a small dot (MacEachren: fuzzy reads as uncertain) — one radial
      // gradient per crisis hue (+ its faded "older" twin).
      const softId = (hex) => `rd-soft-${hex.replace('#', '')}`;
      const softHexes = new Set(active.map((s) => markerHex(hue(s), freshOf(s))));
      for (const hx of softHexes) {
        const g = defs.append('radialGradient').attr('id', softId(hx));
        g.append('stop').attr('offset', '45%').attr('stop-color', hx).attr('stop-opacity', 0.5);
        g.append('stop').attr('offset', '100%').attr('stop-color', hx).attr('stop-opacity', 0);
      }

      // Motion budget (M6): only NEW/▲ situations from the last 24h pulse, capped at 8, highest
      // tier first (lib/pulse.js) — not every escalating situation regardless of age.
      const pulseIds = pulseSet(active, Date.now(), 8);
      root.append('g').selectAll('circle').data(active.filter((s) => pulseIds.has(s.id))).join('circle')
        .attr('class', 'sm-ring')
        .attr('cx', (s) => proj(s)[0]).attr('cy', (s) => proj(s)[1])
        .attr('r', (s) => tierSize(s.tier).r + 6)
        .attr('fill', 'none').attr('stroke', (s) => hue(s)).attr('stroke-width', 1.5);

      const showTip = (e, s) => {
        const [x, y] = d3.pointer(e, wrap);
        tip.style.opacity = 1; tip.style.left = `${x + 12}px`; tip.style.top = `${y + 12}px`;
        const level = gdacsLevelBadge(s);
        const glyph = statusGlyph(s);
        tip.innerHTML = `<b>${escapeHtml(s.verb_label)}</b><br>${escapeHtml(TIER_W[s.tier] || s.tier)}`
          + `${level ? ` · ${escapeHtml(level)}` : ''}${glyph ? ` · ${escapeHtml(`${glyph.glyph} ${glyph.label}`)}` : ''}`
          + ` · ${escapeHtml(agoShort(s.last_change_at))}`;
      };
      const hideTip = () => { tip.style.opacity = 0; };

      markerElsRef.current = new Map();
      const nodes = root.append('g').selectAll('g.rd-marker').data(active, (s) => s.id).join('g')
        .attr('class', (s) => `rd-marker ${freshnessClass(freshOf(s))}${s.id === focusId ? ' rd-selected' : ''}`)
        .attr('transform', (s) => { const p = proj(s); return `translate(${p[0]},${p[1]})`; })
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', (s) => markerAriaLabel(s, freshOf(s)))
        .style('cursor', 'pointer')
        .on('click', (_e, s) => onSelectRef.current && onSelectRef.current(s.id))
        .on('keydown', (e, s) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectRef.current && onSelectRef.current(s.id); }
        })
        .on('mouseenter', showTip).on('mousemove', showTip).on('mouseleave', hideTip)
        .on('focus', showTip).on('blur', hideTip);

      // The radar's one-shot scan flare (legend §6): opacity is driven per frame by the sweep loop.
      nodes.append('circle').attr('class', 'rd-scan')
        .attr('r', (s) => (tierSize(s.tier).ringR || tierSize(s.tier).r) + 8)
        .attr('fill', (s) => hue(s))
        .attr('opacity', 0);

      nodes.filter((s) => markerKind(s) === 'situation').append('circle').attr('class', 'rd-soft')
        .attr('r', (s) => tierSize(s.tier).r + 11)
        .attr('fill', (s) => `url(#${softId(markerHex(hue(s), freshOf(s)))})`)
        .attr('pointer-events', 'none');

      // Size + double ring = HIGH only (legend §2).
      nodes.filter((s) => tierSize(s.tier).doubleRing).append('circle').attr('class', 'rd-ring')
        .attr('r', (s) => tierSize(s.tier).ringR)
        .attr('fill', 'none').attr('stroke', (s) => markerHex(hue(s), freshOf(s))).attr('stroke-width', 1.5);

      nodes.each(function drawCore(s) {
        const g = d3.select(this);
        const { r } = tierSize(s.tier);
        const fill = markerHex(hue(s), freshOf(s));
        const look = freshnessLook(freshOf(s));
        const core = markerKind(s) === 'alert'
          // ◆ official alert: a diamond (MIL-STD alert frame), exact place from the feed.
          ? g.append('path').attr('d', diamondPath(r * 1.2)).attr('stroke', '#04070c').attr('stroke-width', 1.5)
          : g.append('circle').attr('r', Math.max(3, r * 0.6)).attr('stroke', '#04070c').attr('stroke-width', 1);
        core.attr('class', 'rd-core').attr('fill', fill)
          .attr('opacity', look.desaturate ? 0.85 : 1)
          .attr('filter', look.glow ? 'url(#rd-glow)' : null);
        const glyph = statusGlyph(s);
        if (glyph) {
          const off = (tierSize(s.tier).ringR || r) + 3;
          g.append('text').attr('class', 'rd-badge').attr('x', off).attr('y', -off + 3)
            .attr('font-size', 10).attr('fill', '#eef5f9').attr('pointer-events', 'none')
            .attr('paint-order', 'stroke').attr('stroke', '#04070c').attr('stroke-width', 2.5)
            .text(glyph.glyph);
        }
        if (s.id === focusId) {
          // HUD brackets = selected (legend §1 / L4), replacing the old white glow ring.
          const b = (tierSize(s.tier).ringR || r) + 7;
          g.append('path').attr('class', 'rd-brackets').attr('d', bracketsPath(b))
            .attr('fill', 'none').attr('stroke', '#eef5f9').attr('stroke-width', 2).attr('pointer-events', 'none');
        }
      });

      nodes.each(function assignRefs(s) {
        markerElsRef.current.set(s.id, { scan: this.querySelector('.rd-scan') });
      });

      const labelable = active.filter((s) => s.tier === 'high' || s.tier === 'elevated')
        .sort((a, b) => (tierSize(b.tier).ringR || tierSize(b.tier).r) - (tierSize(a.tier).ringR || tierSize(a.tier).r)).slice(0, 6);
      root.append('g').selectAll('text.sm-label').data(labelable).join('text')
        .attr('class', 'sm-label')
        .attr('x', (s) => proj(s)[0] + (tierSize(s.tier).ringR || tierSize(s.tier).r) + 14)
        .attr('y', (s) => proj(s)[1] + 4)
        .text((s) => s.verb_label).attr('fill', '#dfe6f2').attr('font-size', 11)
        .attr('paint-order', 'stroke').attr('stroke', '#0d1017').attr('stroke-width', 3);

      // F2.2: the SVG is fully cleared and rebuilt every redraw (5-min poll, selection, resize),
      // which used to reset the zoom/pan to identity each time — reapply the visitor's last
      // transform (if any) instead of snapping back to the default view.
      const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (e) => {
        zoomTransformRef.current = e.transform;
        root.attr('transform', e.transform);
      });
      zoomRef.current = zoom;
      svg.call(zoom).on('dblclick.zoom', null);
      if (zoomTransformRef.current) svg.call(zoom.transform, zoomTransformRef.current);

      setDims({ width, height });
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [active, focusId, height, shading, storyFocusIso3]);

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
          if (els.scan) els.scan.setAttribute('opacity', String(glow * 0.5));
          if (beamCrossed(prev, next, angle) && onScanRef.current) onScanRef.current(id);
        }
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, sweepOn]);

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
    return { ...placeCallout(x, y, dims.width, dims.height, CALLOUT_TOP_MARGIN) };
  }, [callout, dims]);

  const sc = sweepControlState(reduceMotion, sweepOn);

  return (
    <div className="sm-wrap" style={{ height }} ref={wrapRef}>
      {/* F2.10: role="group" (not "img") — the svg contains focusable role=button countries and
          situation markers, which an img role would hide from assistive tech as decorative
          content. The label still describes the whole view. */}
      <svg ref={svgRef} role="group" aria-label="Radar view of current situations, real coastlines with a rotating scan" />
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
            {gdacsLevelBadge(callout) ? <span className="sh-gdacs-badge">{gdacsLevelBadge(callout)}</span> : null}
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
