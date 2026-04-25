import { useState, useCallback } from 'react';
import { fetchResearchBriefingCache } from '../services/restProxy.js';

export const useResearchBriefing = () => {
  const [briefings, setBriefings] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [errors, setErrors] = useState({});

  const fetchBriefing = useCallback(async (topicId) => {
    if (!topicId) return null;
    setLoadingStates((prev) => ({ ...prev, [topicId]: true }));
    setErrors((prev) => ({ ...prev, [topicId]: null }));

    try {
      const data = await fetchResearchBriefingCache(topicId);
      if (!data || data.success === false) {
        throw new Error(data?.reason || 'Research briefing unavailable');
      }
      setBriefings((prev) => ({ ...prev, [topicId]: data }));
      return data;
    } catch (error) {
      setErrors((prev) => ({ ...prev, [topicId]: error.message }));
      return null;
    } finally {
      setLoadingStates((prev) => ({ ...prev, [topicId]: false }));
    }
  }, []);

  const getBriefing = useCallback((topicId) => briefings[topicId] || null, [briefings]);
  const isBriefingLoading = useCallback((topicId) => loadingStates[topicId] || false, [loadingStates]);
  const getBriefingError = useCallback((topicId) => errors[topicId] || null, [errors]);

  return { briefings, fetchBriefing, getBriefing, isBriefingLoading, getBriefingError };
};
