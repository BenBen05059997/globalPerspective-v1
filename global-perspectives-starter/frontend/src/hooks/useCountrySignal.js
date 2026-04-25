import { useMemo } from 'react';
import { useWeeklyArchive } from './useWeeklyArchive';

// Z-score signal: how loud is a country this week vs its own 30-day baseline.
// Returns { signal: { [ISO]: {score, last7, prior7, last7Threads, z, bucket} }, loading, ready }

export function useCountrySignal(nameToISO) {
  const { dayMap, loading } = useWeeklyArchive();

  const signal = useMemo(() => {
    const dates = Object.keys(dayMap).sort(); // ascending
    if (dates.length === 0) return {};

    // Per-country per-day entry count + threads touched in last 7
    const byCountry = {}; // iso -> { daily: {date: count}, threads7: Set }

    const ensureCountry = (iso) => {
      if (!byCountry[iso]) byCountry[iso] = { daily: {}, threads7: new Set() };
      return byCountry[iso];
    };

    const last7Cut = dates.slice(-7);
    const last7Set = new Set(last7Cut);

    for (const date of dates) {
      const day = dayMap[date];
      const entries = Array.isArray(day) ? day : (day?.entries || []);
      for (const e of entries) {
        const regions = Array.isArray(e.regions) ? e.regions : [];
        const hit = new Set();
        for (const region of regions) {
          if (!region) continue;
          const key = String(region).trim().toLowerCase();
          const iso = nameToISO[key];
          if (iso) hit.add(iso);
        }
        for (const iso of hit) {
          const bucket = ensureCountry(iso);
          bucket.daily[date] = (bucket.daily[date] || 0) + 1;
          if (last7Set.has(date) && e.threadId) bucket.threads7.add(e.threadId);
        }
      }
    }

    // Compute z-scores for every tracked iso (even with zero entries, z=0)
    const out = {};
    for (const iso of Object.values(nameToISO)) {
      const rec = byCountry[iso] || { daily: {}, threads7: new Set() };
      const counts = dates.map(d => rec.daily[d] || 0);

      const last7 = counts.slice(-7).reduce((a, b) => a + b, 0);
      const prior = counts.slice(0, -7); // everything before last 7 days is baseline

      // Compare last7 total to rolling 7-day baseline mean/std (overlapping windows)
      const baselineWindows = [];
      for (let i = 0; i + 7 <= prior.length; i++) {
        baselineWindows.push(prior.slice(i, i + 7).reduce((a, b) => a + b, 0));
      }

      let z = 0;
      let prior7 = 0;
      if (baselineWindows.length >= 3) {
        const mean = baselineWindows.reduce((a, b) => a + b, 0) / baselineWindows.length;
        const variance = baselineWindows.reduce((a, b) => a + (b - mean) ** 2, 0) / baselineWindows.length;
        const std = Math.sqrt(variance);
        prior7 = Math.round(mean);
        z = std > 0.3 ? (last7 - mean) / std : (last7 - mean); // avoid div by ~0
      } else if (prior.length > 0) {
        prior7 = Math.round(prior.reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(prior.length / 7)));
        z = last7 - prior7;
      }

      // Bucket: H (z >= 1.5), E (z >= 0.5), L otherwise
      let bucket = 'L';
      if (z >= 1.5) bucket = 'H';
      else if (z >= 0.5) bucket = 'E';

      // Require some volume — a z-spike from 0→2 entries isn't meaningful
      if (last7 < 2) bucket = 'L';

      out[iso] = {
        last7,
        prior7,
        last7Threads: rec.threads7.size,
        z: Math.round(z * 10) / 10,
        bucket,
      };
    }

    return out;
  }, [dayMap, nameToISO]);

  const ready = Object.keys(dayMap).length > 0;
  return { signal, loading, ready };
}
