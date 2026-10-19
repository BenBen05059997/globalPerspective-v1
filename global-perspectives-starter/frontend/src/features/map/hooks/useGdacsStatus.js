import { fetchWorld } from '@/features/map/api/worldData.js';
import { gdacsStatus } from '@/features/map/lib/gdacsStatus.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// useGdacsStatus(enabled) — the GDACS state for the site-wide status line. ONE static read of the
// same world/latest.json the map polls (a CDN GET, not a proxy call), made only while `enabled`
// (i.e. only when the analysis is actually paused) and memory-cached so every route change
// reuses it. Fails to 'unknown': the line then says nothing about disaster alerts.
const TTL_MS = 5 * 60 * 1000;

export function useGdacsStatus(enabled) {
  const { data } = useCachedQuery(enabled ? 'gdacs_world' : null, () => fetchWorld(), { ttl: TTL_MS });
  return gdacsStatus(data ?? null);
}
