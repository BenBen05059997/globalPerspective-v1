'use strict';

// Event Dossier assembler — pure, deterministic, no AWS/LLM.
// Turns a stored systems_analysis graph into the AI-legible "event dossier"
// contract (see repo EVENT_DOSSIER_SPEC.md): the focal event's k-hop
// neighborhood + provenance tags + anomaly flags + scope/coverage caveats +
// a grounding contract. Genesis (per-node timelines) is injected by the caller
// (it needs DynamoDB reads), so this stays a pure function that's easy to test.

const CONTRACT_INSTRUCTIONS =
  'Reason ONLY over this subgraph plus the cited sources. Cite entry titles for any factual claim. '
  + "Label anything beyond the sources as 'model judgment'. Confidence is ordinal (weak/medium/strong), never a fabricated %. "
  + 'Edges flagged temporal_anomaly are co-movement, NOT proven causation — do not assert their direction.';

// citedEntries from the backend are "headline-N" strings — strip the trailing index.
function citationTitle(raw) {
  return typeof raw === 'string' ? raw.replace(/-\d+$/, '').trim() : String(raw || '');
}

// Build adjacency over BOTH layers (causal + backbone) so hop-expansion follows
// any real connection, then BFS out to `hops` from the focal node.
function subgraphIds(focalId, causal, backbone, hops) {
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a).add(b);
  };
  for (const e of [...causal, ...backbone]) {
    if (!e || e.from == null || e.to == null) continue;
    link(e.from, e.to);
    link(e.to, e.from);
  }
  const inSub = new Set([focalId]);
  let frontier = [focalId];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const id of frontier) {
      for (const nb of (adj.get(id) || [])) {
        if (!inSub.has(nb)) { inSub.add(nb); next.push(nb); }
      }
    }
    frontier = next;
  }
  return inSub;
}

/**
 * @param {object} graph   stored { nodes, edges, backbone, generatedAt }
 * @param {string} focalId threadId to center the dossier on
 * @param {object} opts    { hops=1, countryName, asOf, genesisByThread={} }
 * @returns {object|null}  dossier, or null if focalId isn't in the graph
 */
function assembleDossier(graph, focalId, opts = {}) {
  const { hops = 1, countryName = null, asOf = null, genesisByThread = {} } = opts;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const causal = Array.isArray(graph?.edges) ? graph.edges : [];
  const backbone = Array.isArray(graph?.backbone) ? graph.backbone : [];

  const byId = new Map(nodes.map(n => [n.threadId, n]));
  if (!byId.has(focalId)) return null;

  const inSub = subgraphIds(focalId, causal, backbone, Math.max(1, hops));
  const inSet = (id) => inSub.has(id);

  const dates = nodes.map(n => n.peakDate).filter(Boolean).sort();
  const asOfDate = asOf || dates[dates.length - 1] || null;

  const outNodes = [...inSub].filter(id => byId.has(id)).map(id => {
    const n = byId.get(id);
    return {
      id: n.threadId,
      is_focal: id === focalId,
      headline: n.title || n.summary || n.threadId,
      summary: n.summary || null,
      category: n.category || null,
      actors: Array.isArray(n.actors) ? n.actors : [],
      time: { peak: n.peakDate || null },
      genesis: genesisByThread[id] || null,
      provenance: 'sourced',
    };
  });

  const outEdges = causal.filter(e => inSet(e.from) && inSet(e.to)).map(e => ({
    from: e.from,
    to: e.to,
    class: 'causal',
    relation: e.relation || 'inferred_influence',
    mechanism: e.mechanism || null,
    lag_days: e.lagDays ?? null,
    confidence: e.confidence || null,
    provenance: 'judgment',
    citations: (Array.isArray(e.citedEntries) ? e.citedEntries : []).map(c => ({ title: citationTitle(c) })),
    flags: { temporal_anomaly: e.lagDays != null && e.lagDays < 0 },
  }));

  const outBackbone = backbone.filter(e => inSet(e.from) && inSet(e.to)).map(e => ({
    from: e.from,
    to: e.to,
    class: 'backbone',
    relation: e.relation || 'shared_actor',
    shared_actors: Array.isArray(e.sharedActors) ? e.sharedActors : [],
    weight: e.weight ?? (Array.isArray(e.sharedActors) ? e.sharedActors.length : null),
    directed: false,
    provenance: 'sourced',
  }));

  return {
    dossier_version: '1',
    focal_event: focalId,
    scope: {
      country: countryName,
      window_days: 30,
      as_of: asOfDate,
      hop_depth: Math.max(1, hops),
      coverage_caveat: 'single country; rolling 30 days; Western-RSS-weighted corpus',
    },
    generated_from: graph?.generatedAt || null,
    nodes: outNodes,
    edges: outEdges,
    backbone: outBackbone,
    reasoning_contract: {
      instructions: CONTRACT_INSTRUCTIONS,
      provenance_legend: {
        sourced: 'from our archive',
        judgment: 'labeled interpretation, uncited',
      },
    },
  };
}

module.exports = { assembleDossier, subgraphIds, citationTitle };
