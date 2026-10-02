import { describe, it, expect } from 'vitest';
import { deriveFromIndex, distinctTargets } from '@/features/threads/lib/webIndexLinks.js';

const NOW = Date.parse('2026-10-01T06:00:00Z');
const fresh = '2026-09-30T05:00:00Z';
const older = '2026-09-20T05:00:00Z'; // 11 days
const stale = '2026-08-20T05:00:00Z'; // 42 days
const cited = [{ topicId: 'x1', date: '2026-09-20', title: 'Cited headline' }];
const link = (from, to, conf, extra = {}) => ({ from, to, confidence: conf, lagDays: 4, mechanism: `${from}->${to}`, cited, country: 'Iran', generatedAt: fresh, ...extra });
const index = {
  generatedAt: fresh, targets: { count: 10 },
  threads: { A: { state: 'linked', title: 'Story A' }, B: { state: 'linked', title: 'Story B' }, C: { state: 'analysed_no_links', title: 'Story C' }, D: { state: 'single_update', title: 'D' } },
  links: [link('A', 'B', 'strong'), link('A', 'B', 'weak', { country: 'Israel' }), link('C0', 'A', 'medium', { country: 'US' }), link('A', 'Z', 'medium', { generatedAt: stale }), link('A', 'Y', 'weak', { generatedAt: older })],
};

describe('deriveFromIndex', () => {
  it('outgoing links become fedInto rows with the other story\'s title, dated cites and freshness', () => {
    const d = deriveFromIndex(index, 'A', NOW);
    expect(d.state).toBe('linked');
    const b = d.fedInto.filter((r) => r.targetThreadId === 'B');
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ targetTitle: 'Story B', confidence: 'strong', country: 'Iran', freshness: 'fresh', lagDays: 4 });
    expect(b[0].cited[0]).toMatchObject({ date: '2026-09-20', title: 'Cited headline' });
  });
  it('two webs on the same pair are two rows with their OWN confidence (never the max), and count as one story', () => {
    const d = deriveFromIndex(index, 'A', NOW);
    expect(d.fedInto.filter((r) => r.targetThreadId === 'B').map((r) => r.confidence)).toEqual(['strong', 'weak']);
    expect(distinctTargets(d.fedInto)).toBe(2); // B and Y (Z is older than 30 days)
  });
  it('a link from a web older than 30 days is hidden; 7-30 days is flagged "older"', () => {
    const d = deriveFromIndex(index, 'A', NOW);
    expect(d.fedInto.find((r) => r.targetThreadId === 'Z')).toBeUndefined();
    expect(d.fedInto.find((r) => r.targetThreadId === 'Y').freshness).toBe('older');
  });
  it('incoming links become fedFrom rows', () => {
    const d = deriveFromIndex(index, 'A', NOW);
    expect(d.fedFrom).toHaveLength(1);
    expect(d.fedFrom[0]).toMatchObject({ sourceThreadId: 'C0', confidence: 'medium', country: 'US' });
  });
  it('a story with no links keeps the index state (analysed / single update); an unknown story is null; no index is "no_index"', () => {
    expect(deriveFromIndex(index, 'C', NOW)).toMatchObject({ state: 'analysed_no_links', fedInto: [], fedFrom: [] });
    expect(deriveFromIndex(index, 'D', NOW).state).toBe('single_update');
    expect(deriveFromIndex(index, 'nope', NOW).state).toBeNull();
    expect(deriveFromIndex(null, 'A', NOW)).toMatchObject({ state: 'no_index', hasIndex: false });
  });
  it('a story whose only links are older than 30 days reads as analysed with no links, not linked', () => {
    const idx = { ...index, threads: { ...index.threads, Q: { state: 'linked' } }, links: [link('Q', 'B', 'strong', { generatedAt: stale })] };
    expect(deriveFromIndex(idx, 'Q', NOW).state).toBe('analysed_no_links');
  });
});

describe('deriveFromIndex: shared actors, provenance, hidden older links (Read in full, P8)', () => {
  const sh = (a, b, actors, extra = {}) => ({ a, b, actors, weight: actors.length, country: 'Iran', generatedAt: fresh, ...extra });
  const idx = {
    ...index,
    shared: [
      sh('A', 'B', ['Donald Trump', 'Iran'], { country: 'United States' }),
      sh('B', 'A', ['iran', 'Strait of Hormuz'], { country: 'Israel', generatedAt: older }), // union, case-insensitive
      sh('A', 'C', ['Kyiv']),                                         // weight 1
      sh('A', 'Z', ['Donald Trump'], { generatedAt: stale }),         // hidden (42 days)
      sh('A', 'A', ['self']),                                         // never a self overlap
      sh('X', 'Y', ['Elsewhere']),                                    // not this story
    ],
  };
  const d = deriveFromIndex(idx, 'A', NOW);
  it('merges per other story: actors unioned (case-insensitive), weight = distinct actors, each analysis keeps its country and date', () => {
    const b = d.shared.find((r) => r.otherThreadId === 'B');
    expect(b.actors).toEqual(['Donald Trump', 'Iran', 'Strait of Hormuz']);
    expect(b.weight).toBe(3);
    expect(b.otherTitle).toBe('Story B');
    expect(b.webs.map((w) => w.country)).toEqual(['United States', 'Israel']);
    expect(d.shared.find((r) => r.otherThreadId === 'C').weight).toBe(1);
    expect(d.shared.map((r) => r.otherThreadId)).toEqual(['B', 'C']); // heavier first; Z (old), self and X dropped
  });
  it('counts what the 30-day rule hid, once per other story and kind', () => {
    // links A->Z (stale) + shared A,Z (stale) = two hidden links
    expect(d.hiddenOlder).toBe(2);
  });
  it('provenance = countries of the analyses behind the rows shown (newest first) and the newest date', () => {
    expect(d.provenance.asOf).toBe(new Date(fresh).toISOString());
    expect(d.provenance.countries).toEqual(expect.arrayContaining(['Iran', 'Israel', 'United States', 'US']));
    expect(d.provenance.countries).not.toContain('Elsewhere');
  });
  it('a story with nothing in the index has no shared rows, no hidden links and no provenance', () => {
    expect(deriveFromIndex(idx, 'D', NOW)).toMatchObject({ shared: [], hiddenOlder: 0, provenance: null });
    expect(deriveFromIndex(null, 'A', NOW)).toMatchObject({ shared: [], hiddenOlder: 0, provenance: null });
  });
});
