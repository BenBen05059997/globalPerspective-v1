// useWebIndex: the record's web view first, the web_index action when the view is missing or unreadable (reported),
// and the action alone when asked (useStoryLinks needs its run `targets`).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ fetchWebIndex: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchWebIndexView: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchWebIndexView: (...a) => rv.fetchWebIndexView(...a) }) }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/errorSink.js', () => sink);

import { useWebIndex } from '@/features/threads/hooks/useWebIndex.js';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

const VIEW = { schemaVersion: 1, generatedAt: '2026-10-31T05:01:53.701Z', maxAgeDays: 30, websUsed: [], links: [], shared: [], threads: { A: { state: 'linked', title: 'From view' } } };
const ACTION = { generatedAt: '2026-10-31T05:01:53.873Z', targets: { count: 10, countries: [] }, websUsed: [], links: [], shared: [], threads: { A: { state: 'linked', title: 'From action' } } };

beforeEach(() => {
  clearMemoryCache();
  api.fetchWebIndex.mockReset(); api.fetchWebIndex.mockResolvedValue({ success: true, data: ACTION });
  rv.fetchWebIndexView.mockReset(); sink.reportFetchError.mockReset();
});

describe('useWebIndex', () => {
  it('answers from the view with no action call', async () => {
    rv.fetchWebIndexView.mockResolvedValue(VIEW);
    const { result } = renderHook(() => useWebIndex(true));
    await waitFor(() => expect(result.current.index?.threads.A.title).toBe('From view'));
    expect(api.fetchWebIndex).not.toHaveBeenCalled();
    expect(result.current.failed).toBe(false);
  });

  it('a view that is not generated (404 -> null) or malformed falls back to the action, unreported for the 404', async () => {
    rv.fetchWebIndexView.mockResolvedValue(null);
    const { result } = renderHook(() => useWebIndex(true));
    await waitFor(() => expect(result.current.index?.threads.A.title).toBe('From action'));
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('a failed view read is reported and falls back to the action', async () => {
    rv.fetchWebIndexView.mockRejectedValue(new Error('record view 500 for index/web.json'));
    const { result } = renderHook(() => useWebIndex(true));
    await waitFor(() => expect(result.current.index?.threads.A.title).toBe('From action'));
    expect(sink.reportFetchError).toHaveBeenCalledWith('web-index-view', expect.any(Error));
  });

  it('view and action both failing is a reported failure, not an invented index', async () => {
    rv.fetchWebIndexView.mockRejectedValue(new Error('view down'));
    api.fetchWebIndex.mockRejectedValue(new Error('action down'));
    const { result } = renderHook(() => useWebIndex(true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.index).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('web-index', expect.any(Error));
  });

  it('source "action" reads the action only (the run targets live there)', async () => {
    rv.fetchWebIndexView.mockResolvedValue(VIEW);
    const { result } = renderHook(() => useWebIndex(true, { source: 'action' }));
    await waitFor(() => expect(result.current.index?.targets.count).toBe(10));
    expect(rv.fetchWebIndexView).not.toHaveBeenCalled();
  });

  it('disabled reads nothing', () => {
    renderHook(() => useWebIndex(false));
    expect(rv.fetchWebIndexView).not.toHaveBeenCalled();
    expect(api.fetchWebIndex).not.toHaveBeenCalled();
  });
});
