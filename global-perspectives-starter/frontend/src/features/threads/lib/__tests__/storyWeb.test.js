// P7b (2026-10-02): the Stories WEB view's pure logic: merge / dedupe, 30-day hiding and counts,
// footnote numbers, peak date, top-N, lanes + x positions, list order. Hand-checked fixtures.
import { describe, it, expect } from 'vitest';
import {
  mergeWebLinks, webFootnote, peakDate, pickWebNodes, layoutWeb, strongestLinks, nodeLinkWords, webDateLabel,
  WEB_DEFAULT_NODES, LANE_ORDER,
} from '@/features/threads/lib/storyWeb.js';

const NOW = Date.parse('2026-10-02T12:00:00Z');
const D0 = '2026-10-01T05:00:00Z'; // 1 day: fresh
const D10 = '2026-09-22T05:00:00Z'; // 10 days: older (amber)
const D40 = '2026-08-23T05:00:00Z'; // 40 days: hidden
const L = (from, to, confidence, country, generatedAt, extra = {}) => ({ from, to, confidence, country, generatedAt, lagDays: 3, mechanism: `${country}: ${from} to ${to}`, cited: [], ...extra });

const index = {
  websUsed: [
    { country: 'Iran', generatedAt: D0, nodes: 6 },
    { country: 'US', generatedAt: D0, nodes: 15 },
    { country: 'Japan', generatedAt: D10, nodes: 5 },
    { country: 'Venezuela', generatedAt: D40, nodes: 4 },
  ],
  links: [
    L('A', 'B', 'weak', 'Iran', D0, { cited: [{ title: 'Older cite', date: '2026-09-01' }, { topicId: 'no-title-1' }] }),
    L('A', 'B', 'strong', 'US', D0, { cited: [{ title: 'Newer cite', date: '2026-09-20' }, { title: 'Older cite', date: '2026-09-01' }] }),
    L('B', 'C', 'medium', 'Japan', D10),
    L('C', 'A', 'medium', 'Venezuela', D40), // hidden: 40 days
    L('A', 'A', 'strong', 'US', D0), // self link: ignored
    L('', 'B', 'strong', 'US', D0), // no from: ignored
  ],
};

describe('mergeWebLinks', () => {
  const m = mergeWebLinks(index, NOW);
  it('dedupes by from->to, keeps the strongest confidence, counts the analyses, and drops hidden / self / empty rows', () => {
    expect(m.edges.map((e) => e.key).sort()).toEqual(['A->B', 'B->C']);
    const ab = m.edges.find((e) => e.key === 'A->B');
    expect(ab.confidence).toBe('strong');
    expect(ab.webs).toHaveLength(2);
    // each analysis keeps its OWN word (never the max), strongest first
    expect(ab.webs.map((w) => [w.country, w.confidence])).toEqual([['US', 'strong'], ['Iran', 'weak']]);
    expect(m.hiddenLinks).toBe(1);
  });
  it('the mechanism is verbatim from the strongest analysis; cites are the union with a headline, newest first, no duplicates', () => {
    const ab = m.edges.find((e) => e.key === 'A->B');
    expect(ab.mechanism).toBe('US: A to B');
    expect(ab.mechanismCountry).toBe('US');
    expect(ab.cited).toEqual([{ title: 'Newer cite', date: '2026-09-20' }, { title: 'Older cite', date: '2026-09-01' }]);
  });
  it('older flag (amber) only when EVERY analysis behind the edge is older than 7 days', () => {
    expect(m.edges.find((e) => e.key === 'A->B').older).toBe(false);
    expect(m.edges.find((e) => e.key === 'B->C').older).toBe(true);
  });
  it('analyses: merged = used, hidden = older than 30 days, newest = the newest used analysis', () => {
    expect(m.analyses).toMatchObject({ merged: 3, hidden: 1, total: 4, newest: new Date(D0).toISOString() });
  });
  it('without websUsed the analyses are derived from the link rows (country + generatedAt)', () => {
    const { websUsed, ...rest } = index; // eslint-disable-line no-unused-vars
    const d = mergeWebLinks(rest, NOW);
    expect(d.analyses.merged).toBe(3); // Iran, US, Japan (Venezuela hidden; US counted once)
    expect(d.analyses.hidden).toBe(1);
  });
  it('same pair, opposite direction = two edges; an empty / missing index merges to nothing', () => {
    const both = mergeWebLinks({ links: [L('A', 'B', 'weak', 'X', D0), L('B', 'A', 'weak', 'X', D0)] }, NOW);
    expect(both.edges).toHaveLength(2);
    expect(mergeWebLinks(null, NOW)).toMatchObject({ edges: [], analyses: { merged: 0, hidden: 0, newest: null } });
  });
  it('the 30-day edge: 29 days stays, 31 days is hidden', () => {
    const at = (days) => new Date(NOW - days * 86400000).toISOString();
    expect(mergeWebLinks({ links: [L('A', 'B', 'weak', 'X', at(29))] }, NOW).edges).toHaveLength(1);
    expect(mergeWebLinks({ links: [L('A', 'B', 'weak', 'X', at(31))] }, NOW).edges).toHaveLength(0);
  });
});

