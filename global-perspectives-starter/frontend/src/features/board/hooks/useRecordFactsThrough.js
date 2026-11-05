import { useEffect, useState } from 'react';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';

/** The record's `factsThrough` day from the views manifest (written every run), via the shared, cached manifest read of viewsFresh.js.
 *  undefined while loading, '' when the manifest could not be read or has none (the failure is reported by the loader). */
export function useRecordFactsThrough() {
  const [day, setDay] = useState(undefined);
  useEffect(() => {
    let live = true;
    loadViewsFresh().then(({ manifest }) => { if (live) setDay(String(manifest?.factsThrough || '').slice(0, 10)); }, () => { if (live) setDay(''); });
    return () => { live = false; };
  }, []);
  return day;
}
