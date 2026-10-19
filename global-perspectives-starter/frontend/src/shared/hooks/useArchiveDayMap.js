import { fetchArchiveRange } from '@/shared/api/restProxy.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// useArchiveDayMap(enabled) — the public 30-day archive (`archive_range`) as { [dateKey]: day }, ONE
// memory-cached read per tab shared by the surfaces that must work outside an AuthProvider (the map's
// country-risk layer, the map console's country card). features/threads' useWeeklyArchive is the
// signed-in-aware variant. A failure is reported and reads as an empty archive (kept for the tab, so
// re-selecting never retries in a loop). Returns { dayMap (null until loaded), loading }.
async function loadArchive() {
  try {
    const res = await fetchArchiveRange(30);
    return res?.data || {};
  } catch (err) {
    reportFetchError('archive-range', err);
    return {};
  }
}

export function useArchiveDayMap(enabled = true) {
  const { data, loading } = useCachedQuery(enabled ? 'archive_range_30' : null, loadArchive);
  return { dayMap: data ?? null, loading };
}
