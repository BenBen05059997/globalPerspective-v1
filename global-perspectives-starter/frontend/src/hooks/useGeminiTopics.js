import { useEffect, useState, useCallback } from 'react';
import { graphqlService } from '../utils/graphqlService';

const CACHE_KEY = 'gemini_topics_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function useGeminiTopics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [hasNewData, setHasNewData] = useState(false);

  const loadTopics = useCallback(async () => {
    setError(null);
    let hadCachedTopics = false;

    // Try cache first
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const isFresh = cached?.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
        const list = Array.isArray(cached?.topics) ? cached.topics : [];
        if (list.length > 0) {
          setTopics(list);
          setUpdatedAt(cached?.updatedAt || null);
          setIsStale(!isFresh);
          hadCachedTopics = true;
        }
      }
    } catch {
      // Ignore cache read errors
    }

    // Fallback to network fetch
    setLoading(true);
    try {
      // Explicitly request 10 topics from the service
      const data = await graphqlService.getGeminiTopics(10);
      const list = Array.isArray(data?.topics) ? data.topics : [];
      setTopics(list);
      setIsStale(Boolean(data?.stale));
      setUpdatedAt(data?.updatedAt || null);
      setHasNewData(false);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            topics: list,
            timestamp: Date.now(),
            updatedAt: data?.updatedAt || null,
          })
        );
      } catch {
        // Ignore cache write errors
      }
    } catch (err) {
      if (!hadCachedTopics) {
        setError(err?.message || 'Failed to fetch Gemini topics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (!updatedAt) return;

    const POLL_INTERVAL = 10 * 60 * 1000;
    const intervalId = setInterval(async () => {
      try {
        const data = await graphqlService.getGeminiTopics(10);
        const newUpdatedAt = data?.updatedAt;
        if (newUpdatedAt && newUpdatedAt !== updatedAt) {
          setHasNewData(true);
        }
      } catch (err) {
        console.warn('Background poll failed:', err);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [updatedAt]);

  return { topics, loading, error, refetch: loadTopics, isStale, updatedAt, hasNewData };
}
