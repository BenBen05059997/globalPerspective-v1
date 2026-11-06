import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWorld, fetchSituationDetail, oldestSource } from '@/features/map/api/worldData.js';
import { reportFetchError } from '@/shared/api/errorSink.js';

const POLL_MS = 5 * 60 * 1000; // the bundle refreshes ~30 min; poll gently so a new one shows within ~5
const RETRY_MS = 1500; // a failed world fetch retries once after this before it counts as failed

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * useWorld — the map-as-home data bundle (situations + freshness + lede + ranked), auto-refreshing
 * while the tab is visible. Returns { world, situations, loading, error, asOf, stale, refresh, retry }.
 *
 * `world` is null until the first successful load (or if the tracker hasn't produced a bundle yet).
 * `stale` combines the bundle's own `stale` flag with a client-side guard (bundle older than 90 min).
 */
export function useWorld() {
  const [world, setWorld] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const abort = useRef(null);
  const held = useRef(false); // a bundle is already in hand: later failures stay silent (stale banner covers them)

  const load = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      let w;
      try { w = await fetchWorld(ctrl.signal); } catch (e) {
        if (e.name === 'AbortError') throw e;
        await wait(RETRY_MS);
        w = await fetchWorld(ctrl.signal);
      }
      held.current = held.current || !!w;
      setWorld(w); // may be null (not generated yet) — the UI shows the empty state
      setError(null);
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e);
      // Report only a real first-load failure: not while a bundle is held. Hidden / leaving pages and
      // automated browsers are filtered once, in the error sink.
      if (!held.current) reportFetchError('map-world', e);
    } finally {
      // A superseded (aborted) load must not flip `loading` off while its replacement is in flight.
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  // Boot-screen RETRY: clear the error, show loading again, re-run the same fetch.
  const retry = useCallback(() => { setError(null); setLoading(true); load(); }, [load]);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    timer.current = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
      abort.current?.abort();
    };
  }, [load]);

  const asOf = world ? oldestSource(world.sources) : null;
  const clientStale = asOf ? (Date.now() - new Date(asOf).getTime() > 90 * 60 * 1000) : false;
  const stale = Boolean(world?.stale) || clientStale;

  return { world, situations: world?.situations || [], loading, error, asOf, stale, refresh: load, retry };
}

/**
 * useSituationDetail — lazily fetch one situation's full detail (history/evidence) when selected.
 * Returns { detail, status }: 'idle' (no id) · 'loading' · 'ready' (detail in hand) · 'none' (no state
 * file: archived or never written) · 'failed' (the fetch errored; reported to the error sink).
 */
export function useSituationDetail(id) {
  const [result, setResult] = useState({ id: null, detail: null, failed: false });
  useEffect(() => {
    if (!id) return undefined;
    const ac = new AbortController();
    fetchSituationDetail(id, ac.signal)
      .then((d) => setResult({ id, detail: d, failed: false }))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        reportFetchError('map-situation-detail', e);
        setResult({ id, detail: null, failed: true });
      });
    return () => ac.abort();
  }, [id]);
  const current = id && result.id === id ? result : null;
  const status = !id ? 'idle' : !current ? 'loading' : current.failed ? 'failed' : current.detail ? 'ready' : 'none';
  return { detail: current?.detail || null, status };
}
