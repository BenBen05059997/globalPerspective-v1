import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchCountryIntelligence } from '../services/restProxy';
import { useAuth } from '../contexts/AuthContext';

const CACHE_KEY = 'gp_country_intel_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

export function useCountryIntelligence(countryNames) {
  const { user } = useAuth();
  const [intelligence, setIntelligence] = useState({});
  const [loading, setLoading] = useState(false);

  const namesKey = useMemo(() => [...countryNames].sort().join(','), [countryNames]);

  const load = useCallback(async () => {
    if ((!user && !import.meta.env.DEV) || countryNames.length === 0) return;

    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
          const hit = {};
          let allHit = true;
          for (const name of countryNames) {
            if (name in cached.data) {
              hit[name] = cached.data[name];
            } else {
              allHit = false;
            }
          }
          if (allHit) {
            setIntelligence(hit);
            return;
          }
        }
      }
    } catch { /* ignore */ }

    setLoading(true);
    try {
      const result = await fetchCountryIntelligence(countryNames);
      const data = result?.data || {};
      setIntelligence(data);
      try {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const merged = { ...existing.data, ...data };
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: merged, timestamp: Date.now() }));
      } catch { /* ignore */ }
    } catch {
      setIntelligence({});
    } finally {
      setLoading(false);
    }
  }, [namesKey, user]);

  useEffect(() => { load(); }, [load]);

  return { intelligence, loading };
}
