// SpiderWorld.jsx — World Overview tier for the /spider-demo prototype.
// Top altitude: a global TIMELINE. x = date, y = region lane. Each country's
// situation is a bubble at its PEAK-activity date, sized by thread count, with a
// span bar showing how long the situation ran (earliest → latest). Lines connect
// countries whose graphs share key actors. Click a bubble to drill into its
// causal web. Throwaway prototype; deletable with SpiderDemo.jsx.

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchWorldOverview } from '../services/restProxy';

const REGION_LANES = [
  { key: 'me', label: 'Middle East' },
  { key: 'eu', label: 'Europe' },
  { key: 'as', label: 'Asia' },
  { key: 'am', label: 'Americas' },
  { key: 'af', label: 'Africa' },
  { key: 'gl', label: 'Global' },
];

const COUNTRY_REGION = {
  'Iran': 'me', 'Israel': 'me', 'Saudi Arabia': 'me', 'Qatar': 'me', 'Lebanon': 'me',
  'Turkey': 'me', 'Syria': 'me', 'Yemen': 'me', 'United Arab Emirates': 'me',
  'United States': 'am', 'Venezuela': 'am', 'Canada': 'am', 'Mexico': 'am', 'Brazil': 'am', 'Argentina': 'am',
  'China': 'as', 'Japan': 'as', 'South Korea': 'as', 'North Korea': 'as', 'India': 'as', 'Pakistan': 'as', 'Taiwan': 'as',
  'France': 'eu', 'Germany': 'eu', 'Ukraine': 'eu', 'Russia': 'eu', 'United Kingdom': 'eu', 'Poland': 'eu', 'Italy': 'eu',
  'Democratic Republic of the Congo': 'af', 'South Africa': 'af', 'Nigeria': 'af', 'Sudan': 'af', 'Ethiopia': 'af',
};
function regionOf(country) { return COUNTRY_REGION[country] || 'gl'; }

const SHORT_NAME = { 'Democratic Republic of the Congo': 'DR Congo' };
function shortName(c) { return SHORT_NAME[c] || c; }