describe('webFootnote', () => {
  it('is computed from the merge numbers and never says "caused" except as never caused', () => {
    const t = webFootnote({ merged: 3, hidden: 1, newest: D0 });
    expect(t).toBe('Dashed = model judgment (thicker = stronger) · never “caused” · merged from 3 analyses, newest Oct 1 · 1 older than 30 days hidden');
    expect(webFootnote({ merged: 1, hidden: 0, newest: D0 })).toContain('merged from 1 analysis, newest Oct 1 · 0 older');
    expect(webFootnote({ merged: 0, hidden: 2, newest: null })).toContain('merged from 0 analyses · 2 older');
    expect(webDateLabel('not a date')).toBeNull();
  });
});

const thread = (id, category, dates) => ({ threadId: id, category, entries: dates.map((date) => ({ date })), regions: [], sourceCount: 1 });

describe('peakDate', () => {
  it('= the day with the most entries; ties go to the latest; null with no dates', () => {
    expect(peakDate(thread('t', 'conflict', ['2026-09-01', '2026-09-03', '2026-09-03', '2026-09-02']))).toBe('2026-09-03');
    expect(peakDate(thread('t', 'conflict', ['2026-09-01', '2026-09-02']))).toBe('2026-09-02');
    expect(peakDate(thread('t', 'conflict', []))).toBeNull();
  });
});

const T = {
  A: thread('A', 'conflict', ['2026-09-01', '2026-09-01', '2026-09-02']), // peak 09-01
  B: thread('B', 'economy', ['2026-09-10']),
  C: thread('C', 'politics', ['2026-09-20', '2026-09-20']),
  D: thread('D', 'technology', ['2026-09-30']),
  E: thread('E', 'conflict', ['2026-09-05']),
  F: thread('F', null, []), // no archive day: not drawable
};
const E = (from, to, confidence = 'medium') => ({ key: `${from}->${to}`, from, to, confidence, webs: [{ country: 'X', confidence, generatedAt: D0 }], cited: [], newest: D0 });

describe('pickWebNodes', () => {
  const edges = [E('A', 'B'), E('A', 'C'), E('A', 'D'), E('B', 'C'), E('E', 'A'), E('Z', 'A'), E('F', 'A')];
  it('the N most-linked become nodes (degree = merged edges touching a story); ties -> later peak', () => {
    const r = pickWebNodes({ edges, threadsById: T, limit: 3 });
    expect(r.nodes.map((n) => [n.id, n.degree])).toEqual([['A', 4], ['C', 2], ['B', 2]]); // A: B, C, D, E (F has no day, Z not in the archive: not counted)
  });
  it('edges to stories outside the shown set (filtered / not in the archive / no date) are counted as outside, never drawn', () => {
    const r = pickWebNodes({ edges, threadsById: T, limit: 10 });
    expect(r.outside).toBe(2); // Z->A has no archive thread, F->A has no archive day
    expect(r.nodes.find((n) => n.id === 'F')).toBeUndefined(); // F has no peak day
    expect(r.edges.every((e) => e.from !== 'F' && e.to !== 'F' && e.from !== 'Z')).toBe(true);
  });
  it('limit cuts the node set and the edges follow; shownDegree counts only drawn edges', () => {
    const r = pickWebNodes({ edges, threadsById: T, limit: 2 });
    expect(r.nodes).toHaveLength(2);
    expect(r.edges.every((e) => r.nodes.some((n) => n.id === e.from) && r.nodes.some((n) => n.id === e.to))).toBe(true);
    expect(WEB_DEFAULT_NODES).toBe(14);
  });
  it('filters: only stories passed in threadsById can be nodes', () => {
    const r = pickWebNodes({ edges, threadsById: { A: T.A, B: T.B }, limit: 14 });
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
    expect(r.edges.map((e) => e.key)).toEqual(['A->B']);
  });
  it('no usable edges -> no nodes (nothing padded)', () => {
    expect(pickWebNodes({ edges: [E('Z', 'Y')], threadsById: T, limit: 14 }).nodes).toEqual([]);
  });
});

