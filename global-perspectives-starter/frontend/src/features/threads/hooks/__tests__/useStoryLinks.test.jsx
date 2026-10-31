// FED INTO reads the story-web index in ONE call shared with every other surface; it falls back to the
// old per-region reads only when the web_index request itself fails; empty states carry the real reason.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWebIndex: vi.fn(), fetchSystemsAnalysis: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchLinksView: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchLinksView: (...a) => rv.fetchLinksView(...a) }) }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/errorSink.js', () => sink);
vi.mock('@/shared/api/errorSink', () => sink);

import { useStoryLinks } from '@/features/threads/hooks/useStoryLinks.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const fresh = new Date(Date.now() - 3600 * 1000).toISOString();
const index = {
  generatedAt: fresh, targets: { count: 10 }, websUsed: [{ country: 'Iran', generatedAt: fresh, nodes: 4 }],
  threads: { A: { state: 'linked', title: 'Story A', places: [{ name: 'Iran', n: 3 }] }, B: { state: 'linked', title: 'Story B', places: [{ name: 'Israel', n: 2 }] }, D: { state: 'single_update', title: 'D', places: [] } },
  links: [{ from: 'A', to: 'B', confidence: 'strong', lagDays: 3, mechanism: 'm', cited: [{ topicId: 't', date: '2026-09-20', title: 'Cited' }], country: 'Iran', generatedAt: fresh }],
};

beforeEach(() => {
  clearMemoryCache(); api.fetchWebIndex.mockReset(); api.fetchSystemsAnalysis.mockReset(); sink.reportFetchError.mockReset();
  rv.fetchLinksView.mockReset(); rv.fetchLinksView.mockResolvedValue(null); // no links view yet: the web_index tests below
});

describe('useStoryLinks', () => {
  it('one web_index call gives the links, and a second story reuses the cache (no second call)', async () => {
    api.fetchWebIndex.mockResolvedValue({ success: true, data: index });
    const a = renderHook(() => useStoryLinks('A', ['Iran']));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(a.result.current.state).toBe('linked');
    expect(a.result.current.fedInto[0]).toMatchObject({ targetThreadId: 'B', targetTitle: 'Story B', confidence: 'strong' });
    expect(a.result.current.note).toBeNull();
    const d = renderHook(() => useStoryLinks('D', ['Peru']));
    await waitFor(() => expect(d.result.current.loading).toBe(false));
    expect(d.result.current.note.key).toBe('single_update');
    expect(api.fetchWebIndex).toHaveBeenCalledTimes(1);
    expect(api.fetchSystemsAnalysis).not.toHaveBeenCalled();
  });

  it('no index built yet: honest "not built yet" note, no fake links, no fallback fan-out', async () => {
    api.fetchWebIndex.mockResolvedValue({ success: true, data: null });
    const { result } = renderHook(() => useStoryLinks('A', ['Iran']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.fedInto).toEqual([]);
    expect(result.current.note.lines[0]).toBe('Story links have not been built yet.');
    expect(api.fetchSystemsAnalysis).not.toHaveBeenCalled();
  });

  it('only when the web_index request FAILS does it fall back to the region reads', async () => {
    api.fetchWebIndex.mockRejectedValue(new Error('unknown action'));
    api.fetchSystemsAnalysis.mockResolvedValue({ success: true, data: { generatedAt: fresh, nodes: [{ threadId: 'A' }, { threadId: 'B', summary: 'B story' }], edges: [{ from: 'A', to: 'B', confidence: 'medium', lagDays: 2, mechanism: 'm', citedEntries: ['x'] }] } });
    const { result } = renderHook(() => useStoryLinks('A', ['Iran']));
    await waitFor(() => expect(result.current.fedInto.length).toBe(1));
    expect(api.fetchSystemsAnalysis).toHaveBeenCalledWith('Iran');
    expect(result.current.note).toBeNull();
  });

  it('no threadId: nothing is fetched', () => {
    const { result } = renderHook(() => useStoryLinks(null, []));
    expect(result.current.fedInto).toEqual([]);
    expect(api.fetchWebIndex).not.toHaveBeenCalled();
  });

  describe('the record links view first', () => {
    const view = (state, over = {}) => ({
      threadId: 'A', judgedLinks: [{ otherThreadId: 'B', otherTitle: 'View B', from: 'A', to: 'B', country: 'Iran', confidence: 'strong', lagDays: 3, mechanism: 'm', cited: [{ topicId: 't', date: '2026-09-20', title: 'Cited' }], generatedAt: fresh }],
      web: { state, entries: 3, places: [{ name: 'Peru', n: 3 }], analysedIn: state === 'country_not_analysed' ? [] : [{ country: 'Iran', iso3: 'IRN', generatedAt: fresh, nodes: 4 }], backbone: [], otherPlaces: { B: [{ name: 'Israel', n: 2 }] } },
      ...over,
    });

    it('answers from the view with no web_index call', async () => {
      rv.fetchLinksView.mockResolvedValue(view('linked'));
      const { result } = renderHook(() => useStoryLinks('A', ['Iran']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state).toBe('linked');
      expect(result.current.fedInto[0]).toMatchObject({ targetThreadId: 'B', targetTitle: 'View B', confidence: 'strong' });
      expect(result.current.index.threads.B.places[0].name).toBe('Israel'); // the map arcs read the neighbours' places from it
      expect(api.fetchWebIndex).not.toHaveBeenCalled();
    });

    it('a missing view (404) or a view without `web` falls back to web_index', async () => {
      api.fetchWebIndex.mockResolvedValue({ success: true, data: index });
      const a = renderHook(() => useStoryLinks('A', ['Iran']));
      await waitFor(() => expect(a.result.current.fedInto.length).toBe(1));
      expect(a.result.current.fedInto[0].targetTitle).toBe('Story B');
      rv.fetchLinksView.mockResolvedValue({ ...view('linked'), threadId: 'D', web: undefined });
      const d = renderHook(() => useStoryLinks('D', ['Peru']));
      await waitFor(() => expect(d.result.current.note?.key).toBe('single_update'));
      expect(sink.reportFetchError).not.toHaveBeenCalled();
    });

    it('a failed view read is reported and falls back to web_index', async () => {
      rv.fetchLinksView.mockRejectedValue(new Error('record view 500'));
      api.fetchWebIndex.mockResolvedValue({ success: true, data: index });
      const { result } = renderHook(() => useStoryLinks('A', ['Iran']));
      await waitFor(() => expect(result.current.fedInto.length).toBe(1));
      expect(sink.reportFetchError).toHaveBeenCalledWith('links-view', expect.any(Error));
    });

    it('country_not_analysed: the view answers, web_index is read only for the run\'s country count', async () => {
      rv.fetchLinksView.mockResolvedValue(view('country_not_analysed', { judgedLinks: [] }));
      api.fetchWebIndex.mockResolvedValue({ success: true, data: index });
      const { result } = renderHook(() => useStoryLinks('A', ['Peru']));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.note.key).toBe('country_not_analysed');
      expect(result.current.note.lines[0]).toMatch(/built for the 10 most-covered countries in each run; Peru was not among them/);
      expect(api.fetchWebIndex).toHaveBeenCalledTimes(1);
    });
  });
});
