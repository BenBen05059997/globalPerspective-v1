import { fetchMarketsHistory } from '@/shared/api/restProxy';
import { useCachedQuery } from '@/shared/api/useCachedQuery.js';

// Fetches per-instrument price history [{date, value}] for a sparkline.
// Returns [] for unknown/historyless symbols (Sparkline renders nothing under 2 points).
// Tab-scoped in-memory cache to avoid refetching on re-expand.
export function useMarketsHistory(symbol, days = 30) {
  const key = symbol ? `gp_markets_history_${symbol}:${days}` : null;
  const { data } = useCachedQuery(key, async () => {
    const res = await fetchMarketsHistory(symbol, days);
    return res?.success && Array.isArray(res.data) ? res.data : [];
  });
  return { data: data ?? [] };
}
