// SpiderDemo.jsx — throwaway prototype route (/spider-demo).
// Deletable in one commit: remove this file, SpiderDemo.css, and the route line in App.jsx.
// Do NOT touch any other component, hook, or backend.
//
// Renders a timeline+lane causal web of Iran systems-analysis data.
// Reuses: useSystemsAnalysis, useNarrativeThread, fetchPredictionCache,
//         threadPath, CompactTimeline — all read-only.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSystemsAnalysis } from '../hooks/useSystemsAnalysis';
import { useNarrativeThread } from '../hooks/useNarrativeThread';
import { fetchPredictionCache, fetchDossierAnalysis } from '../services/restProxy';
import { threadPath } from '../utils/threadPath';
import CompactTimeline from './CompactTimeline';
import WorldOverview from './SpiderWorld';
import './SpiderDemo.css';

// Countries with a live systems_analysis graph (SYSTEMS_TEST_COUNTRIES gate).
const COUNTRIES = [
  'Iran', 'Israel', 'United States', 'Venezuela', 'China', 'Japan',
  'Ukraine', 'Russia', 'France', 'Germany', 'Democratic Republic of the Congo', 'South Africa',
];
const DEFAULT_COUNTRY = 'Iran';

// ── Category / lane config ────────────────────────────────────────────────────

const LANE_ORDER = ['conflict', 'diplo', 'energy', 'econ', 'politics', 'other'];

const LANE_META = {
  conflict: { label: 'Military / Conflict', color: '#c0492f', soft: '#f7e6e1' },
  diplo:    { label: 'Diplomacy',           color: '#3a6ea5', soft: '#e6eef6' },
  energy:   { label: 'Energy',              color: '#3f8f6b', soft: '#e6f1ec' },
  econ:     { label: 'Economics',           color: '#c9912f', soft: '#f8f0dd' },
  politics: { label: 'Politics',            color: '#8a3526', soft: '#f3e4e0' },
  other:    { label: 'Other',               color: '#7d5ba6', soft: '#efe9f5' },
};

function categoryToLane(category) {
  if (!category) return 'other';
  const lower = category.toLowerCase();
  if (/military|conflict|war|security/.test(lower)) return 'conflict';
  if (/diplomacy|diplomatic/.test(lower)) return 'diplo';
  if (/energy|oil/.test(lower)) return 'energy';
  if (/economy|economics|economic|business|markets|trade/.test(lower)) return 'econ';
  if (/politics|political|government/.test(lower)) return 'politics';
  return 'other';
}

// ── Layout constants ──────────────────────────────────────────────────────────

const COL_W = 78;
const RIBBON_H = 34;
const LANE_H = 118;
const MARGIN = { top: 34, left: 130, right: 40, bottom: 20 };
const LANES_TOP = MARGIN.top + RIBBON_H + 12;
const DAY_MS = 86400000;

// ── Helpers ───────────────────────────────────────────────────────────────────

// confColor: used in EdgePanel category tag background
function confColor(c) {
  return c === 'strong' ? 'var(--risk-h)'
    : c === 'medium' ? 'var(--risk-e)'
    : 'var(--ink-faint)';
}

// Strip trailing "-N" index from citedEntry strings produced by the backend
function parseCitation(s) {
  return (s || '').replace(/-\d+$/, '').trim();
}

const LABEL_STOPWORDS = new Set(['the', 'a', 'an', 'in', 'of', 'on', 'and', 'to', 'as', 'at', 'for']);
function storyLabel(summary, maxWords = 5) {
  if (!summary) return '';
  let words = summary.replace(/[".]+$/g, '').split(/\s+/).filter(Boolean);
  while (words.length > maxWords + 1 && LABEL_STOPWORDS.has(words[0].toLowerCase())) {
    words = words.slice(1);
  }
  const kept = words.slice(0, maxWords).join(' ').replace(/[,;:]$/, '');
  return words.length > maxWords ? `${kept}…` : kept;
}

// Minimal rich-text render for the AI analysis: **bold** + line breaks.
function renderRich(text) {
  return String(text || '').split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="spider-ai-gap" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>,
    );
    return <p key={i} className="spider-ai-line">{parts}</p>;
  });
}

function parsePrediction(raw) {
  if (!raw || typeof raw !== 'string') return raw ? { text: String(raw) } : null;
  const trimmed = raw.trim();
  try {
    const obj = JSON.parse(trimmed);
    if (obj && Array.isArray(obj.scenarios) && obj.scenarios.length > 0) {
      return { scenarios: obj.scenarios };
    }
  } catch { /* not JSON — show as text */ }
  return { text: trimmed };
}

