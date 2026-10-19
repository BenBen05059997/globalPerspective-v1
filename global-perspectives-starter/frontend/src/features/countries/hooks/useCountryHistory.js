import { useEffect } from 'react';
import { fetchCountryHistory } from '@/shared/api/restProxy.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Correction-history depth gate: the server caps driftNotes for non-members and reports the
// honest total + whether it withheld any, so the UI can show "+N earlier — join to see all".
export function useCountryHistory(countryName) {
  const key = countryName ? `gp_country_history_${countryName}` : null;
  const { data, loading, error, refetch } = useCachedQuery(key, async () => {
    const res = await fetchCountryHistory(countryName);
    if (!res?.success || !Array.isArray(res.snapshots)) return undefined;
    const notes = Array.isArray(res.driftNotes) ? res.driftNotes : []; // living-analysis grounded "what changed" notes
    return {
      snapshots: [...res.snapshots].sort((a, b) => a.dateKey?.localeCompare(b.dateKey)),
      driftNotes: notes,
      total: Number(res.driftNotesTotal) || notes.length,
      gated: !!res.driftNotesGated,
    };
  }, { ttl: CACHE_TTL, storage: 'local' });

  // An entry written before useCachedQuery held the snapshots array as `data` (notes beside it):
  // read it as a miss and fetch once.
  const legacy = Array.isArray(data);
  useEffect(() => { if (legacy) refetch(); }, [legacy, refetch]);
  const d = legacy ? null : data;

  return {
    snapshots: d?.snapshots ?? [],
    driftNotes: d?.driftNotes ?? [],
    driftNotesTotal: d?.total ?? 0,
    driftNotesGated: d?.gated ?? false,
    loading,
    error: error?.message ?? null,
  };
}
