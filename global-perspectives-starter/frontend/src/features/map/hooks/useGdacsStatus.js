import { useEffect, useState } from 'react';
import { fetchWorld } from '@/features/map/api/worldData.js';
import { gdacsStatus } from '@/features/map/lib/gdacsStatus.js';

// useGdacsStatus(enabled) — the GDACS state for the site-wide status line. ONE static read of the
// same world/latest.json the map polls (a CDN GET, not a proxy call), made only while `enabled`
// (i.e. only when the analysis is actually paused) and cached for the tab so every route change
// reuses it. Fails to 'unknown': the line then says nothing about disaster alerts.
const TTL_MS = 5 * 60 * 1000;
let cache = null; // { at, world }
let inflight = null;

export function __resetGdacsStatusCache() { cache = null; inflight = null; }

function load() {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.world);
  if (!inflight) {
    inflight = fetchWorld().then((world) => { cache = { at: Date.now(), world }; return world; }).finally(() => { inflight = null; });
  }
  return inflight;
}

export function useGdacsStatus(enabled) {
  const [world, setWorld] = useState(() => (cache ? cache.world : null));
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    load().then((w) => { if (live) setWorld(w); }).catch(() => { if (live) setWorld(null); });
    return () => { live = false; };
  }, [enabled]);
  return gdacsStatus(world);
}
