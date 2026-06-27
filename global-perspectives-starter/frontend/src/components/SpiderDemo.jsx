// SpiderDemo.jsx — throwaway prototype route (/spider-demo).
// Deletable in one commit: remove this file, SpiderDemo.css, and the route line in App.jsx.
// Do NOT touch any other component, hook, or backend.
//
// Renders a d3-force node-link causal graph of Iran systems-analysis data.
// Reuses: useSystemsAnalysis, useNarrativeThread, fetchPredictionCache,
//         threadPath, CompactTimeline — all read-only.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import { useSystemsAnalysis } from '../hooks/useSystemsAnalysis';
import { useNarrativeThread } from '../hooks/useNarrativeThread';
import { fetchPredictionCache } from '../services/restProxy';
import { threadPath } from '../utils/threadPath';
import CompactTimeline from './CompactTimeline';
import './SpiderDemo.css';

const DEMO_COUNTRY = 'Iran';
const SVG_W = 880;
const SVG_H = 620;

// ── Helpers ─────────────────────────────────────────────────────────────────

function confColor(c) {
  return c === 'strong' ? 'var(--risk-h)'
    : c === 'medium' ? 'var(--risk-e)'
    : 'var(--ink-faint)';
}

const CAT_COLOR_MAP = [
  ['military',   '#c94a33'],
  ['conflict',   '#c94a33'],
  ['economics',  '#d89540'],
  ['economy',    '#d89540'],
  ['energy',     '#4fa07b'],
  ['diplomacy',  '#2a5f8a'],
  ['diplomatic', '#2a5f8a'],
  ['politics',   '#a2442e'],
  ['political',  '#a2442e'],
];
function catFill(category) {
  if (!category) return '#9a9a9e';
  const lower = category.toLowerCase();
  for (const [key, color] of CAT_COLOR_MAP) {
    if (lower.includes(key)) return color;
  }
  return '#7a3a8f';
}

// Strip trailing "-N" index from citedEntry strings produced by the backend
function parseCitation(s) {
  return (s || '').replace(/-\d+$/, '').trim();
}

// Prediction content is a JSON-encoded { scenarios:[{label,probability_range,
// horizon,rationale,triggers}] } string. Parse it into a renderable shape;
// fall back to plain text if it isn't the expected JSON.
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

// Stable edge identifier (used for selection state)
function edgeId(e, i) {
  return `${e.from}|${e.to}|${i}`;
}

// ── Client-side curation ─────────────────────────────────────────────────────
// Applied once on raw Iran data before rendering.
//  1. Deduplicate NEAR-identical node summaries (collapse tautological pairs).
//     Exact-string matching missed the real Iran duplicate — the two ceasefire
//     nodes differ by one word ("tentative" / "final"). Use Jaccard word-set
//     overlap and merge when overlap ≥ JACCARD_MERGE.
//  2. Remap edge endpoints to canonical IDs; remove self-loops (incl. the
//     tautological A→A' edge between the merged ceasefire nodes).
//  3. Flag temporally-impossible edges (lagDays < 0).

const JACCARD_MERGE = 0.8;

