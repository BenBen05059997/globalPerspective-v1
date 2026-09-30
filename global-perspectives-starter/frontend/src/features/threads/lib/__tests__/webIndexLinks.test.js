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
