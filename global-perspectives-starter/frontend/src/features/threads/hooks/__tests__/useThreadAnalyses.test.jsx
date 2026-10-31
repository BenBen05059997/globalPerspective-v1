// useThreadAnalyses({ light }): the Stories page and the country page read the record's analyses index in one request;
// the thread_analysis action answers when the index is missing or unreadable, and always for the map (no `light`).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchThreadAnalyses: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchAnalysesIndex: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchAnalysesIndex: (...a) => rv.fetchAnalysesIndex(...a) }) }));
vi.mock('@/shared/api/restProxy', () => api);
vi.mock('@/shared/api/errorSink.js', () => sink);

import { useThreadAnalyses } from '@/features/threads/hooks/useThreadAnalyses.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const INDEX = { schemaVersion: 1, analyses: { A: { threadId: 'A', threadTitle: 'From index', riskScore: 60 }, B: { threadId: 'B', threadTitle: 'B index' } } };
const ACTION = { A: { threadId: 'A', threadTitle: 'From action' } };

beforeEach(() => {
  clearMemoryCache(); localStorage.clear();
  api.fetchThreadAnalyses.mockReset(); api.fetchThreadAnalyses.mockResolvedValue({ data: ACTION });
  rv.fetchAnalysesIndex.mockReset(); sink.reportFetchError.mockReset();
});

describe('useThreadAnalyses', () => {
  it('light: one index read answers every requested story, with no action call (and no 20-id cap)', async () => {
    rv.fetchAnalysesIndex.mockResolvedValue(INDEX);
    const ids = ['A', 'B', 'C'];
    const { result } = renderHook(() => useThreadAnalyses(ids, { light: true }));
    await waitFor(() => expect(result.current.analyses.A?.threadTitle).toBe('From index'));
    expect(Object.keys(result.current.analyses)).toEqual(['A', 'B']);
    expect(api.fetchThreadAnalyses).not.toHaveBeenCalled();
    expect(rv.fetchAnalysesIndex).toHaveBeenCalledTimes(1);
  });

  it('light: an index that is not generated (404 -> null) falls back to the action, without a report', async () => {
    rv.fetchAnalysesIndex.mockResolvedValue(null);
    const ids = ['A'];
    const { result } = renderHook(() => useThreadAnalyses(ids, { light: true }));
    await waitFor(() => expect(result.current.analyses.A?.threadTitle).toBe('From action'));
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('light: a failed index read is reported and falls back to the action', async () => {
    rv.fetchAnalysesIndex.mockRejectedValue(new Error('record view 500 for index/analyses.json'));
    const ids = ['A'];
    const { result } = renderHook(() => useThreadAnalyses(ids, { light: true }));
    await waitFor(() => expect(result.current.analyses.A?.threadTitle).toBe('From action'));
    expect(sink.reportFetchError).toHaveBeenCalledWith('analyses-index', expect.any(Error));
  });

  it('without light (the map) the action answers and the index is never read', async () => {
    rv.fetchAnalysesIndex.mockResolvedValue(INDEX);
    const ids = ['A'];
    const { result } = renderHook(() => useThreadAnalyses(ids));
    await waitFor(() => expect(result.current.analyses.A?.threadTitle).toBe('From action'));
    expect(rv.fetchAnalysesIndex).not.toHaveBeenCalled();
  });

  it('no ids: nothing is read at all', async () => {
    const ids = [];
    const { result } = renderHook(() => useThreadAnalyses(ids, { light: true }));
    expect(result.current.analyses).toEqual({});
    expect(rv.fetchAnalysesIndex).not.toHaveBeenCalled();
    expect(api.fetchThreadAnalyses).not.toHaveBeenCalled();
  });
});
