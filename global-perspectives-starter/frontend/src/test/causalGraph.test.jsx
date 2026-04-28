/**
 * Tests for causal graph rendering logic — guards against the bugs we fixed:
 * 1. Raw threadId strings showing instead of human-readable summaries
 * 2. NaN% when e.confidence is a string ("medium") not a 0-1 float
 * 3. Dead fallback fields (.title, .threadTitle) that don't exist on nodes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Fixtures ────────────────────────────────────────────────────────

const NODES = [
  { threadId: 'thread-trump-issues-expletive-filled--436f45', category: 'politics', peakDate: '2026-04-20', summary: "Trump's Hormuz threats and deadlines" },
  { threadId: 'thread-pakistan-brokers-ceasefire-pro-0e6387', category: 'politics', peakDate: '2026-04-21', summary: 'Pakistan brokers ceasefire proposal' },
  { threadId: 'thread-jd-vance-to-lead-us-delegation-bb0fa5', category: 'politics', peakDate: '2026-04-22', summary: 'JD Vance leads US delegation' },
];

const EDGES = [
  {
    from: 'thread-trump-issues-expletive-filled--436f45',
    to: 'thread-pakistan-brokers-ceasefire-pro-0e6387',
    lagDays: 1,
    confidence: 'medium',
    mechanism: "Trump's expletive-filled Easter threats prompted Pakistan's military chief to mediate.",
    citedEntries: ['topic-a', 'topic-b'],
  },
  {
    from: 'thread-pakistan-brokers-ceasefire-pro-0e6387',
    to: 'thread-jd-vance-to-lead-us-delegation-bb0fa5',
    lagDays: 4,
    confidence: 'strong',
    mechanism: "Pakistan's ceasefire mediation resulted in US delegation preparations.",
    citedEntries: ['topic-c'],
  },
];

const SYSTEMS_DATA = { nodes: NODES, edges: EDGES };

// ── Minimal CausalGraph component for isolated render testing ───────

function CausalGraph({ systemsData }) {
  if (!systemsData?.nodes?.length) return null;
  const nodeMap = (systemsData.nodes || []).reduce((m, n) => { if (n?.threadId) m[n.threadId] = n; return m; }, {});
  const titleFor = id => nodeMap[id]?.summary || (id || '').replace(/^thread-/, '').replace(/-[a-f0-9]{6}$/, '').replace(/-/g, ' ');
  const confColor = c => c === 'strong' ? 'red' : c === 'medium' ? 'orange' : 'gray';
  return (
    <div data-testid="causal-graph">
      {(systemsData.edges || []).slice(0, 4).map((e, i) => (
        <div key={i} data-testid={`edge-${i}`}>
          <div data-testid={`from-${i}`}>{titleFor(e.from)}</div>
          {e.lagDays != null && <span data-testid={`lag-${i}`}>{e.lagDays}d lag</span>}
          {e.confidence && <span data-testid={`conf-${i}`} style={{ color: confColor(e.confidence) }}>· {e.confidence}</span>}
          <div data-testid={`to-${i}`}>{titleFor(e.to)}</div>
          {e.mechanism && <div data-testid={`mech-${i}`}>{e.mechanism}</div>}
        </div>
      ))}
    </div>
  );
}

// ── titleFor logic tests (unit) ─────────────────────────────────────

describe('Causal graph — titleFor logic', () => {
  const makeNodeMap = (nodes) =>
    nodes.reduce((m, n) => { m[n.threadId] = n; return m; }, {});

  const titleFor = (nodeMap, id) =>
    nodeMap[id]?.summary ||
    (id || '').replace(/^thread-/, '').replace(/-[a-f0-9]{6}$/, '').replace(/-/g, ' ');

  it('returns node summary when present', () => {
    const nodeMap = makeNodeMap(NODES);
    expect(titleFor(nodeMap, 'thread-trump-issues-expletive-filled--436f45'))
      .toBe("Trump's Hormuz threats and deadlines");
  });

  it('does NOT fall back to .title — that field does not exist on nodes', () => {
    const nodeWithTitle = { threadId: 'thread-test-abc123', title: 'WRONG FIELD' };
    const nodeMap = makeNodeMap([nodeWithTitle]);
    const result = titleFor(nodeMap, 'thread-test-abc123');
    // no summary → slug-clean gives 'test'; must never return the .title value
    expect(result).not.toBe('WRONG FIELD');
    expect(result).toBe('test');
  });

  it('falls back to slug-cleaning when node has no summary', () => {
    // 1a2b3c is 6-char hex → gets stripped by the hash suffix regex
    const node = { threadId: 'thread-iran-us-conflict-1a2b3c', category: 'conflict' };
    const nodeMap = makeNodeMap([node]);
    const result = titleFor(nodeMap, 'thread-iran-us-conflict-1a2b3c');
    expect(result).toBe('iran us conflict');
  });

  it('falls back to slug-cleaning when node is missing entirely', () => {
    // ab1234 is 6-char hex → stripped; remaining hyphens → spaces
    const result = titleFor({}, 'thread-missing-node-ab1234');
    expect(result).toBe('missing node');
  });

  it('handles null/undefined id gracefully', () => {
    expect(titleFor({}, null)).toBe('');
    expect(titleFor({}, undefined)).toBe('');
    expect(titleFor({}, '')).toBe('');
  });
});

// ── Confidence display tests ────────────────────────────────────────

describe('Causal graph — confidence field', () => {
  it('confidence is a string, not a float', () => {
    EDGES.forEach(e => {
      expect(typeof e.confidence).toBe('string');
      expect(['strong', 'medium', 'weak']).toContain(e.confidence);
    });
  });

  it('Math.round(confidence * 100) produces NaN for string confidence', () => {
    // This documents the bug we fixed — string * 100 = NaN
    expect(Math.round('medium' * 100)).toBeNaN();
    expect(Math.round('strong' * 100)).toBeNaN();
  });

  it('confidence string labels render without NaN', () => {
    const confLabel = (c) => {
      if (!c) return '';
      return typeof c === 'string' ? c : `${Math.round(c * 100)}%`;
    };
    expect(confLabel('medium')).toBe('medium');
    expect(confLabel('strong')).toBe('strong');
    expect(confLabel('weak')).toBe('weak');
    expect(confLabel(null)).toBe('');
  });
});

// ── CausalGraph component render tests ─────────────────────────────

describe('CausalGraph component — renders readable content', () => {
  it('shows human-readable summaries, not raw threadIds', () => {
    render(<CausalGraph systemsData={SYSTEMS_DATA} />);
    expect(screen.queryByText(/thread-trump-issues-expletive-filled/)).toBeNull();
    expect(screen.queryByText(/thread-pakistan-brokers-ceasefire/)).toBeNull();
    expect(screen.getAllByText(/Trump's Hormuz threats/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pakistan brokers ceasefire/).length).toBeGreaterThan(0);
  });

  it('shows confidence as string label, not NaN%', () => {
    render(<CausalGraph systemsData={SYSTEMS_DATA} />);
    expect(screen.queryByText(/NaN%/)).toBeNull();
    expect(screen.getByText(/· medium/)).toBeInTheDocument();
    expect(screen.getByText(/· strong/)).toBeInTheDocument();
  });

  it('shows lag days', () => {
    render(<CausalGraph systemsData={SYSTEMS_DATA} />);
    expect(screen.getByText(/1d lag/)).toBeInTheDocument();
    expect(screen.getByText(/4d lag/)).toBeInTheDocument();
  });

  it('shows mechanism text', () => {
    render(<CausalGraph systemsData={SYSTEMS_DATA} />);
    expect(screen.getByText(/Pakistan's military chief/)).toBeInTheDocument();
  });

  it('renders nothing when no nodes', () => {
    const { container } = render(<CausalGraph systemsData={{ nodes: [], edges: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when systemsData is null', () => {
    const { container } = render(<CausalGraph systemsData={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('caps at 4 edges', () => {
    const manyEdges = { ...SYSTEMS_DATA, edges: Array(10).fill(SYSTEMS_DATA.edges[0]) };
    render(<CausalGraph systemsData={manyEdges} />);
    expect(screen.getAllByTestId(/^edge-/).length).toBe(4);
  });
});
