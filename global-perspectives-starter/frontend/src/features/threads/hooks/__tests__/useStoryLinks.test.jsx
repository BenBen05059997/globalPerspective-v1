// FED INTO reads the story-web index in ONE call shared with every other surface; it falls back to the
// old per-region reads only when the web_index request itself fails; empty states carry the real reason.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWebIndex: vi.fn(), fetchSystemsAnalysis: vi.fn() }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import { useStoryLinks } from '@/features/threads/hooks/useStoryLinks.js';
import { __resetWebIndexCache } from '@/features/threads/hooks/useWebIndex.js';

const fresh = new Date(Date.now() - 3600 * 1000).toISOString();
const index = {
  generatedAt: fresh, targets: { count: 10 }, websUsed: [{ country: 'Iran', generatedAt: fresh, nodes: 4 }],
  threads: { A: { state: 'linked', title: 'Story A', places: [{ name: 'Iran', n: 3 }] }, B: { state: 'linked', title: 'Story B', places: [{ name: 'Israel', n: 2 }] }, D: { state: 'single_update', title: 'D', places: [] } },
  links: [{ from: 'A', to: 'B', confidence: 'strong', lagDays: 3, mechanism: 'm', cited: [{ topicId: 't', date: '2026-09-20', title: 'Cited' }], country: 'Iran', generatedAt: fresh }],
};

beforeEach(() => { __resetWebIndexCache(); api.fetchWebIndex.mockReset(); api.fetchSystemsAnalysis.mockReset(); });

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
});
