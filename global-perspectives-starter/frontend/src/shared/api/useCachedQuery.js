import { useCallback, useEffect, useState } from 'react';

// useCachedQuery(key, fetcher, { ttl, storage }) — the one cached-fetch hook every data hook builds on.
//   key      string identifying the request; also the storage key, so it must be unique per request.
//            null/'' = disabled (no fetch, no data).
//   fetcher  () => Promise<value>. The resolved value is the hook's `data` and is cached; resolving
//            `undefined` means "nothing to keep": data stays undefined and nothing is cached.
//   ttl      ms a cached value stays fresh (default: forever, for the life of the store).
//   storage  'local' | 'session' (JSON { data, ts } under `key`) | 'memory' (module Map, this tab).
// Returns { data, error, loading, refetch }. A fresh cached value is returned on the first render
// (no loading flash, no request). Identical keys in flight share one request. A result that arrives
// after the key changed or the component unmounted is dropped (stale guard). `refetch()` always goes
// to the network and keeps the current data until the new value lands.

const memory = new Map(); // key -> { data, ts }
const inFlight = new Map(); // key -> Promise<value>

// Tests: forget every memory-cached value and in-flight request.
export function clearMemoryCache() { memory.clear(); inFlight.clear(); }

function webStorage(kind) {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch { return null; }
}

function readEntry(key, storage) {
  if (storage === 'memory') return memory.get(key) || null;
  try {
    const raw = webStorage(storage)?.getItem(key);
    const entry = raw ? JSON.parse(raw) : null;
    return entry && typeof entry === 'object' && 'data' in entry && Number.isFinite(entry.ts) ? entry : null;
  } catch { return null; }
}

function writeEntry(key, storage, data) {
  const entry = { data, ts: Date.now() };
  if (storage === 'memory') { memory.set(key, entry); return; }
  try { webStorage(storage)?.setItem(key, JSON.stringify(entry)); } catch { /* storage full or blocked */ }
}

function fetchShared(key, storage, fetcher) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = Promise.resolve()
    .then(fetcher)
    .then((data) => { if (data !== undefined) writeEntry(key, storage, data); return data; })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

function initialState(key, storage, ttl) {
  if (!key) return { key, data: undefined, error: null, loading: false };
  const hit = readEntry(key, storage);
  if (hit && Date.now() - hit.ts < ttl) return { key, data: hit.data, error: null, loading: false };
  return { key, data: undefined, error: null, loading: true };
}

export function useCachedQuery(key, fetcher, { ttl = Infinity, storage = 'memory' } = {}) {
  const [state, setState] = useState(() => initialState(key, storage, ttl));

  // A new key starts over from its own cache entry (render-time reset: never shows the old key's data).
  let current = state;
  if (state.key !== key) {
    current = initialState(key, storage, ttl);
    setState(current);
  }

  const pending = current.loading;
  useEffect(() => {
    if (!pending || !key) return undefined;
    const ctrl = new AbortController();
    fetchShared(key, storage, fetcher).then(
      (data) => { if (!ctrl.signal.aborted) setState({ key, data, error: null, loading: false }); },
      (error) => { if (!ctrl.signal.aborted) setState({ key, data: undefined, error, loading: false }); },
    );
    return () => ctrl.abort();
    // The fetcher is read when a fetch starts; the key is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending, storage]);

  const refetch = useCallback(() => {
    setState((s) => (s.key && !s.loading ? { ...s, error: null, loading: true } : s));
  }, []);

  return { data: current.data, error: current.error, loading: current.loading, refetch };
}
