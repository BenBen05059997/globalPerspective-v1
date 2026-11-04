import { useEffect, useState } from 'react';
import { loadBriefsIndex } from '@/shared/api/briefViews.js';
import { loadLatestDailyBrief } from '@/shared/hooks/useDailyBrief.js';

// What editions exist, independent of the one on screen. Both read what the page already loaded
// (the shared latest lookup and the record's index, each cached), so they add no request of their own.
// Until they answer (or when they cannot) the value is null: callers say nothing rather than guess.

/** The date key of the newest published daily edition, or null while unknown. */
export function useNewestDailyKey() {
  const [key, setKey] = useState(null);
  useEffect(() => {
    let live = true;
    // a failed lookup is already reported and shown by useDailyBrief, which asks the same thing
    loadLatestDailyBrief().then((entry) => { if (live) setKey(entry?.served || null); }, () => {});
    return () => { live = false; };
  }, []);
  return key;
}

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
