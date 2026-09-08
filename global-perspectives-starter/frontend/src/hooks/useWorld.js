import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWorld, fetchSituationDetail, oldestSource } from '../services/worldData.js';

const POLL_MS = 5 * 60 * 1000; // the bundle refreshes ~30 min; poll gently so a new one shows within ~5

/**
 * useWorld — the map-as-home data bundle (situations + freshness + lede + ranked), auto-refreshing
 * while the tab is visible. Returns { world, situations, loading, error, asOf, stale, refresh }.
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

  const load = useCallback(async () => {
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const w = await fetchWorld(abort.current.signal);
      setWorld(w); // may be null (not generated yet) — the UI shows the empty state
      setError(null);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const tick = () => { if (document.visibilityState === 'visible') load(); };
    timer.current = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer.current); document.removeEventListener('visibilitychange', onVisible); abort.current?.abort(); };
  }, [load]);

  const asOf = world ? oldestSource(world.sources) : null;
  const clientStale = asOf ? (Date.now() - new Date(asOf).getTime() > 90 * 60 * 1000) : false;
  const stale = Boolean(world?.stale) || clientStale;

  return { world, situations: world?.situations || [], loading, error, asOf, stale, refresh: load };
}

/** useSituationDetail — lazily fetch one situation's full detail (history/evidence) when selected. */
export function useSituationDetail(id) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!id) { setDetail(null); return; }
    const ac = new AbortController();
    setLoading(true);
    fetchSituationDetail(id, ac.signal)
      .then((d) => setDetail(d))
      .catch((e) => { if (e.name !== 'AbortError') setDetail(null); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [id]);
  return { detail, loading };
}
