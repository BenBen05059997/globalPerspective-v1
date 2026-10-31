import { describe, it, expect } from 'vitest';
import { viewEntriesToThread } from '@/features/threads/lib/viewEntries.js';

const view = {
  threadId: 'thread-a',
  entries: [
    { eventId: 'e1', date: '2026-10-30', at: '2026-10-30T20:26:18.950Z', title: 'Canada and EU announce new alliance', category: 'politics', eventType: 'diplomacy',
      topicId: 'Canada and EU-4', iso3: ['CAN', 'XXX'], actors: ['Mark Carney'],
      sources: [{ sourceId: 's', outlet: 'The Guardian', url: 'https://www.theguardian.com/world/x', title: 'T', outletCountry: 'GB', outletType: 'national', tier: 'primary', snippet: 'Feed' },
        { sourceId: 't', outlet: null, url: 'https://www.example.org/y', title: 'U', outletCountry: null, outletType: null }],
      notes: { summary: { format: 'markdown', content: '- One line.', at: '2026-10-30T20:25:00Z', model: 'deepseek-flash' },
        cause: { format: 'json', content: { proximate: { what: 'x'.repeat(2000) } }, at: '2026-10-30T20:25:00Z', model: 'deepseek-flash' } } },
    { eventId: 'a1', kind: 'article', date: '2026-10-29', at: '2026-10-29T10:00:00Z', title: 'Recovered', sources: [] },
  ],
};

describe('viewEntriesToThread', () => {
  it('maps a story view to the archive entry shape the page reads', () => {
    const [e, ...rest] = viewEntriesToThread(view);
    expect(rest).toEqual([]); // recovered article rows are left out
    expect(e).toMatchObject({ topicId: 'Canada and EU-4', threadId: 'thread-a', date: '2026-10-30', category: 'politics', event_type: 'diplomacy',
      iso3: ['CAN', 'XXX'], regions: ['Canada'], actors: ['Mark Carney'], fromRecord: true });
    expect(e.sources).toEqual([
      { title: 'T', url: 'https://www.theguardian.com/world/x', source: 'The Guardian', outletCountry: 'GB', outletType: 'national', tier: 'primary', snippet: 'Feed' },
      { title: 'U', url: 'https://www.example.org/y', source: 'example.org', outletCountry: null, outletType: null }]);
  });

  it('turns entry notes into the ai text the archive held: markdown as is, json as text cut at 1,500 characters', () => {
    const [e] = viewEntriesToThread(view);
    expect(e.ai.summary).toBe('- One line.');
    expect(e.ai.prediction).toBeNull();
    expect(e.ai.trace_cause.startsWith('{"proximate":{"what":"xxx')).toBe(true);
    expect(e.ai.trace_cause.length).toBe(1503);
  });

  it('is empty and safe on a missing view, and an entry without notes has no ai', () => {
    expect(viewEntriesToThread(null)).toEqual([]);
    expect('ai' in viewEntriesToThread({ threadId: 't', entries: [{ ...view.entries[0], notes: undefined }] })[0]).toBe(false);
  });
});

describe('combineTimeline', async () => {
  const { combineTimeline } = await import('@/features/threads/hooks/useNarrativeThread.js');
  const built = { ...view, builtFrom: { factsThrough: '2026-10-30' } };
  const archive = [{ topicId: 'old', date: '2026-10-30', title: 'archive copy of a recorded day' }, { topicId: 'today', date: '2026-10-31', title: 'this morning' }];

  it('takes recorded days from the view and later days from the archive', () => {
    expect(combineTimeline(built, archive).map((e) => [e.date, e.fromRecord === true])).toEqual([['2026-10-30', true], ['2026-10-31', false]]);
  });

  it('uses the archive alone when the story has no view or no entries in it', () => {
    expect(combineTimeline(null, archive)).toBe(archive);
    expect(combineTimeline({ threadId: 't', entries: [], builtFrom: { factsThrough: '2026-10-30' } }, archive)).toBe(archive);
  });
});
