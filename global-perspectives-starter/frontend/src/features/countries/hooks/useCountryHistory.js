import { useEffect } from 'react';
import { fetchCountryHistory } from '@/shared/api/restProxy.js';
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';
import { resolveCountry } from '@/shared/lib/countries.js';
import { combineDrift } from '@/features/countries/lib/viewDrift.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const views = makeRecordViews();

// Correction-history depth gate: the server caps driftNotes for non-members and reports the
// honest total + whether it withheld any, so the UI can show "+N earlier — join to see all".
// The drift notes themselves come from the record's country view (decision 0042) when it holds as many as the action
// returned (lib/viewDrift.js); the risk snapshots and the gate stay on country_history.
export function useCountryHistory(countryName) {
  const key = countryName ? `gp_country_history_${countryName}` : null;
  const { data, loading, error, refetch } = useCachedQuery(key, async () => {
    const iso3 = resolveCountry(countryName)?.iso3;
    const [res, view] = await Promise.all([
      fetchCountryHistory(countryName),
      views.fetchCountryView(iso3).catch((e) => { reportFetchError('country-view', e); return null; }),
    ]);
    if (!res?.success || !Array.isArray(res.snapshots)) return undefined;
    const { driftNotes, total, gated } = combineDrift(view, res); // living-analysis grounded "what changed" notes
    return {
      snapshots: [...res.snapshots].sort((a, b) => a.dateKey?.localeCompare(b.dateKey)),
      driftNotes,
      total,
      gated,
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
