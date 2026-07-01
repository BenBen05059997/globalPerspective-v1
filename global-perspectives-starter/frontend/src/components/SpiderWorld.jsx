// SpiderWorld.jsx — World Overview tier for the /spider-demo prototype.
// Top altitude of the causal-web system: region lanes, one "situation" bubble
// per country that has a systems graph (sized by thread count), packed evenly
// within its lane and labelled with its latest-activity date. Click a bubble to
// drill into that country's causal web. Throwaway prototype; deletable with
// SpiderDemo.jsx. Uses only read-only fetchWorldOverview.

import { useState, useEffect, useMemo } from 'react';
import { fetchWorldOverview } from '../services/restProxy';

// Region lanes (y) — the world is laid out by region.
const REGION_LANES = [
  { key: 'me', label: 'Middle East' },
  { key: 'eu', label: 'Europe' },
  { key: 'as', label: 'Asia' },
  { key: 'am', label: 'Americas' },
  { key: 'af', label: 'Africa' },
  { key: 'gl', label: 'Global' },
];

// Country → region. Extend as coverage widens; unknown → Global.
const COUNTRY_REGION = {
  'Iran': 'me', 'Israel': 'me', 'Saudi Arabia': 'me', 'Qatar': 'me', 'Lebanon': 'me',
  'Turkey': 'me', 'Syria': 'me', 'Yemen': 'me', 'United Arab Emirates': 'me',
  'United States': 'am', 'Venezuela': 'am', 'Canada': 'am', 'Mexico': 'am', 'Brazil': 'am', 'Argentina': 'am',
  'China': 'as', 'Japan': 'as', 'South Korea': 'as', 'North Korea': 'as', 'India': 'as', 'Pakistan': 'as', 'Taiwan': 'as',
  'France': 'eu', 'Germany': 'eu', 'Ukraine': 'eu', 'Russia': 'eu', 'United Kingdom': 'eu', 'Poland': 'eu', 'Italy': 'eu',
  'Democratic Republic of the Congo': 'af', 'South Africa': 'af', 'Nigeria': 'af', 'Sudan': 'af', 'Ethiopia': 'af',
};
function regionOf(country) { return COUNTRY_REGION[country] || 'gl'; }

// Shorten a few long country names for on-canvas labels.
const SHORT_NAME = { 'Democratic Republic of the Congo': 'DR Congo', 'United States': 'United States' };
function shortName(c) { return SHORT_NAME[c] || c; }

// Broad category → bubble color (matches the country-tier palette family).
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
function shortDate(s) {
  const m = typeof s === 'string' && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}` : '';
}

const COL_W = 158;
const LANE_H = 128;
const MARGIN = { top: 16, left: 150, right: 40, bottom: 24 };
const rForThreads = (t) => 16 + Math.sqrt(Math.max(1, t)) * 4.2;

export default function WorldOverview({ onDrill }) {
  const [situations, setSituations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWorldOverview()
      .then(r => { if (!cancelled) setSituations(Array.isArray(r?.data) ? r.data : []); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const layout = useMemo(() => {
    if (!situations || !situations.length) return null;
    // Group by region; pack evenly left→right within each lane (biggest first).
    const byRegion = {};
    situations.forEach(s => { const rk = regionOf(s.country); (byRegion[rk] = byRegion[rk] || []).push(s); });
    Object.values(byRegion).forEach(arr => arr.sort((a, b) => b.threadCount - a.threadCount));

    const placed = [];
    REGION_LANES.forEach((lane, li) => {
      const arr = byRegion[lane.key] || [];
      const laneY = MARGIN.top + li * LANE_H + LANE_H / 2;
      arr.forEach((s, i) => {
        placed.push({ ...s, _rk: lane.key, _x: MARGIN.left + i * COL_W + COL_W / 2, _y: laneY - 6, _r: rForThreads(s.threadCount) });
      });
    });
    const maxCols = Math.max(1, ...REGION_LANES.map(l => (byRegion[l.key] || []).length));
    const svgW = MARGIN.left + maxCols * COL_W + MARGIN.right;
    const svgH = MARGIN.top + REGION_LANES.length * LANE_H + MARGIN.bottom;
    return { placed, svgW, svgH };
  }, [situations]);

  return (
    <div className="spider-graph-wrap">
      <div className="spider-graph-scroll">
        {loading && <div className="spider-state"><span className="spider-loading-dot" />Loading world overview…</div>}
        {error && <div className="spider-state spider-error-state"><strong>Error:</strong> {error}</div>}
        {!loading && !error && situations && situations.length === 0 && (
          <div className="spider-state">No country graphs available yet.</div>
        )}
        {!loading && layout && (
          <svg className="spider-web-svg" width={layout.svgW} height={layout.svgH}
            viewBox={`0 0 ${layout.svgW} ${layout.svgH}`} aria-label="World causal overview">
            {/* Region lanes */}
            {REGION_LANES.map((lane, i) => {
              const y0 = MARGIN.top + i * LANE_H;
              return (
                <g key={lane.key}>
                  <rect x={0} y={y0} width={layout.svgW} height={LANE_H} fill={i % 2 ? 'var(--paper-2)' : 'var(--paper)'} opacity={0.6} />
                  <line x1={0} y1={y0} x2={layout.svgW} y2={y0} className="spider-lane-rule" />
                  <text x={16} y={y0 + 20} className="spider-lane-label" fill="var(--ink-dim)">{lane.label}</text>
                </g>
              );
            })}
            <line x1={0} y1={MARGIN.top + REGION_LANES.length * LANE_H} x2={layout.svgW}
              y2={MARGIN.top + REGION_LANES.length * LANE_H} className="spider-lane-rule" />

            {/* Situation bubbles */}
            {layout.placed.map(s => (
              <g key={s.country} style={{ cursor: 'pointer' }}
                onClick={() => onDrill(s.country)}
                onMouseEnter={(e) => setHover({ x: e.clientX + 14, y: e.clientY + 14, s })}
                onMouseMove={(e) => setHover(h => h ? { ...h, x: e.clientX + 14, y: e.clientY + 14 } : h)}
                onMouseLeave={() => setHover(null)}>
                <circle cx={s._x} cy={s._y} r={s._r} fill={catColor(s.topCategory)} opacity={0.9} stroke="#fff" strokeWidth={2} />
                <text x={s._x} y={s._y + 5} textAnchor="middle" className="spider-world-count">{s.threadCount}</text>
                <text x={s._x} y={s._y + s._r + 16} textAnchor="middle" className="spider-node-label">{shortName(s.country)}</text>
                <text x={s._x} y={s._y + s._r + 31} textAnchor="middle" className="spider-world-date">
                  {s.latest ? `latest ${shortDate(s.latest)}` : ''}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
      {hover && (
        <div className="spider-tip" style={{ left: hover.x, top: hover.y }}>
          <div className="spider-tip-cat" style={{ color: catColor(hover.s.topCategory) }}>
            {REGION_LANES.find(l => l.key === regionOf(hover.s.country))?.label}
          </div>
          <div className="spider-tip-head">{hover.s.country}</div>
          <div className="spider-tip-meta">
            {hover.s.threadCount} threads · {hover.s.backboneCount} backbone links · mostly {hover.s.topCategory || 'mixed'}
            {hover.s.latest ? ` · latest ${shortDate(hover.s.latest)}` : ''}
          </div>
          <div className="spider-tip-hint">click to open the causal web →</div>
        </div>
      )}
    </div>
  );
}