const CAT_COLOR = {
  conflict: '#c0492f', military: '#c0492f', war: '#c0492f',
  politics: '#8a3526', diplomacy: '#3a6ea5',
  energy: '#3f8f6b', economy: '#c9912f', business: '#c9912f',
  technology: '#7d5ba6', society: '#7d5ba6',
};
function catColor(c) {
  if (!c) return '#7d5ba6';
  const l = c.toLowerCase();
  for (const k of Object.keys(CAT_COLOR)) if (l.includes(k)) return CAT_COLOR[k];
  return '#7d5ba6';
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_MS = 86400000;
const DAY_W = 44;
// Lane height is computed to fit every populated region into the visible area
// (no vertical scroll) — clamped so bubbles + labels stay legible.
const LANE_H_MIN = 84;
const LANE_H_MAX = 132;
const MARGIN = { top: 38, left: 150, right: 48, bottom: 16 };
function parseDate(s) {
  const m = typeof s === 'string' && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
function fmtMs(ms) { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; }
const rForThreads = (t) => 14 + Math.sqrt(Math.max(1, t)) * 3.4;

export default function WorldOverview({ onDrill }) {
  const [situations, setSituations] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);
  const scrollRef = useRef(null);
  const [availH, setAvailH] = useState(0); // measured height of the scroll area

  // Measure the visible area so lanes can be sized to fit it (no vertical scroll).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect?.height;
      if (h) setAvailH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWorldOverview()
      .then(r => {
        if (cancelled) return;
        const dd = r?.data;
        setSituations(Array.isArray(dd) ? dd : (dd?.situations || []));
        setLinks(Array.isArray(dd?.links) ? dd.links : []);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const layout = useMemo(() => {
    if (!situations || !situations.length) return null;
    // A bubble is placed at its PEAK day — that is its only honest x. If a
    // situation has no real peak date we drop it rather than invent a position
    // (no fallback). earliest/latest are optional: they only draw the span bar.
    const withMs = situations
      .map(s => ({
        ...s,
        _peakMs: parseDate(s.peak),
        _startMs: parseDate(s.earliest),
        _endMs: parseDate(s.latest),
      }))
      .filter(s => s._peakMs != null);
    if (!withMs.length) return null;
    const all = [];
    withMs.forEach(s => [s._peakMs, s._startMs, s._endMs].forEach(m => { if (m != null) all.push(m); }));
    const minMs = Math.min(...all);
    const maxMs = Math.max(...all);
    const totalDays = Math.max(1, Math.round((maxMs - minMs) / DAY_MS) + 1);
    // Strict: a null date has no x. Callers must guard — never snap to an edge.
    const xForMs = (m) => m == null ? null : MARGIN.left + Math.round((m - minMs) / DAY_MS) * DAY_W + DAY_W / 2;

    const byRegion = {};
    withMs.forEach(s => { const rk = regionOf(s.country); (byRegion[rk] = byRegion[rk] || []).push(s); });

    // Only render lanes that actually contain a country, then size each lane to
    // fit the measured height so every region is visible without vertical scroll.
    const lanes = REGION_LANES.filter(l => (byRegion[l.key] || []).length > 0);
    const nLanes = Math.max(1, lanes.length);
    const usableH = (availH > 0 ? availH : 520) - MARGIN.top - MARGIN.bottom;
    const laneH = Math.max(LANE_H_MIN, Math.min(LANE_H_MAX, usableH / nLanes));
    const nudge = Math.min(26, laneH * 0.22); // collision offset for near-overlapping bubbles

    const placed = [];
    const pos = {};
    lanes.forEach((lane, li) => {
      const arr = (byRegion[lane.key] || []).slice().sort((a, b) => (a._peakMs || 0) - (b._peakMs || 0));
      const laneY = MARGIN.top + li * laneH + laneH / 2;
      let lastX = -1e9; let toggle = 1;
      arr.forEach(s => {
        const r = rForThreads(s.threadCount);
        const x = xForMs(s._peakMs);
        let y = laneY - 4;
        if (x - lastX < 2 * r + 8) { y = laneY - 4 + toggle * nudge; toggle *= -1; } else { toggle = 1; }
        lastX = x;
        const o = { ...s, _rk: lane.key, _x: x, _y: y, _r: r };
        placed.push(o);
        pos[s.country] = { x, y };
      });
    });

    const svgW = MARGIN.left + totalDays * DAY_W + MARGIN.right;
    const svgH = MARGIN.top + nLanes * laneH + MARGIN.bottom;
    const laneBottom = MARGIN.top + nLanes * laneH;
    return { placed, pos, lanes, laneH, minMs, maxMs, totalDays, svgW, svgH, laneBottom, xForMs };
  }, [situations, availH]);

  return (
    <div className="spider-graph-wrap">
      <div className="spider-graph-scroll" ref={scrollRef}>
        {loading && <div className="spider-state"><span className="spider-loading-dot" />Loading world overview…</div>}
        {error && <div className="spider-state spider-error-state"><strong>Error:</strong> {error}</div>}
        {!loading && !error && situations && situations.length === 0 && (
          <div className="spider-state">No country graphs available yet.</div>
        )}
        {!loading && layout && (
          <svg className="spider-web-svg" width={layout.svgW} height={layout.svgH}
            viewBox={`0 0 ${layout.svgW} ${layout.svgH}`} aria-label="World causal overview timeline">
            {/* Region lanes (only populated ones, sized to fit) */}
            {layout.lanes.map((lane, i) => {
              const y0 = MARGIN.top + i * layout.laneH;
              return (
                <g key={lane.key}>
                  <rect x={0} y={y0} width={layout.svgW} height={layout.laneH} fill={i % 2 ? 'var(--paper-2)' : 'var(--paper)'} opacity={0.6} />
                  <line x1={0} y1={y0} x2={layout.svgW} y2={y0} className="spider-lane-rule" />
                  <text x={16} y={y0 + 20} className="spider-lane-label" fill="var(--ink-dim)">{lane.label}</text>
                </g>
              );
            })}
            <line x1={0} y1={layout.laneBottom} x2={layout.svgW} y2={layout.laneBottom} className="spider-lane-rule" />

            {/* Time axis — date ticks + gridlines */}
            <text x={MARGIN.left} y={14} className="spider-axis-label">
              {MONTHS[new Date(layout.minMs).getUTCMonth()]} {new Date(layout.minMs).getUTCFullYear()} →
            </text>
            {Array.from({ length: layout.totalDays }, (_, d) => d).filter(d => d % 4 === 0).map(d => {
              const ms = layout.minMs + d * DAY_MS;
              const x = MARGIN.left + d * DAY_W + DAY_W / 2;
              return (
                <g key={`t${d}`}>
                  <line x1={x} y1={MARGIN.top - 4} x2={x} y2={layout.laneBottom} className="spider-gridline" />
                  <text x={x} y={MARGIN.top - 12} textAnchor="middle" className="spider-tick-label">{fmtMs(ms)}</text>
                </g>
              );
            })}

            {/* Cross-country shared-actor links (under bubbles) */}
            {links.map((lk, i) => {
              const a = layout.pos[lk.from];
              const b = layout.pos[lk.to];
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2 - 26;
              const w = Math.min(4.5, 1 + lk.weight * 0.45);
              return (
                <path key={`lk${i}`} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
                  className="spider-world-link" strokeWidth={w} style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => setHover({ x: e.clientX + 14, y: e.clientY + 14, link: lk })}
                  onMouseMove={(e) => setHover(h => h ? { ...h, x: e.clientX + 14, y: e.clientY + 14 } : h)}
                  onMouseLeave={() => setHover(null)} />
              );
            })}

            {/* Situation bubbles. No span bar: multiple bubbles share a lane and
               each situation runs most of the month, so per-country duration bars
               overlap into one rule that reads as a connector joining nothing. The
               active window lives in the hover tooltip instead ("active X–Y"). */}
            {layout.placed.map(s => (
              <g key={s.country} style={{ cursor: 'pointer' }}
                onClick={() => onDrill(s.country)}
                onMouseEnter={(e) => setHover({ x: e.clientX + 14, y: e.clientY + 14, s })}
                onMouseMove={(e) => setHover(h => h ? { ...h, x: e.clientX + 14, y: e.clientY + 14 } : h)}
                onMouseLeave={() => setHover(null)}>
                <circle cx={s._x} cy={s._y} r={s._r} fill={catColor(s.topCategory)} opacity={0.92} stroke="#fff" strokeWidth={2} />
                <text x={s._x} y={s._y + 5} textAnchor="middle" className="spider-world-count">{s.threadCount}</text>
                <text x={s._x} y={s._y + s._r + 15} textAnchor="middle" className="spider-node-label">{shortName(s.country)}</text>
              </g>
            ))}
          </svg>
        )}
      </div>
      {hover && hover.s && (
        <div className="spider-tip" style={{ left: hover.x, top: hover.y }}>
          <div className="spider-tip-cat" style={{ color: catColor(hover.s.topCategory) }}>
            {REGION_LANES.find(l => l.key === regionOf(hover.s.country))?.label}
          </div>
          <div className="spider-tip-head">{hover.s.country}</div>
          <div className="spider-tip-meta">
            {hover.s.threadCount} threads · mostly {hover.s.topCategory || 'mixed'}
            {hover.s.earliest && hover.s.latest ? ` · active ${fmtMs(parseDate(hover.s.earliest))}–${fmtMs(parseDate(hover.s.latest))}` : ''}
            {hover.s.peak ? ` · peak ${fmtMs(parseDate(hover.s.peak))}` : ''}
          </div>
          <div className="spider-tip-hint">click to open the causal web →</div>
        </div>
      )}
      {hover && hover.link && (
        <div className="spider-tip" style={{ left: hover.x, top: hover.y }}>
          <div className="spider-tip-cat" style={{ color: 'var(--ink-dim)' }}>Shared-actor link</div>
          <div className="spider-tip-head">{hover.link.from} — {hover.link.to}</div>
          <div className="spider-tip-meta">shared: {hover.link.sharedActors.join(', ')}</div>
        </div>
      )}
    </div>
  );
}