function tokenSet(s) {
  return new Set(
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function curateData(raw) {
  if (!raw) return null;
  const { nodes = [], edges = [], ...rest } = raw;

  // Greedy near-duplicate clustering: each node either joins an existing
  // canonical cluster (≥ JACCARD_MERGE overlap) or becomes a new canonical.
  const canonicalMap = {};      // threadId -> canonical threadId
  const dedupedNodes = [];      // canonical nodes
  const canonicalTokens = [];   // parallel: { id, tokens }

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

  return { ...rest, nodes: dedupedNodes, edges: dedupedEdges };
}

// ── Force layout ─────────────────────────────────────────────────────────────

function useForceLayout(nodes, edges) {
  const [positions, setPositions] = useState({});

  useEffect(() => {
    if (!nodes?.length) return;

    const nodeIds = new Set(nodes.map(n => n.threadId));
    const simNodes = nodes.map(n => ({ id: n.threadId, degree: 0 }));
    const simLinks = edges
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map(e => ({ source: e.from, target: e.to }));

    const degreeMap = {};
    edges.forEach(e => {
      degreeMap[e.from] = (degreeMap[e.from] || 0) + 1;
      degreeMap[e.to]   = (degreeMap[e.to]   || 0) + 1;
    });
    simNodes.forEach(n => { n.degree = degreeMap[n.id] || 0; });

    const radius = (d) => Math.max(18, Math.min(38, 18 + d.degree * 4));

    const sim = forceSimulation(simNodes)
      .force('link',    forceLink(simLinks).id(d => d.id).distance(170).strength(0.4))
      .force('charge',  forceManyBody().strength(-380))
      .force('center',  forceCenter(SVG_W / 2, SVG_H / 2))
      .force('collide', forceCollide(d => radius(d) + 14))
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    const pos = {};
    simNodes.forEach(n => {
      const r = radius(n);
      pos[n.id] = {
        x: Math.max(r + 8, Math.min(SVG_W - r - 8, n.x || SVG_W / 2)),
        y: Math.max(r + 8, Math.min(SVG_H - r - 8, n.y || SVG_H / 2)),
      };
    });
    setPositions(pos);
  }, [nodes, edges]);

  return positions;
}

// ── SVG graph ────────────────────────────────────────────────────────────────

function SpiderGraph({ graphData, selectedNodeId, selectedEdgeId: selectedEdgeIdProp, onNodeClick, onEdgeClick }) {
  const { nodes, edges } = graphData;
  const positions = useForceLayout(nodes, edges);

  const degreeMap = useMemo(() => {
    const m = {};
    edges.forEach(e => {
      m[e.from] = (m[e.from] || 0) + 1;
      m[e.to]   = (m[e.to]   || 0) + 1;
    });
    return m;
  }, [edges]);

  const nodeRadius = (id) => Math.max(18, Math.min(38, 18 + (degreeMap[id] || 0) * 4));

  const ready = Object.keys(positions).length > 0;

  if (!ready) {
    return (
      <div className="spider-computing">
        <span className="spider-computing-dot" />
        Computing layout…
      </div>
    );
  }

  return (
    <svg
      className="spider-svg"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Iran causal web"
    >
      <defs>
        {['strong', 'medium', 'weak', 'flagged'].map(k => (
          <marker
            key={k}
            id={`spider-arrow-${k}`}
            markerWidth="8" markerHeight="8"
            refX="7" refY="3"
            orient="auto"
          >
            <path
              d="M0,0 L0,6 L8,3 z"
              fill={
                k === 'strong'  ? '#c94a33'
                : k === 'medium'  ? '#d89540'
                : k === 'flagged' ? '#c08020'
                :                   '#9a9a9e'
              }
            />
          </marker>
        ))}
      </defs>

      {/* Edges */}
      {edges.map((e, i) => {
        const s = positions[e.from];
        const t = positions[e.to];
        if (!s || !t) return null;

        const key = edgeId(e, i);
        const isSelected = key === selectedEdgeIdProp;
        const rFrom = nodeRadius(e.from);
        const rTo   = nodeRadius(e.to);

        // Trim line to node perimeters
        const dx = t.x - s.x, dy = t.y - s.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len, uy = dy / len;
        const x1 = s.x + ux * (rFrom + 2);
        const y1 = s.y + uy * (rFrom + 2);
        const x2 = t.x - ux * (rTo + 11);
        const y2 = t.y - uy * (rTo + 11);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        const isFlagged = e._temporalFlag;
        const stroke = isSelected ? '#a2442e'
          : isFlagged             ? '#c08020'
          : confColor(e.confidence);
        const sw = isSelected ? 3
          : e.confidence === 'strong' ? 2.5
          : e.confidence === 'medium' ? 1.8
          : 1.2;
        const markerId = isFlagged ? 'spider-arrow-flagged'
          : e.confidence === 'strong' ? 'spider-arrow-strong'
          : e.confidence === 'medium' ? 'spider-arrow-medium'
          : 'spider-arrow-weak';

        return (
          <g
            key={key}
            className="spider-edge-g"
            onClick={() => onEdgeClick(e, key)}
            style={{ cursor: 'pointer' }}
          >
            {/* Wide transparent hit area */}
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="transparent" strokeWidth="14" />
            {/* Visible line */}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={isFlagged ? '5,3' : undefined}
              opacity={isFlagged ? 0.5 : 0.75}
              markerEnd={`url(#${markerId})`}
              className={isSelected ? 'spider-edge-selected' : ''}
            />
            {/* Lag label */}
            {e.lagDays != null && (
              <text
                x={mx} y={my - 5}
                className="spider-edge-lag"
                textAnchor="middle"
                fill={isFlagged ? '#c08020' : 'var(--ink-dim)'}
              >
                {isFlagged ? `⚠ ${e.lagDays}d` : `${e.lagDays}d`}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const pos = positions[n.threadId];
        if (!pos) return null;
        const r = nodeRadius(n.threadId);
        const isSelected = n.threadId === selectedNodeId;
        const fill = catFill(n.category);
        const catLabel = (n.category || '').slice(0, 9);

        return (
          <g
            key={n.threadId}
            className="spider-node-g"
            transform={`translate(${pos.x},${pos.y})`}
            onClick={() => onNodeClick(n)}
            style={{ cursor: 'pointer' }}
            aria-label={n.summary}
          >
            {isSelected && (
              <circle r={r + 6} fill="none" stroke="var(--ink)" strokeWidth="2" opacity="0.35" />
            )}
            <circle
              r={r}
              fill={fill}
              opacity={isSelected ? 1 : 0.8}
              stroke="var(--card)"
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <text
              textAnchor="middle"
              dy="0.35em"
              className="spider-node-label"
              fontSize={r > 28 ? 10 : 9}
              fill="rgba(255,255,255,0.92)"
            >
              {catLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Node panel ───────────────────────────────────────────────────────────────

function NodePanel({ node, onClose }) {
  const { entries, loading: tlLoading, error: tlError } = useNarrativeThread(node?.threadId);
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(false);

  // Predictions are keyed per-TOPIC, not per-thread, so fetchPredictionCache(threadId)
  // always returned nothing. Derive a representative topicId from the thread's
  // narrative entries — prefer an entry flagged as the inflection/peak, else the
  // most recent entry that actually carries a topicId.
  const repTopicId = useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const withId = entries.filter(e => e?.topicId);
    if (withId.length === 0) return null;
    const inflection = withId.find(e => e.isInflection || e.isPeak || e.inflection || e.peak);
    if (inflection) return inflection.topicId;
    // Most recent by date; fall back to last in array if dates are missing.
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
        // the actual model output is data.content (a JSON-encoded {scenarios:[...]}
        // string). Unwrap here — this is NOT done for us like usePrediction's
        // contentService does.
        const raw = r?.data?.content ?? r?.content ?? r?.impact_analysis ?? null;
        setPrediction(parsePrediction(raw));
      })
      .catch(() => { if (!cancelled) setPrediction(null); })
      .finally(() => { if (!cancelled) setPredLoading(false); });
    return () => { cancelled = true; };
  }, [repTopicId]);

  if (!node) return null;

  return (
    <aside className="spider-panel" aria-label="Node detail">
      <button className="spider-panel-close" onClick={onClose} aria-label="Close panel">×</button>

      <div className="spider-panel-category" style={{ background: catFill(node.category) }}>
        {node.category || 'thread'}
      </div>

      <h2 className="spider-panel-title">{node.summary}</h2>

      {node.peakDate && (
        <div className="spider-panel-meta">Peak: {node.peakDate}</div>
      )}

      <Link
        className="spider-panel-thread-link"
        to={threadPath(node.threadId, { from: 'country', country: DEMO_COUNTRY })}
      >
        View full thread arc →
      </Link>

      <section className="spider-panel-section">
        <h3 className="spider-panel-section-title">Genesis timeline</h3>
        {tlLoading && <div className="spider-panel-loading">Loading…</div>}
        {tlError && <div className="spider-panel-error">Could not load timeline: {tlError}</div>}
        {!tlLoading && !tlError && entries && entries.length > 0 && (
          <CompactTimeline entries={entries} />
        )}
        {!tlLoading && !tlError && entries && entries.length === 0 && (
          <div className="spider-panel-empty">No timeline entries found</div>
        )}
      </section>

      <section className="spider-panel-section spider-panel-prediction">
        <h3 className="spider-panel-section-title">Scenario reasoning</h3>
        <div className="spider-panel-judgment">
          💭 model judgment — interpretation, not sourced fact
        </div>
        {(predLoading || tlLoading) && <div className="spider-panel-loading">Loading…</div>}
        {!predLoading && !tlLoading && prediction?.scenarios && (
          <div className="spider-panel-scenarios">
            {prediction.scenarios.map((s, i) => (
              <div key={i} className="spider-scenario">
                <div className="spider-scenario-head">
                  <span className="spider-scenario-label">{s.label}</span>
                  {s.probability_range && (
                    <span className="spider-scenario-prob">{s.probability_range}</span>
                  )}
                  {s.horizon && <span className="spider-scenario-horizon">{s.horizon}</span>}
                </div>
                {s.rationale && <p className="spider-scenario-rationale">{s.rationale}</p>}
                {Array.isArray(s.triggers) && s.triggers.length > 0 && (
                  <ul className="spider-scenario-triggers">
                    {s.triggers.map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {!predLoading && !tlLoading && prediction?.text && (
          <div className="spider-panel-prediction-text">{prediction.text}</div>
        )}
        {!predLoading && !tlLoading && !prediction && (
          <div className="spider-panel-empty">No prediction cached for this thread</div>
        )}
      </section>
    </aside>
  );
}

// ── Edge panel ───────────────────────────────────────────────────────────────

function EdgePanel({ edge, nodeMap, onClose }) {
  if (!edge) return null;
  const fromNode = nodeMap[edge.from];
  const toNode   = nodeMap[edge.to];
  const citations = Array.isArray(edge.citedEntries) ? edge.citedEntries : [];

  return (
    <aside className="spider-panel" aria-label="Edge detail">
      <button className="spider-panel-close" onClick={onClose} aria-label="Close panel">×</button>

      <div
        className="spider-panel-category"
        style={{ background: confColor(edge.confidence), color: '#fff' }}
      >
        {edge.confidence || 'unrated'} confidence
        {edge._temporalFlag && (
          <span className="spider-panel-temporal"> · ⚠ temporal anomaly</span>
        )}
      </div>

      {edge._temporalFlag && (
        <div className="spider-panel-temporal-note">
          lagDays = {edge.lagDays} — effect precedes cause. This edge is flagged as temporally impossible for causal interpretation.
        </div>
      )}

      <div className="spider-panel-edge-flow">
        <div className="spider-panel-edge-node">{fromNode?.summary || edge.from}</div>
        <div className="spider-panel-edge-arrow">
          ↓ {edge.lagDays != null ? `${edge.lagDays} day lag` : 'lag unknown'}
        </div>
        <div className="spider-panel-edge-node">{toNode?.summary || edge.to}</div>
      </div>

      {edge.mechanism && (
        <section className="spider-panel-section">
          <h3 className="spider-panel-section-title">Mechanism</h3>
          <p className="spider-panel-mechanism">{edge.mechanism}</p>
        </section>
      )}

      <section className="spider-panel-section">
        <h3 className="spider-panel-section-title">
          {citations.length > 0 ? `✅ Citations (${citations.length})` : 'Citations'}
        </h3>
        {citations.length > 0 ? (
          <ul className="spider-panel-citations">
            {citations.map((c, i) => (
              <li key={i} className="spider-panel-citation">{parseCitation(c)}</li>
            ))}
          </ul>
        ) : (
          <div className="spider-panel-empty">No citations on this edge</div>
        )}
      </section>
    </aside>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { label: 'military / conflict', color: '#c94a33' },
    { label: 'economics',           color: '#d89540' },
    { label: 'politics',            color: '#a2442e' },
    { label: 'diplomacy',           color: '#2a5f8a' },
    { label: 'energy',              color: '#4fa07b' },
    { label: 'other',               color: '#7a3a8f' },
  ];
  return (
    <div className="spider-legend">
      {items.map(({ label, color }) => (
        <span key={label} className="spider-legend-item">
          <span className="spider-legend-dot" style={{ background: color }} />
          {label}
        </span>
      ))}
      <span className="spider-legend-item">
        <span className="spider-legend-dash" />
        temporal anomaly
      </span>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function SpiderDemo() {
  const { data: rawData, loading, error } = useSystemsAnalysis(DEMO_COUNTRY);

  const graphData = useMemo(() => curateData(rawData), [rawData]);

  const nodeMap = useMemo(() => {
    if (!graphData?.nodes) return {};
    return graphData.nodes.reduce((m, n) => { m[n.threadId] = n; return m; }, {});
  }, [graphData]);

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState(null);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
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

  const hasPanel = !!(selectedNode || selectedEdge);
  const temporalFlagCount = graphData?.edges?.filter(e => e._temporalFlag).length || 0;

  return (
    <div className="spider-demo">
      <div className="spider-header">
        <div className="spider-header-row">
          <h1 className="spider-title">Causal Web — Iran</h1>
          <span className="spider-prototype-badge">⚠ prototype — throwaway</span>
        </div>
        <p className="spider-subtitle">
          Force-layout causal graph from live systems-analysis data.
          Nodes = narrative threads (click for genesis + scenario). Edges = validated cause→effect links (click for mechanism + citations).
        </p>
        <Legend />
      </div>

      <div className={`spider-body${hasPanel ? ' spider-body--split' : ''}`}>
        <div className="spider-graph-area">
          {loading && (
            <div className="spider-loading">
              <span className="spider-loading-dot" />
              Loading Iran systems analysis…
            </div>
          )}
          {error && (
            <div className="spider-error">
              <strong>Error loading data:</strong> {error}
              <div className="spider-error-hint">Check that window.SENSITIVE_PROXY_ENDPOINT is configured (public/config.js in dev).</div>
            </div>
          )}
          {!loading && !error && graphData && graphData.nodes.length === 0 && (
            <div className="spider-empty">No graph data returned for Iran.</div>
          )}
          {!loading && graphData && graphData.nodes.length > 0 && (
            <SpiderGraph
              graphData={graphData}
              selectedNodeId={selectedNode?.threadId}
              selectedEdgeId={selectedEdgeKey}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          )}
        </div>

        {selectedNode && (
          <NodePanel node={selectedNode} onClose={closePanel} />
        )}
        {selectedEdge && (
          <EdgePanel edge={selectedEdge} nodeMap={nodeMap} onClose={closePanel} />
        )}
      </div>

      {graphData && !loading && (
        <div className="spider-footer">
          {graphData.nodes.length} nodes · {graphData.edges.length} edges
          {temporalFlagCount > 0 && (
            <span className="spider-footer-flag"> · {temporalFlagCount} temporal anomaly flagged (dashed, ⚠)</span>
          )}
          {graphData.generatedAt && (
            <span className="spider-footer-ts"> · generated {graphData.generatedAt}</span>
          )}
        </div>
      )}
    </div>
  );
}
