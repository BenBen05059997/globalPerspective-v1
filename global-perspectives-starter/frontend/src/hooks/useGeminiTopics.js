import { useEffect, useState, useCallback } from 'react';
import { graphqlService } from '../utils/graphqlService';

const CACHE_KEY = 'gemini_topics_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function useGeminiTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTopics = useCallback(async () => {
    setError(null);
    // Try cache first
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const isFresh = cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
        const list = Array.isArray(cached?.topics) ? cached.topics : [];
        if (isFresh && list.length > 0) {
          setTopics(list);
          return; // Skip network fetch when cache is fresh
        }
      }
    } catch {
      // Ignore cache read errors
    }

  // Fallback to network fetch
  setLoading(true);
  try {
      // Explicitly request 7 topics from the service
      const data = await graphqlService.getGeminiTopics(7);
      const list = Array.isArray(data?.topics) ? data.topics : [];
      setTopics(list);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ topics: list, timestamp: Date.now() }));
      } catch {
        // Ignore cache write errors
      }
    } catch (err) {
      setError(err?.message || 'Failed to fetch Gemini topics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  return { topics, loading, error, refetch: loadTopics };
}
