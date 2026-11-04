import { useEffect, useState } from 'react';
import { loadBriefsIndex } from '@/shared/api/briefViews.js';

// Which weekly editions exist, independent of the one on screen (the newest daily edition is useDailyBrief's `latestDateKey`).
// It reads the record's index, which the page already loaded (cached), so it adds no request of its own.

/** The weekOf keys of the published weekly editions in the record's index (newest first), or null while unknown / not generated. */
export function useWeeklyEditionKeys() {
  const [keys, setKeys] = useState(null);
  useEffect(() => {
    let live = true;
    loadBriefsIndex().then((index) => { if (live) setKeys(index ? index.weekly.map((w) => w.weekOf) : null); });
    return () => { live = false; };
  }, []);
  return keys;
}
