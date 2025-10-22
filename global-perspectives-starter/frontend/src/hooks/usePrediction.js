import { useState, useCallback } from 'react';
import graphqlService from '../utils/graphqlService';

/**
 * Custom hook for retrieving cached Gemini impact predictions.
 * Predictions are keyed by topicId and generated server-side.
 */
export const usePrediction = () => {
  const [predictions, setPredictions] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [errors, setErrors] = useState({});

  const resolveTopicId = (articleData) => (
    articleData?.topicId ??
    articleData?.topic_id ??
    articleData?.id ??
    null
  );

  const generatePrediction = useCallback(async (articleId, articleData, service = 'cache', options = {}) => {
    setLoadingStates((prev) => ({ ...prev, [articleId]: true }));
    setErrors((prev) => ({ ...prev, [articleId]: null }));

    const startTime = Date.now();

    try {
      const topicId = resolveTopicId(articleData);
      if (!topicId) {
        throw new Error('Predictions are only available for cached Gemini topics (missing topicId).');
      }

      const predictionData = await graphqlService.getTopicPrediction(topicId);
      const content = predictionData?.content || predictionData?.impact_analysis || '';

      const generationTime = Date.now() - startTime;
      const processedPrediction = {
        content,
        service,
        timestamp: predictionData?.generatedAt || new Date().toISOString(),
        generationTime,
        articleId,
        options,
        metadata: {
          title: articleData?.title,
          url: articleData?.url,
          cached: predictionData?.cached ?? true,
          remainingTtlSeconds: predictionData?.remainingTtlSeconds ?? null,
        },
      };

      setPredictions((prev) => ({ ...prev, [articleId]: processedPrediction }));
      return processedPrediction;
    } catch (error) {
      console.error('Prediction fetch failed:', error);
      const message = error?.message || 'Failed to fetch cached prediction';
      setErrors((prev) => ({ ...prev, [articleId]: { message, timestamp: new Date().toISOString() } }));
      throw error;
    } finally {
      setLoadingStates((prev) => ({ ...prev, [articleId]: false }));
    }
  }, []);

  const clearPrediction = useCallback((articleId) => {
    setPredictions((prev) => {
      const next = { ...prev };
      delete next[articleId];
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[articleId];
      return next;
    });
  }, []);

  const clearAllPredictions = useCallback(() => {
    setPredictions({});
    setErrors({});
    setLoadingStates({});
  }, []);

  const getPrediction = useCallback((articleId) => predictions[articleId] || null, [predictions]);
  const isPredictionLoading = useCallback((articleId) => loadingStates[articleId] || false, [loadingStates]);
  const getPredictionError = useCallback((articleId) => errors[articleId] || null, [errors]);

  return {
    predictions,
    generatePrediction,
    clearPrediction,
    clearAllPredictions,
    getPrediction,
    isPredictionLoading,
    getPredictionError,
    loadingStates,
    errors,
  };
};
