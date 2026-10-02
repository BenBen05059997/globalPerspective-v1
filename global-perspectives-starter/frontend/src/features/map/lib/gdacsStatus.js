// gdacsStatus — is the disaster-alert (GDACS) feed live? Read from the world bundle's own
// `sources.gdacs` check time, never a standing claim: live = checked within GDACS_FRESH_MS.
export const GDACS_FRESH_MS = 2 * 60 * 60 * 1000;

/**
 * gdacsStatus(world, now) -> { state: 'live' | 'stale' | 'unknown', checkedAt: Date | null }
 *   unknown = no world bundle / no GDACS stamp (nothing is claimed either way).
 */
export function gdacsStatus(world, now = Date.now()) {
  const ts = world?.sources?.gdacs;
  if (!ts) return { state: 'unknown', checkedAt: null };
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return { state: 'unknown', checkedAt: null };
  const age = now - t;
  if (age < 0) return { state: 'unknown', checkedAt: null }; // a stamp from the future is not a check
  return { state: age < GDACS_FRESH_MS ? 'live' : 'stale', checkedAt: new Date(t) };
}