describe('layoutWeb', () => {
  const nodes = pickWebNodes({ edges: [E('A', 'B'), E('A', 'C'), E('A', 'D'), E('B', 'C'), E('E', 'A')], threadsById: T, limit: 14 }).nodes;
  const lay = layoutWeb(nodes);
  const pos = Object.fromEntries(lay.nodes.map((n) => [n.id, n]));
  it('lanes: only populated crisis types, in the fixed order (conflict, political, economic, ..., other)', () => {
    expect(lay.lanes.map((l) => l.key)).toEqual(['conflict', 'political', 'economic', 'neutral']);
    expect(lay.lanes.map((l) => l.key)).toEqual(LANE_ORDER.filter((k) => lay.lanes.some((l) => l.key === k)));
    expect(pos.A.lane).toBe('conflict'); expect(pos.C.lane).toBe('political'); expect(pos.B.lane).toBe('economic'); expect(pos.D.lane).toBe('neutral');
  });
  it('x = peak date on the nodes\' own span: first peak at the left pad, last at the right edge, proportional between', () => {
    expect(pos.A.x).toBeCloseTo(150); // 09-01 is the earliest peak
    expect(pos.D.x).toBeCloseTo(940); // 09-30 is the latest
    const frac = (Date.parse('2026-09-10') - Date.parse('2026-09-01')) / (Date.parse('2026-09-30') - Date.parse('2026-09-01'));
    expect(pos.B.x).toBeCloseTo(150 + frac * 790);
  });
  it('node size grows with degree and is clamped 12..30', () => {
    expect(pos.A.diameter).toBeGreaterThan(pos.D.diameter);
    for (const n of lay.nodes) { expect(n.diameter).toBeGreaterThanOrEqual(12); expect(n.diameter).toBeLessThanOrEqual(30); }
  });
  it('ticks are real day keys from the first to the last peak, at most 6', () => {
    expect(lay.ticks[0].date).toBe('2026-09-01');
    expect(lay.ticks.at(-1).date).toBe('2026-09-30');
    expect(lay.ticks.length).toBeLessThanOrEqual(6);
  });
  it('two nodes of one lane close in time take different rows; a single date centres', () => {
    const close = layoutWeb([
      { id: 'p', thread: thread('p', 'conflict', ['2026-09-01']), degree: 1, peak: '2026-09-01' },
      { id: 'q', thread: thread('q', 'conflict', ['2026-09-02']), degree: 1, peak: '2026-09-02' },
      { id: 'r', thread: thread('r', 'conflict', ['2026-09-30']), degree: 1, peak: '2026-09-30' },
    ]);
    const rows = Object.fromEntries(close.nodes.map((n) => [n.id, n.row]));
    expect(rows.p).not.toBe(rows.q);
    expect(rows.r).toBe(0);
    const one = layoutWeb([{ id: 'p', thread: thread('p', 'conflict', ['2026-09-01']), degree: 1, peak: '2026-09-01' }]);
    expect(one.nodes[0].x).toBeCloseTo((150 + 940) / 2);
    expect(one.ticks).toHaveLength(1);
  });
});

describe('strongestLinks / nodeLinkWords', () => {
  it('orders by strongest word, then more analyses, then newest', () => {
    const a = { ...E('a', 'b', 'weak'), webs: [{}, {}, {}] };
    const b = E('b', 'c', 'strong');
    const c = { ...E('c', 'd', 'medium'), webs: [{}, {}] };
    const d = E('d', 'e', 'medium');
    expect(strongestLinks([a, d, c, b]).map((e) => e.key)).toEqual(['b->c', 'c->d', 'd->e', 'a->b']);
  });
  it('node words say judged to feed into / fed by with the strongest word, or nothing without links', () => {
    const edges = [E('A', 'B', 'weak'), E('A', 'C', 'strong'), E('D', 'A', 'medium')];
    expect(nodeLinkWords('A', edges)).toBe('judged to feed into 2, judged fed by 1 · strongest strong (model judgment)');
    expect(nodeLinkWords('B', edges)).toBe('judged fed by 1 · strongest weak (model judgment)');
    expect(nodeLinkWords('Q', edges)).toBeNull();
  });
});
