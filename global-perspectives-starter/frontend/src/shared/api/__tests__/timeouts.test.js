// Request deadlines: a hung proxy or record-view fetch rejects with a timeout and frees its limiter slot,
// an external signal still aborts, and a broken token getter never blocks a public action.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PROXY = 'https://proxy.test/read';
let api;
let fetchMock;

// A fetch that never answers but honours its abort signal.
const hang = (_url, init) => new Promise((_, reject) => {
  init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
});
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(async () => {
  vi.useFakeTimers();
  window.SENSITIVE_PROXY_ENDPOINT = PROXY;
  vi.resetModules();
  api = await import('@/shared/api/restProxy');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.SENSITIVE_PROXY_ENDPOINT;
});

describe('proxy timeout', () => {
  it('rejects a hung request after 15 s and frees the limiter slots', async () => {
    fetchMock = vi.fn(hang);
    vi.stubGlobal('fetch', fetchMock);
    const hung = [1, 2, 3, 4].map((n) => api.fetchSummaryCache(`t${n}`).catch((e) => e));
    const fifth = api.fetchSummaryCache('t5');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(4); // the fifth waits for a slot
    fetchMock.mockImplementation(() => ok({ done: true }));
    await vi.advanceTimersByTimeAsync(15000);
    const errs = await Promise.all(hung);
    expect(errs[0].message).toMatch(/timed out after 15s/);
    await expect(fifth).resolves.toEqual({ done: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('does not keep the failed request: the next identical call fetches again', async () => {
    fetchMock = vi.fn(hang);
    vi.stubGlobal('fetch', fetchMock);
    const first = api.fetchTopicsCache().catch((e) => e);
    await vi.advanceTimersByTimeAsync(15000);
    expect((await first).message).toMatch(/timed out/);
    fetchMock.mockImplementation(() => ok({ topics: 1 }));
    await expect(api.fetchTopicsCache()).resolves.toEqual({ topics: 1 });
  });
});

describe('record view timeout and signal', () => {
  it('rejects a hung view after 15 s', async () => {
    vi.stubGlobal('fetch', vi.fn(hang));
    const { fetchRecordView } = await import('@/shared/api/recordViews');
    const p = fetchRecordView('manifest.json').catch((e) => e);
    await vi.advanceTimersByTimeAsync(15000);
    expect((await p).message).toMatch(/timed out after 15s/);
  });

  it('an external signal still aborts the read', async () => {
    const fm = vi.fn(hang);
    vi.stubGlobal('fetch', fm);
    const { fetchRecordView } = await import('@/shared/api/recordViews');
    const ctrl = new AbortController();
    const p = fetchRecordView('manifest.json', { signal: ctrl.signal }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10);
    ctrl.abort();
    const err = await p;
    expect(err.name).toBe('AbortError');
    expect(fm.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe('token guard on proxyActionWithAuth', () => {
  const sent = () => fetchMock.mock.calls[0][1].headers;

  it('a throwing token getter still sends the action, anonymous', async () => {
    fetchMock = vi.fn(() => ok({ data: { x: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    api.setAuthProvider(() => Promise.reject(new Error('session expired')));
    await expect(api.fetchCorrectionsFeed()).resolves.toEqual({ data: { x: 1 } });
    expect(sent().Authorization).toBeUndefined();
  });

  it('a token getter that never resolves is given up on after 4 s', async () => {
    fetchMock = vi.fn(() => ok({ data: { x: 1 } }));
    vi.stubGlobal('fetch', fetchMock);
    api.setAuthProvider(() => new Promise(() => {}));
    const p = api.fetchCorrectionsFeed();
    await vi.advanceTimersByTimeAsync(3999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual({ data: { x: 1 } });
    expect(sent().Authorization).toBeUndefined();
  });

  it('a working token is still sent', async () => {
    fetchMock = vi.fn(() => ok({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    api.setAuthProvider(() => Promise.resolve('tok'));
    await api.fetchCorrectionsFeed();
    expect(sent().Authorization).toBe('Bearer tok');
  });
});
