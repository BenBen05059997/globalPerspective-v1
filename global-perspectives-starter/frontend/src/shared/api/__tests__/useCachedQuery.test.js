import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCachedQuery, clearMemoryCache } from '@/shared/api/useCachedQuery.js';

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearMemoryCache();
  localStorage.clear();
  sessionStorage.clear();
});

describe('useCachedQuery', () => {
  it('fetches, then serves the value with loading off', async () => {
    const fetcher = vi.fn().mockResolvedValue({ a: 1 });
    const { result } = renderHook(() => useCachedQuery('k1', fetcher));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ a: 1 });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a null key is disabled: no fetch, no loading', () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useCachedQuery(null, fetcher));
    expect(result.current).toMatchObject({ data: undefined, loading: false, error: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('localStorage: a fresh entry is served on the first render with no request', () => {
    localStorage.setItem('k2', JSON.stringify({ data: [1, 2], ts: Date.now() }));
    const fetcher = vi.fn();
    const { result } = renderHook(() => useCachedQuery('k2', fetcher, { storage: 'local', ttl: 60_000 }));
    expect(result.current).toMatchObject({ data: [1, 2], loading: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('localStorage: a stale entry refetches and is rewritten', async () => {
    localStorage.setItem('k3', JSON.stringify({ data: 'old', ts: Date.now() - 120_000 }));
    const fetcher = vi.fn().mockResolvedValue('new');
    const { result } = renderHook(() => useCachedQuery('k3', fetcher, { storage: 'local', ttl: 60_000 }));
    await waitFor(() => expect(result.current.data).toBe('new'));
    expect(JSON.parse(localStorage.getItem('k3')).data).toBe('new');
  });

  it('a malformed entry is a miss', async () => {
    sessionStorage.setItem('k4', 'not json{{');
    const fetcher = vi.fn().mockResolvedValue(5);
    const { result } = renderHook(() => useCachedQuery('k4', fetcher, { storage: 'session', ttl: 60_000 }));
    await waitFor(() => expect(result.current.data).toBe(5));
    expect(JSON.parse(sessionStorage.getItem('k4')).data).toBe(5);
  });

  it('resolving undefined caches nothing', async () => {
    const fetcher = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCachedQuery('k5', fetcher, { storage: 'local' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem('k5')).toBeNull();
  });

  it('memory: a second mount reuses the value without a request', async () => {
    const fetcher = vi.fn().mockResolvedValue('m');
    const first = renderHook(() => useCachedQuery('k6', fetcher, { ttl: 60_000 }));
    await waitFor(() => expect(first.result.current.data).toBe('m'));
    const second = renderHook(() => useCachedQuery('k6', fetcher, { ttl: 60_000 }));
    expect(second.result.current).toMatchObject({ data: 'm', loading: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('identical keys in flight share one request', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const a = renderHook(() => useCachedQuery('k7', fetcher));
    const b = renderHook(() => useCachedQuery('k7', fetcher));
    await act(async () => { d.resolve('shared'); });
    expect(a.result.current.data).toBe('shared');
    expect(b.result.current.data).toBe('shared');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('errors surface as `error` with data cleared, and are not cached', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useCachedQuery('k8', fetcher, { storage: 'local' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error.message).toBe('boom');
    expect(result.current.data).toBeUndefined();
    expect(localStorage.getItem('k8')).toBeNull();
    act(() => result.current.refetch());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });

  it('refetch bypasses a fresh cache and keeps the current data while loading', async () => {
    localStorage.setItem('k9', JSON.stringify({ data: 'cached', ts: Date.now() }));
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const { result } = renderHook(() => useCachedQuery('k9', fetcher, { storage: 'local', ttl: 60_000 }));
    expect(fetcher).not.toHaveBeenCalled();
    act(() => result.current.refetch());
    expect(result.current).toMatchObject({ data: 'cached', loading: true });
    await act(async () => { d.resolve('fresh'); });
    expect(result.current).toMatchObject({ data: 'fresh', loading: false });
  });

  it('a key change drops the old result (stale guard) and never shows the old data', async () => {
    const slow = deferred();
    const fetchers = { a: vi.fn(() => slow.promise), b: vi.fn().mockResolvedValue('B') };
    const { result, rerender } = renderHook(({ k }) => useCachedQuery(k, fetchers[k]), { initialProps: { k: 'a' } });
    rerender({ k: 'b' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toBe('B'));
    await act(async () => { slow.resolve('A'); });
    expect(result.current.data).toBe('B');
  });

  it('a result after unmount is ignored', async () => {
    const d = deferred();
    const { unmount } = renderHook(() => useCachedQuery('k10', () => d.promise));
    unmount();
    await act(async () => { d.resolve('late'); });
    // still cached for the next mount
    const again = renderHook(() => useCachedQuery('k10', vi.fn()));
    expect(again.result.current.data).toBe('late');
  });
});