// Parse peakDate "YYYY-MM-DD" to UTC epoch ms. No Date.now() / new Date() with no args.
function parsePeakDate(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function msToLabel(ms) {
  const d = new Date(ms);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ── Client-side curation (preserved exactly from original) ────────────────────
//  1. Deduplicate near-identical node summaries via Jaccard word-set overlap.
//  2. Remap edge endpoints to canonical IDs; remove self-loops.
//  3. Flag temporally-impossible edges (lagDays < 0).

const JACCARD_MERGE = 0.8;

function tokenSet(s) {
  return new Set(
    (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Genesis timelines restate the same development for days ("...peace deal
// signing for Sunday" ×4). Collapse consecutive near-duplicate headlines into
// one milestone (keeping the most-sourced wording) so the panel reads as a few
// distinct beats, not 30 granular rows.
function timelineSources(e) {
  return e?.sourceCount
    ?? (Array.isArray(e?.sources) ? e.sources.length
      : (Array.isArray(e?.sourceUrls) ? e.sourceUrls.length : 0));
}
function collapseTimeline(entries) {
  if (!Array.isArray(entries) || entries.length <= 8) return entries;
  const out = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    const et = tokenSet(e.title || e.summary || '');
    if (prev && jaccard(tokenSet(prev.title || prev.summary || ''), et) >= 0.55) {
      // near-duplicate of the running milestone → keep the richer (more-sourced) wording
      if (timelineSources(e) > timelineSources(prev)) out[out.length - 1] = e;
      continue;
    }
    out.push(e);
  }
  return out;
}

function curateData(raw) {
  if (!raw) return null;
  const { nodes = [], edges = [], backbone = [], ...rest } = raw;

  const canonicalMap = {};
  const dedupedNodes = [];
  const canonicalTokens = [];

  for (const n of nodes) {
    const tokens = tokenSet(n.summary);
    let merged = false;
    for (const c of canonicalTokens) {
      if (jaccard(tokens, c.tokens) >= JACCARD_MERGE) {
        canonicalMap[n.threadId] = c.id;
        merged = true;
        break;
      }
    }
    if (!merged) {
      canonicalMap[n.threadId] = n.threadId;
      dedupedNodes.push(n);
      canonicalTokens.push({ id: n.threadId, tokens });
    }
  }

  const dedupedEdges = edges
    .map(e => ({
      ...e,
      from: canonicalMap[e.from] || e.from,
      to:   canonicalMap[e.to]   || e.to,
    }))
    .filter(e => e.from !== e.to)
    .map(e => ({ ...e, _temporalFlag: e.lagDays != null && e.lagDays < 0 }));

  // Backbone (shared-actor) edges: remap endpoints through the same canonical map,
  // drop self-loops. Reliable/factual layer — no temporal flag.
  const dedupedBackbone = backbone
    .map(e => ({
      ...e,
      from: canonicalMap[e.from] || e.from,
      to:   canonicalMap[e.to]   || e.to,
    }))
    .filter(e => e.from !== e.to);

  return { ...rest, nodes: dedupedNodes, edges: dedupedEdges, backbone: dedupedBackbone };
}

// ── Timeline layout hook ──────────────────────────────────────────────────────

function useTimelineLayout(nodes, edges, backbone) {
  return useMemo(() => {
    if (!nodes?.length) return null;

    // Annotate each node with derived lane + parsed date
    const dated = nodes.map(n => ({
      ...n,
      _dateMs: parsePeakDate(n.peakDate),
      _lane: categoryToLane(n.category),
    }));

    // as-of = max node date (derived from data, not Date.now())
    const validMs = dated.map(n => n._dateMs).filter(Boolean);
    if (!validMs.length) return null;
    const minMs = Math.min(...validMs);
    const maxMs = Math.max(...validMs);
    const totalDays = Math.round((maxMs - minMs) / DAY_MS) + 1;

    const xForMs = (ms) => {
      const dayIdx = ms != null ? Math.round((ms - minMs) / DAY_MS) : totalDays - 1;
      return MARGIN.left + dayIdx * COL_W + COL_W / 2;
    };

    // Two degrees:
    //  • causalDeg (visible causal edges only) → importance/size + labels
    //  • totalDeg  (causal + backbone)         → isolation ring (truly unconnected)
    const causalDeg = {};
    const totalDeg = {};
    nodes.forEach(n => { causalDeg[n.threadId] = 0; totalDeg[n.threadId] = 0; });
    (edges || []).filter(e => !(e.lagDays != null && e.lagDays < 0)).forEach(e => {
      if (causalDeg[e.from] != null) { causalDeg[e.from]++; totalDeg[e.from]++; }
      if (causalDeg[e.to]   != null) { causalDeg[e.to]++;   totalDeg[e.to]++; }
    });
    (backbone || []).forEach(e => {
      if (totalDeg[e.from] != null) totalDeg[e.from]++;
      if (totalDeg[e.to]   != null) totalDeg[e.to]++;
    });

    const impForDeg = (deg) => {
      if (deg === 0) return 2;
      if (deg <= 2) return 3;
      if (deg <= 4) return 4;
      return 5;
    };
    const rForImp = (imp) => 13 + imp * 4.5;
    const yForLane = (lane) => LANES_TOP + LANE_ORDER.indexOf(lane) * LANE_H + LANE_H / 2;

    // Vertical jitter: nodes sharing the same lane+day are spread apart
    const buckets = {};
    dated.forEach(n => {
      const dayIdx = n._dateMs != null ? Math.round((n._dateMs - minMs) / DAY_MS) : totalDays - 1;
      const key = `${n._lane}_${dayIdx}`;
      buckets[key] = buckets[key] || [];
      buckets[key].push(n.threadId);
    });

    const positioned = dated.map(n => {
      const imp = impForDeg(causalDeg[n.threadId] || 0);
      const dayIdx = n._dateMs != null ? Math.round((n._dateMs - minMs) / DAY_MS) : totalDays - 1;
      const key = `${n._lane}_${dayIdx}`;
      const grp = buckets[key];
      const laneY = yForLane(n._lane);
      const idx = grp.indexOf(n.threadId);
      const y = grp.length > 1 ? laneY + (idx - (grp.length - 1) / 2) * 34 : laneY;
      return { ...n, _imp: imp, _r: rForImp(imp), _x: xForMs(n._dateMs), _y: y, _degree: totalDeg[n.threadId] || 0 };
    });

    // Coverage ribbon: node-peak histogram per day column
    // (no per-day article count in this payload; node peaks are the honest proxy)
    const volByDay = Array(totalDays).fill(0);
    dated.forEach(n => {
      const dayIdx = n._dateMs != null ? Math.round((n._dateMs - minMs) / DAY_MS) : totalDays - 1;
      if (dayIdx >= 0 && dayIdx < totalDays) volByDay[dayIdx]++;
    });
    const volMax = Math.max(...volByDay, 1);

    const svgW = MARGIN.left + totalDays * COL_W + MARGIN.right;
    const svgH = LANES_TOP + LANE_ORDER.length * LANE_H + MARGIN.bottom;
    const laneBottom = LANES_TOP + LANE_ORDER.length * LANE_H;

    const nodeById = {};
    positioned.forEach(n => { nodeById[n.threadId] = n; });

    return { positioned, nodeById, totalDays, minMs, maxMs, volByDay, volMax, svgW, svgH, laneBottom, xForMs };
  }, [nodes, edges, backbone]);
}

// ── Causal web SVG ────────────────────────────────────────────────────────────

function CausalWebSVG({
  layout,
  edges,
  backbone,
  activeLanes,
  causalOn,
  selectedNodeId,
  selectedEdgeKey,
  onNodeClick,
  onEdgeClick,
  onNodeHover,
  onNodeLeave,
  onEdgeHover,
  onEdgeLeave,
}) {
  const { positioned, nodeById, totalDays, minMs, maxMs, volByDay, volMax, svgW, svgH, laneBottom, xForMs } = layout;

  // Neighbors of selected node (for dim/highlight) — via causal AND backbone
  const neighbors = useMemo(() => {
    if (!selectedNodeId) return null;
    const s = new Set();
    const consider = (arr) => (arr || []).forEach(e => {
      if (e.from === selectedNodeId || e.to === selectedNodeId) { s.add(e.from); s.add(e.to); }
    });
    consider((edges || []).filter(e => !e._temporalFlag));
    consider(backbone);
    return s;
  }, [selectedNodeId, edges, backbone]);

  const visibleEdges = useMemo(
    () => (causalOn ? (edges || []).filter(e => !e._temporalFlag) : []),
    [causalOn, edges],
  );

  // Level-of-detail labels: always label the TOP-K most important visible nodes (by degree,
  // then importance bucket) — guarantees readable labels on ANY graph size. Sparse graphs
  // (≤K) get every node labeled; dense graphs (e.g. Iran's 15) get the K most-connected
  // labeled + the rest revealed on hover/select. (The earlier "label-all-when-≤12" left dense
  // flagship graphs as anonymous dots — the exact bug this replaces.)
  const LABEL_TOP_K = 10;
  const labelIds = useMemo(() => {
    const vis = positioned.filter(n => activeLanes.has(n._lane));
    const ranked = [...vis].sort((a, b) => (b._degree - a._degree) || (b._imp - a._imp));
    return new Set(ranked.slice(0, LABEL_TOP_K).map(n => n.threadId));
  }, [positioned, activeLanes]);

  return (
    <svg
      className="spider-web-svg"
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      aria-label="Causal web timeline"
    >
      <defs>
        <marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
        <marker id="sw-arrow-in" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#3a6ea5" />
        </marker>
      </defs>

      {/* Lane bands */}
      {LANE_ORDER.map((lane, i) => {
        const meta = LANE_META[lane];
        const y0 = LANES_TOP + i * LANE_H;
        const active = activeLanes.has(lane);
        return (
          <g key={lane}>
            <rect x={0} y={y0} width={svgW} height={LANE_H} fill={meta.soft} opacity={active ? 0.4 : 0.12} />
            <line x1={0} y1={y0} x2={svgW} y2={y0} className="spider-lane-rule" />
            <text x={16} y={y0 + 18} className="spider-lane-label" fill={meta.color}>
              {meta.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={laneBottom} x2={svgW} y2={laneBottom} className="spider-lane-rule" />

      {/* Axis / ribbon labels */}
      <text x={MARGIN.left} y={13} className="spider-axis-label">
        {MONTH_NAMES[new Date(minMs).getUTCMonth()]} {new Date(minMs).getUTCFullYear()} →
      </text>
      <text x={16} y={MARGIN.top + RIBBON_H - 2} className="spider-coverage-label">COVERAGE</text>

      {/* Coverage ribbon bars */}
      {volByDay.map((v, dayIdx) => {
        const x = MARGIN.left + dayIdx * COL_W + COL_W / 2;
        const bh = (v / volMax) * (RIBBON_H - 8);
        const by = MARGIN.top + (RIBBON_H - 4) - bh;
        return bh > 0.5 ? (
          <rect key={dayIdx} x={x - COL_W / 2 + 8} y={by} width={COL_W - 16} height={bh} rx={1} className="spider-vol-bar" />
        ) : null;
      })}
      <line
        x1={MARGIN.left - 8} y1={MARGIN.top + RIBBON_H - 4}
        x2={svgW} y2={MARGIN.top + RIBBON_H - 4}
        className="spider-ribbon-base"
      />

      {/* Day ticks + dashed gridlines */}
      {Array.from({ length: totalDays }, (_, dayIdx) => {
        const x = MARGIN.left + dayIdx * COL_W + COL_W / 2;
        const ms = minMs + dayIdx * DAY_MS;
        const d = new Date(ms);
        const tickLabel = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
        return (
          <g key={dayIdx}>
            <line x1={x} y1={LANES_TOP} x2={x} y2={laneBottom} className="spider-gridline" />
            {dayIdx % 2 === 0 && (
              <text x={x} y={LANES_TOP - 6} textAnchor="middle" className="spider-tick-label">
                {tickLabel}
              </text>
            )}
          </g>
        );
      })}

      {/* As-of marker derived from maxMs (latest node date) */}
      {(() => {
        const tx = xForMs(maxMs);
        return (
          <g>
            <line x1={tx} y1={MARGIN.top} x2={tx} y2={laneBottom} className="spider-today-line" />
            <text x={tx + 6} y={LANES_TOP - 6} className="spider-today-label">
              as of {msToLabel(maxMs)}
            </text>
          </g>
        );
      })()}

      {/* Backbone edges — solid, factual (shared-actor). Drawn UNDER causal + nodes. */}
      {(backbone || []).map((e, i) => {
        const a = nodeById[e.from];
        const b = nodeById[e.to];
        if (!a || !b) return null;
        if (!activeLanes.has(a._lane) || !activeLanes.has(b._lane)) return null;

        const touchesSel = selectedNodeId && (e.from === selectedNodeId || e.to === selectedNodeId);
        const muted = selectedNodeId && !touchesSel;
        const mx = (a._x + b._x) / 2;
        const cy = Math.min(a._y, b._y) - 22; // gentle arc
        const w = e.weight >= 3 ? 2.6 : e.weight === 2 ? 2 : 1.4;

        return (
          <g
            key={`bb|${e.from}|${e.to}|${i}`}
            className={`spider-backbone-grp${muted ? ' spider-bb-mute' : ''}`}
            onMouseEnter={(ev) => onEdgeHover(ev, e)}
            onMouseLeave={onEdgeLeave}
          >
            <path d={`M${a._x},${a._y} Q${mx},${cy} ${b._x},${b._y}`} fill="none" stroke="transparent" strokeWidth={12} />
            <path d={`M${a._x},${a._y} Q${mx},${cy} ${b._x},${b._y}`} fill="none" className="spider-backbone-edge" strokeWidth={w} />
          </g>
        );
      })}

      {/* Causal edges — dashed overlay (model judgment), toggle-gated */}
      {visibleEdges.map((e, i) => {
        const a = nodeById[e.from];
        const b = nodeById[e.to];
        if (!a || !b) return null;
        if (!activeLanes.has(a._lane) || !activeLanes.has(b._lane)) return null;

        const key = `${e.from}|${e.to}|${i}`;
        const isSelected = key === selectedEdgeKey;

        let dirCls = '';
        if (selectedNodeId) {
          if (e.to === selectedNodeId) dirCls = 'sw-edge-in';
          else if (e.from === selectedNodeId) dirCls = 'sw-edge-out';
          else dirCls = 'sw-edge-mute';
        }

        const mx = (a._x + b._x) / 2;
        const cy = Math.min(a._y, b._y) - 40;
        const sw = e.confidence === 'strong' ? 2.6 : e.confidence === 'medium' ? 1.8 : 1;
        const marker = e.to === selectedNodeId ? 'url(#sw-arrow-in)' : 'url(#sw-arrow)';

        return (
          <g
            key={key}
            className={`spider-edge-grp ${dirCls}${isSelected ? ' spider-edge-grp-sel' : ''}`}
            onClick={() => onEdgeClick(e, key)}
            onMouseEnter={(ev) => onEdgeHover(ev, e)}
            onMouseLeave={onEdgeLeave}
            style={{ cursor: 'pointer' }}
          >
            {/* Wide transparent hit area */}
            <path d={`M${a._x},${a._y} Q${mx},${cy} ${b._x},${b._y}`} fill="none" stroke="transparent" strokeWidth={14} />
            <path
              d={`M${a._x},${a._y} Q${mx},${cy} ${b._x},${b._y}`}
              fill="none"
              className={`spider-causal-edge ${e.confidence || 'weak'}`}
              strokeWidth={sw}
              markerEnd={marker}
            />
            <text x={mx} y={cy + 14} textAnchor="middle" className="spider-edge-lag-label">
              {e.lagDays != null ? `${e.lagDays}d` : ''}{e.lagDays != null && e.confidence ? ' · ' : ''}{e.confidence || ''}
            </text>
          </g>
        );
      })}

      {/* Nodes (rendered above edges) */}
      {positioned.map(n => {
        if (!activeLanes.has(n._lane)) return null;
        const meta = LANE_META[n._lane];
        const isSelected = n.threadId === selectedNodeId;
        const isDimmed = !!(selectedNodeId && !isSelected && !(neighbors?.has(n.threadId)));
        const isIsolated = n._degree === 0;
        const showLabel = labelIds.has(n.threadId) || isSelected || !!(neighbors?.has(n.threadId));
        const label = storyLabel(n.summary, isSelected ? 8 : 5);
        const labelY = n._y + n._r + 14;
        const lw = label.length * 6.2;

        return (
          <g
            key={n.threadId}
            className={[
              'spider-node',
              isIsolated ? 'spider-node-iso' : '',
              isSelected ? 'spider-node-sel' : '',
              isDimmed ? 'spider-node-dim' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onNodeClick(n)}
            onMouseEnter={(ev) => onNodeHover(ev, n)}
            onMouseLeave={onNodeLeave}
            style={{ cursor: 'pointer' }}
          >
            {isIsolated && (
              <circle cx={n._x} cy={n._y} r={n._r + 5}
                fill="none" stroke={meta.color} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
            )}
            <circle cx={n._x} cy={n._y} r={n._r} fill={meta.color} stroke="#fff" strokeWidth={2} />
            {showLabel && (
              <>
                <rect x={n._x - lw / 2 - 3} y={labelY - 11} width={lw + 6} height={15} rx={2} fill="#fff" opacity={0.82} />
                <text x={n._x} y={labelY} textAnchor="middle" className="spider-node-label">
                  {label}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ tip }) {
  if (!tip) return null;
  const { x, y, node, edge } = tip;
  return (
    <div className="spider-tip" style={{ left: x, top: y }}>
      {node && (
        <>
          <div className="spider-tip-cat" style={{ color: LANE_META[node._lane]?.color }}>
            {LANE_META[node._lane]?.label}
          </div>
          <div className="spider-tip-head">{node.summary}</div>
          <div className="spider-tip-meta">
            {node.peakDate} · importance {node._imp}/5
          </div>
          <div className="spider-tip-hint">click to open →</div>
        </>
      )}
      {edge && !node && edge.class === 'backbone' && (
        <>
          <div className="spider-tip-cat" style={{ color: 'var(--ink-dim)' }}>Shared-actor link</div>
          <div className="spider-tip-meta">
            {Array.isArray(edge.sharedActors) ? edge.sharedActors.join(', ') : 'shared actors'}
          </div>
        </>
      )}
      {edge && !node && edge.class !== 'backbone' && (
        <>
          <div className="spider-tip-cat" style={{ color: 'var(--accent)' }}>Possibly related</div>
          <div className="spider-tip-meta">
            {edge.confidence}{edge.lagDays != null ? ` · ${edge.lagDays}d lag` : ''}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dossier provenance strip ──────────────────────────────────────────────────
// Surfaces the honesty layer the dossier already carries but the UI used to discard:
// what the AI read is built on, with FACT (✅ from our sources) kept separate from
// INFERENCE (💭 model judgment), and co-movement (effect-precedes-cause) called out.
function DossierProvenance({ dossier }) {
  const events = Array.isArray(dossier?.nodes) ? dossier.nodes.length : 0;
  const factual = Array.isArray(dossier?.backbone) ? dossier.backbone.length : 0;
  const causal = Array.isArray(dossier?.edges) ? dossier.edges.length : 0;
  const anomaly = Array.isArray(dossier?.edges)
    ? dossier.edges.filter(e => e?.flags?.temporal_anomaly).length
    : 0;
  return (
    <div className="spider-prov">
      <div className="spider-prov-chips">
        <span className="spider-prov-chip spider-prov-fact" title="Events + shared-actor links — sourced from our archive, auditable">
          ✅ {events} events · {factual} factual links
        </span>
        <span className="spider-prov-chip spider-prov-judge" title="Model-judged cause→effect — interpretation backed by cited facts, not itself fact">
          💭 {causal} inferred links
        </span>
        {anomaly > 0 && (
          <span className="spider-prov-chip spider-prov-warn" title="Effect peaks before cause — treated as co-movement, not causation">
            ⚠ {anomaly} co-movement
          </span>
        )}
      </div>
      <div className="spider-prov-note">
        Fact (✅ from our sources) kept separate from inference (💭 model judgment). The read below reasons over this dossier under that contract.
      </div>
    </div>
  );
}

// ── Node panel (all data logic preserved exactly; markup restyled to mockup) ──

function NodePanel({ node, country, onClose }) {
  const { entries, loading: tlLoading, error: tlError } = useNarrativeThread(node?.threadId);
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [ai, setAi] = useState(null); // null | {loading} | {text} | {error}

  // Predictions are keyed per-TOPIC, not per-thread. Derive representative topicId
  // from thread narrative entries — prefer inflection/peak entry, else most recent.
  const repTopicId = useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const withId = entries.filter(e => e?.topicId);
    if (withId.length === 0) return null;
    const inflection = withId.find(e => e.isInflection || e.isPeak || e.inflection || e.peak);
    if (inflection) return inflection.topicId;
    const sorted = [...withId].sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
    return sorted[0]?.topicId || withId[withId.length - 1].topicId;
  }, [entries]);

  useEffect(() => {
    setPrediction(null);
    if (!repTopicId) { setPredLoading(false); return; }
    let cancelled = false;
    setPredLoading(true);
    fetchPredictionCache(repTopicId)
      .then(r => {
        if (cancelled) return;
        // fetchPredictionCache returns the raw cache envelope { success, data, ... };
        // unwrap the actual model output (JSON-encoded {scenarios:[...]} string).
        const raw = r?.data?.content ?? r?.content ?? r?.impact_analysis ?? null;
        setPrediction(parsePrediction(raw));
      })
      .catch(() => { if (!cancelled) setPrediction(null); })
      .finally(() => { if (!cancelled) setPredLoading(false); });
    return () => { cancelled = true; };
  }, [repTopicId]);

  // AI analysis over the event dossier (public dossier_analysis action).
  useEffect(() => { setAi(null); }, [node?.threadId]);
  const runAnalysis = useCallback(() => {
    if (!node?.threadId) return;
    setAi({ loading: true });
    fetchDossierAnalysis(country, node.threadId)
      .then(r => {
        const a = r?.data?.analysis;
        const dossier = r?.data?.dossier || null; // carry provenance so we can show it, not just the prose
        setAi(a ? { text: a, dossier } : { error: r?.data?.analysisError || 'unavailable', dossier });
      })
      .catch(() => setAi({ error: 'request failed' }));
  }, [country, node?.threadId]);

  if (!node) return null;
  const meta = LANE_META[node._lane] || LANE_META.other;

  return (
    <div className="spider-panel" aria-label="Node detail">
      <div className="spider-panel-inner">
        <div className="spider-panel-top">
          <span className="spider-panel-cat-tag" style={{ background: meta.color }}>
            {meta.label.split(' ')[0]}
          </span>
          <button className="spider-panel-close" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        <h2 className="spider-panel-h2">{node.summary}</h2>

        {node.peakDate && (
          <div className="spider-panel-peak">
            Peak: <strong>{node.peakDate}</strong> · importance {node._imp}/5
          </div>
        )}

        <Link
          className="spider-panel-arclink"
          to={threadPath(node.threadId, { from: 'country', country })}
        >
          View full thread arc →
        </Link>

        <div className="spider-panel-sec-label">Genesis timeline</div>
        {tlLoading && <div className="spider-panel-loading">Loading…</div>}
        {tlError && <div className="spider-panel-error">Could not load timeline: {tlError}</div>}
        {!tlLoading && !tlError && entries && entries.length > 0 && (
          <CompactTimeline entries={collapseTimeline(entries)} />
        )}
        {!tlLoading && !tlError && (!entries || entries.length === 0) && (
          <div className="spider-panel-empty">Single-day story — no multi-day genesis tracked yet.</div>
        )}

        <div className="spider-panel-scenario">
          <div className="spider-panel-scenario-lbl">Scenario reasoning</div>
          <div className="spider-panel-jtag">model judgment — interpretation, not sourced fact</div>
          {(predLoading || tlLoading) && <div className="spider-panel-loading">Loading…</div>}
          {!predLoading && !tlLoading && prediction?.scenarios && (
            <div className="spider-panel-scenarios">
              {prediction.scenarios.map((s, i) => (
                <div key={i} className="spider-scenario">
                  <div className="spider-scenario-head">
                    <span className="spider-scenario-lbl">{s.label}</span>
                    {s.probability_range && (
                      <span className="spider-scenario-prob">{s.probability_range}</span>
                    )}
                    {s.horizon && <span className="spider-scenario-horizon">{s.horizon}</span>}
                  </div>
                  {s.rationale && <p className="spider-scenario-rationale">{s.rationale}</p>}
                  {Array.isArray(s.triggers) && s.triggers.length > 0 && (
                    <ul className="spider-scenario-triggers">
                      {s.triggers.map((t, j) => {
                        const text = typeof t === 'string' ? t : t?.text;
                        if (typeof text !== 'string') return null;
                        const deadline = typeof t === 'object' && typeof t?.deadline === 'string' ? t.deadline : null;
                        return <li key={j}>{text}{deadline && <span className="spider-scenario-deadline"> by {deadline}</span>}</li>;
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          {!predLoading && !tlLoading && prediction?.text && (
            <p className="spider-panel-pred-text">{prediction.text}</p>
          )}
          {!predLoading && !tlLoading && !prediction && (
            <div className="spider-panel-empty">No prediction cached for this thread.</div>
          )}
        </div>

        <div className="spider-ai-section">
          {!ai && (
            <button className="spider-ai-btn" onClick={runAnalysis}>
              ✦ Analyze this event with AI
            </button>
          )}
          {ai?.loading && <div className="spider-panel-loading">Reasoning over the causal web…</div>}
          {ai?.error && (
            <div className="spider-panel-empty">
              Analysis unavailable.{' '}
              <button className="spider-ai-link" onClick={runAnalysis}>retry</button>
            </div>
          )}
          {ai?.dossier && <DossierProvenance dossier={ai.dossier} />}
          {ai?.text && (
            <>
              <div className="spider-panel-jtag">💭 AI read of this event&apos;s dossier — grounded in the web; interpretation labeled</div>
              <div className="spider-ai-body">{renderRich(ai.text)}</div>
              <button className="spider-ai-link" onClick={runAnalysis}>↻ re-run</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edge panel (all data logic preserved exactly; markup restyled) ─────────────

function EdgePanel({ edge, nodeMap, onClose }) {
  if (!edge) return null;
  const fromNode = nodeMap[edge.from];
  const toNode   = nodeMap[edge.to];
  const citations = Array.isArray(edge.citedEntries) ? edge.citedEntries : [];

  return (
    <div className="spider-panel" aria-label="Edge detail">
      <div className="spider-panel-inner">
        <div className="spider-panel-top">
          <span className="spider-panel-cat-tag" style={{ background: confColor(edge.confidence), color: '#fff' }}>
            Possibly related
          </span>
          <button className="spider-panel-close" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        <div className="spider-link-pair">
          <div className="spider-link-box">{fromNode?.summary || edge.from}</div>
          <div className="spider-link-arr">→</div>
          <div className="spider-link-box">{toNode?.summary || edge.to}</div>
        </div>

        <span className={`spider-edge-conf-badge spider-conf-${edge.confidence || 'weak'}`}>
          {edge.confidence || 'unrated'} model confidence
          {edge.lagDays != null ? ` · ${edge.lagDays}d lag` : ''}
        </span>

        {edge.mechanism && (
          <>
            <div className="spider-panel-sec-label">Mechanism</div>
            <p className="spider-panel-mech">{edge.mechanism}</p>
          </>
        )}

        <div className="spider-panel-scenario" style={{ marginTop: 0 }}>
          <div className="spider-panel-jtag">
            possibly related — model judgment; &quot;caused&quot; requires corroboration + analyst sign-off (none yet)
          </div>
        </div>

        <div className="spider-panel-sec-label">
          Citations{citations.length > 0 ? ` (${citations.length})` : ''}
        </div>
        {citations.length > 0 ? (
          <div className="spider-citations">
            {citations.map((c, i) => (
              <div key={i} className="spider-cite">{parseCitation(c)}</div>
            ))}
          </div>
        ) : (
          <div className="spider-panel-empty">No citations on this edge</div>
        )}
      </div>
    </div>
  );
}

// ── URL state (?view=country&country=X — world is the default, params omitted) ─
// Mirrors the EconomyPage pattern. Node/edge selection is deliberately NOT
// serialized (too ephemeral to share).

export function parseSpiderParams(sp) {
  const mode = sp.get('view') === 'country' ? 'country' : 'world';
  return { mode, country: sp.get('country') || DEFAULT_COUNTRY };
}

export function buildSpiderParams(mode, country) {
  const p = new URLSearchParams();
  if (mode === 'country') { p.set('view', 'country'); p.set('country', country); }
  return p;
}

// ── Root component ─────────────────────────────────────────────────────────────

export default function SpiderDemo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [country, setCountry] = useState(() => parseSpiderParams(searchParams).country);
  const { data: rawData, loading, error } = useSystemsAnalysis(country);

  const graphData = useMemo(() => curateData(rawData), [rawData]);

  // nodeMap keyed by threadId for EdgePanel summary lookup
  const nodeMap = useMemo(() => {
    if (!graphData?.nodes) return {};
    return graphData.nodes.reduce((m, n) => { m[n.threadId] = n; return m; }, {});
  }, [graphData]);

  const layout = useTimelineLayout(graphData?.nodes, graphData?.edges || [], graphData?.backbone || []);

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState(null);
  const [activeLanes, setActiveLanes] = useState(new Set(LANE_ORDER));
  const [causalOn, setCausalOn] = useState(false); // default OFF — backbone is the primary structure
  const [tip, setTip] = useState(null);
  const [mode, setMode] = useState(() => parseSpiderParams(searchParams).mode); // 'world' (top altitude) | 'country'

  // State → URL (push, so back/forward traverse world→country drills). The
  // lastWritten ref breaks the write→parse echo loop (EconomyPage pattern).
  const lastWritten = useRef(null);
  useEffect(() => {
    const str = buildSpiderParams(mode, country).toString();
    if (str === lastWritten.current) return;
    if (str === '' && lastWritten.current === null) { lastWritten.current = ''; return; } // bare first load — no spurious history entry
    lastWritten.current = str;
    setSearchParams(new URLSearchParams(str));
  }, [mode, country, setSearchParams]);

  // URL → state (back/forward, hand-edited URL). Clears selection so a stale
  // panel never survives a history navigation.
  useEffect(() => {
    const cur = searchParams.toString();
    if (cur === lastWritten.current) return; // our own write echoing back
    lastWritten.current = cur;
    const parsed = parseSpiderParams(searchParams);
    setMode(parsed.mode);
    setCountry(parsed.country);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedEdgeKey(null);
  }, [searchParams]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(prev => prev?.threadId === node.threadId ? null : node);
    setSelectedEdge(null);
    setSelectedEdgeKey(null);
  }, []);

  const handleEdgeClick = useCallback((edge, key) => {
    setSelectedEdge(edge);
    setSelectedEdgeKey(key);
    setSelectedNode(null);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedEdgeKey(null);
  }, []);

  const handleCountryChange = useCallback((c) => {
    setCountry(c);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedEdgeKey(null);
  }, []);

  // Drill from the world overview into a country's causal web.
  const handleDrill = useCallback((c) => {
    setCountry(c);
    setMode('country');
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedEdgeKey(null);
  }, []);

  const handleNodeHover = useCallback((ev, node) => {
    setTip({ x: ev.clientX + 14, y: ev.clientY + 14, node });
  }, []);
  const handleNodeLeave = useCallback(() => setTip(null), []);

  const handleEdgeHover = useCallback((ev, edge) => {
    setTip({ x: ev.clientX + 14, y: ev.clientY + 14, edge });
  }, []);
  const handleEdgeLeave = useCallback(() => setTip(null), []);

  const toggleLane = useCallback((lane) => {
    setActiveLanes(prev => {
      const next = new Set(prev);
      if (next.has(lane)) next.delete(lane); else next.add(lane);
      return next;
    });
  }, []);

  const hasPanel = !!(selectedNode || selectedEdge);

  const visibleNodeCount = layout
    ? layout.positioned.filter(n => activeLanes.has(n._lane)).length
    : 0;

  const causalEdgeCount = graphData?.edges?.filter(e => !e._temporalFlag).length ?? 0;
  const backboneCount = graphData?.backbone?.length ?? 0;
  // Edges where the "effect" peaks before the "cause" — hidden from the tangle, but we
  // disclose the count honestly rather than silently dropping them.
  const anomalyCount = graphData?.edges?.filter(e => e._temporalFlag).length ?? 0;

  return (
    <div className="spider-shell">
      {/* Header */}
      <header className="spider-header">
        <div className="spider-header-row">
          <h1 className="spider-title">{mode === 'world' ? 'Causal Web — World' : `Causal Web — ${country}`}</h1>
          <div className="spider-mode-toggle">
            <button className={`spider-mode-btn${mode === 'world' ? ' spider-mode-on' : ''}`} onClick={() => setMode('world')}>World</button>
            <button className={`spider-mode-btn${mode === 'country' ? ' spider-mode-on' : ''}`} onClick={() => setMode('country')}>Country</button>
          </div>
          {mode === 'country' && (
            <select
              className="spider-country-select"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value)}
              aria-label="Select country"
            >
              {(COUNTRIES.includes(country) ? COUNTRIES : [country, ...COUNTRIES]).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <span className="spider-proto-badge">prototype</span>
        </div>
        <p className="spider-desc">
          {mode === 'world' ? (
            <>Global timeline — each bubble is a country&apos;s situation at its <strong>peak-activity date</strong> (x) on its <strong>region</strong> lane (y); size = <strong>thread count</strong>, color = <strong>current risk tier</strong> (grey = no risk read; ↗ dot = our read changed this week). <strong>Lines</strong> connect countries whose stories share key actors — <strong>click a line</strong> to see them. Click a bubble to open its causal web.</>
          ) : (
            <>Stories laid out by <strong>time</strong> (left → right) and <strong>category</strong> (lanes).{' '}
            <strong>Solid lines</strong> = shared-actor backbone (factual). <strong>Dashed lines</strong> = possibly-related links — model judgment, not verified causation (toggle on).
            Click a story for its genesis; click a dashed link for the mechanism.</>
          )}
        </p>
      </header>

      {/* Control bar (country mode only) */}
      {mode === 'country' && (
      <div className="spider-controls">
        <div className="spider-legend">
          {LANE_ORDER.map(lane => {
            const meta = LANE_META[lane];
            const off = !activeLanes.has(lane);
            return (
              <button
                key={lane}
                className={`spider-lg${off ? ' spider-lg-off' : ''}`}
                onClick={() => toggleLane(lane)}
              >
                <span className="spider-lg-dot" style={{ background: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>
        <div className="spider-controls-spacer" />
        <button
          className={`spider-toggle${causalOn ? ' spider-toggle-on' : ''}`}
          onClick={() => setCausalOn(v => !v)}
        >
          Inferred links
          <span className="spider-toggle-switch" />
          <span className="spider-toggle-ck">dashed · possibly related</span>
        </button>
      </div>
      )}

      {/* Body: world overview OR country graph + sliding panel */}
      {mode === 'world' ? (
        <div className="spider-body">
          <WorldOverview onDrill={handleDrill} />
        </div>
      ) : (
      <div className={`spider-body${hasPanel ? ' spider-body-panel' : ''}`}>
        <div className="spider-graph-wrap">
          <div className="spider-graph-scroll">
            {loading && (
              <div className="spider-state">
                <span className="spider-loading-dot" />
                Loading {country} systems analysis…
              </div>
            )}
            {error && (
              <div className="spider-state spider-error-state">
                <strong>Error loading data:</strong> {error}
                <span className="spider-error-hint">Check that SENSITIVE_PROXY_ENDPOINT is configured.</span>
              </div>
            )}
            {!loading && !error && graphData && graphData.nodes.length === 0 && (
              <div className="spider-state">No graph data returned for {country}.</div>
            )}
            {!loading && layout && (
              <CausalWebSVG
                layout={layout}
                edges={graphData.edges}
                backbone={graphData.backbone}
                activeLanes={activeLanes}
                causalOn={causalOn}
                selectedNodeId={selectedNode?.threadId}
                selectedEdgeKey={selectedEdgeKey}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onNodeHover={handleNodeHover}
                onNodeLeave={handleNodeLeave}
                onEdgeHover={handleEdgeHover}
                onEdgeLeave={handleEdgeLeave}
              />
            )}
          </div>
        </div>

        {selectedNode && (
          <NodePanel node={selectedNode} country={country} onClose={closePanel} />
        )}
        {selectedEdge && !selectedNode && (
          <EdgePanel edge={selectedEdge} nodeMap={nodeMap} onClose={closePanel} />
        )}
      </div>
      )}

      {mode === 'country' && !hasPanel && (
        <div className="spider-hint">Click any story · scroll horizontally for full span</div>
      )}

      {/* Footer */}
      {mode === 'world' ? (
        <footer className="spider-footer">
          <span>Each bubble = a country&apos;s situation · sized by thread count</span>
          <span className="spider-footer-spacer" />
          <span>Click a bubble to drill into its causal web</span>
        </footer>
      ) : (
        <footer className="spider-footer">
          <span><strong>{visibleNodeCount}</strong> stories</span>
          <span><strong>{backboneCount}</strong> backbone links (shared-actor)</span>
          <span><strong>{causalEdgeCount}</strong> possibly-related links</span>
          {anomalyCount > 0 && (
            <span title="Effect peaks before the cause — hidden from the graph, treated as co-movement (not causation) in the AI read">
              ⚠ <strong>{anomalyCount}</strong> co-movement hidden
            </span>
          )}
          <span className="spider-footer-spacer" />
          <span>Confidence shown as weak / medium / strong — never a fabricated %</span>
          {graphData?.generatedAt && (
            <span>generated <strong>{graphData.generatedAt}</strong></span>
          )}
        </footer>
      )}

      {/* Fixed-position hover tooltip */}
      {tip && <Tooltip tip={tip} />}
    </div>
  );
}
