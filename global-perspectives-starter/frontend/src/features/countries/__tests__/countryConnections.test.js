import { describe, it, expect } from 'vitest';
import { connectionRows, lagText } from '@/features/countries/lib/countryConnections.js';

const NOW = Date.parse('2026-10-20T00:00:00Z');
const link = (from, to, extra = {}) => ({ from, to, confidence: 'medium', lagDays: 2, mechanism: 'm', generatedAt: '2026-10-19T00:00:00Z', country: 'Iran', cited: [{ topicId: 'x', title: 'Cited', date: '2026-10-18' }], ...extra });
const index = (links) => ({ links, shared: [], threads: { a: { title: 'A story', state: 'linked' }, b: { title: 'B story' }, c: { title: 'C story' } } });

describe('lagText', () => {
  it('shows the lag only when it is a real non-negative number', () => {
    expect(lagText(3)).toBe('lag 3d');
    expect(lagText(0)).toBe('lag 0d');
    expect(lagText(-2)).toBe('order unclear');
    expect(lagText(null)).toBe('order unclear');
    expect(lagText(undefined)).toBe('order unclear');
  });
});

describe('connectionRows', () => {
  const arcs = [{ threadId: 'a', latestTitle: 'A headline' }];
  it('is empty without an index or without links', () => {
    expect(connectionRows(null, arcs, { now: NOW })).toEqual([]);
    expect(connectionRows(index([]), arcs, { now: NOW })).toEqual([]);
  });
  it('turns a link from one of the arcs into a "feeds into" row with its cited headlines', () => {
    const [r] = connectionRows(index([link('a', 'b')]), arcs, { now: NOW });
    expect(r).toMatchObject({ fromId: 'a', fromTitle: 'A headline', toId: 'b', toTitle: 'B story', lag: 'lag 2d', mechanism: 'm' });
    expect(r.cited).toHaveLength(1);
  });
  it('shows a negative lag as "order unclear", one row per pair, strongest first', () => {
    const rows = connectionRows(index([link('a', 'b', { lagDays: -1, confidence: 'weak' }), link('a', 'b', { lagDays: -1, confidence: 'weak', country: 'Ukraine' }), link('a', 'c', { confidence: 'strong' })]), arcs, { now: NOW });
    expect(rows.map((r) => r.toId)).toEqual(['c', 'b']);
    expect(rows[1].lag).toBe('order unclear');
  });
  it('ignores links that start elsewhere', () => {
    expect(connectionRows(index([link('b', 'c')]), arcs, { now: NOW })).toEqual([]);
  });
});
