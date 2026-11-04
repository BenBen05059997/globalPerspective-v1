import { describe, it, expect } from 'vitest';
import { viewHasNoForecast, topicHasNoForecast } from '@/features/home/lib/noForecast';

const entry = (id, notes, generationId = 'g1') => ({ topicId: id, generationId, notes });
const view = (entries, latest = { topicIds: ['a', 'b', 'c'], generationId: 'g1' }) => ({ schemaVersion: 1, entries, latest });

describe('viewHasNoForecast', () => {
  it('true for a topic of the latest run whose notes have no prediction', () => {
    const v = view([entry('a', { summary: {}, trace_cause: {} }), entry('b', { summary: {}, prediction: {} })]);
    expect(viewHasNoForecast(v, 'a')).toBe(true);
    expect(viewHasNoForecast(v, 'b')).toBe(false);
  });
  it('false whenever the view cannot prove it', () => {
    expect(viewHasNoForecast(null, 'a')).toBe(false);
    expect(viewHasNoForecast({ schemaVersion: 2, entries: [] }, 'a')).toBe(false);
    expect(viewHasNoForecast(view([entry('a', { summary: {} })], { topicIds: ['z'], generationId: 'g1' }), 'a')).toBe(false); // not in the latest run
    expect(viewHasNoForecast(view([entry('a', { summary: {} }, 'old')]), 'a')).toBe(false); // entry of another run
    expect(viewHasNoForecast(view([entry('a', undefined)]), 'a')).toBe(false); // no notes written yet
    expect(viewHasNoForecast(view([entry('a', {})]), 'a')).toBe(false);
    expect(viewHasNoForecast(view([]), 'a')).toBe(false);
  });
});

describe('topicHasNoForecast', () => {
  const v = view([entry('a', { summary: {} })]);
  it('asks the view only while the record views are fresh', async () => {
    expect(await topicHasNoForecast('a', { fresh: async () => ({ fresh: true }), load: async () => v })).toBe(true);
    let loaded = false;
    const stale = await topicHasNoForecast('a', { fresh: async () => ({ fresh: false }), load: async () => { loaded = true; return v; } });
    expect(stale).toBe(false);
    expect(loaded).toBe(false);
  });
});
