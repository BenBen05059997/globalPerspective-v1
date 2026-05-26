import { useState, useEffect } from 'react';
import { fetchMarketsHistory } from '../services/restProxy';

// Fetches per-instrument price history [{date, value}] for a sparkline.
// Returns [] for unknown/historyless symbols (Sparkline renders nothing under 2 points).
// Session-scoped in-memory cache to avoid refetching on re-expand.
const CACHE = {};

export function useMarketsHistory(symbol, days = 30) {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!symbol) { setData([]); return; }
    const key = `${symbol}:${days}`;
    if (CACHE[key]) { setData(CACHE[key]); return; }
    let cancelled = false;
    fetchMarketsHistory(symbol, days)
      .then((res) => {
        if (cancelled) return;
        const series = res?.success && Array.isArray(res.data) ? res.data : [];
        CACHE[key] = series;
        setData(series);
      })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, [symbol, days]);

  return { data };
}
