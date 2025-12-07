import { useState, useCallback } from 'react';
import graphqlService from '../utils/graphqlService';

/**
 * Custom hook for retrieving cached Gemini trace cause (Deep Context) analysis.
 * Predictions are keyed by topicId and generated server-side.
 */
export const useTraceCause = () => {
    const [traceCauses, setTraceCauses] = useState({});
    const [loadingStates, setLoadingStates] = useState({});
    const [errors, setErrors] = useState({});

    const resolveTopicId = (articleData) => (
        articleData?.topicId ??
        articleData?.topic_id ??
        articleData?.id ??
        null
    );

    const generateTraceCause = useCallback(async (articleId, articleData, service = 'cache', options = {}) => {
        setLoadingStates((prev) => ({ ...prev, [articleId]: true }));
        setErrors((prev) => ({ ...prev, [articleId]: null }));

        const startTime = Date.now();

        try {
            const topicId = resolveTopicId(articleData);
            if (!topicId) {
                throw new Error('Trace Cause is only available for cached Gemini topics (missing topicId).');
            }

            const traceData = await graphqlService.getTopicTraceCause(topicId);
            const content = traceData?.content || traceData?.impact_analysis || '';

            const generationTime = Date.now() - startTime;
            const processedTrace = {
                content,
                service,
                timestamp: traceData?.generatedAt || new Date().toISOString(),
                generationTime,
                articleId,
                options,
                metadata: {
                    title: articleData?.title,
                    url: articleData?.url,
                    cached: traceData?.cached ?? true,
                    remainingTtlSeconds: traceData?.remainingTtlSeconds ?? null,
                },
            };

            setTraceCauses((prev) => ({ ...prev, [articleId]: processedTrace }));
            return processedTrace;
        } catch (error) {
            console.error('Trace Cause fetch failed:', error);
            const message = error?.message || 'Failed to fetch cached trace cause';
            setErrors((prev) => ({ ...prev, [articleId]: { message, timestamp: new Date().toISOString() } }));
            throw error;
        } finally {
            setLoadingStates((prev) => ({ ...prev, [articleId]: false }));
        }
    }, []);

    const clearTraceCause = useCallback((articleId) => {
        setTraceCauses((prev) => {
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

    const clearAllTraceCauses = useCallback(() => {
        setTraceCauses({});
        setErrors({});
        setLoadingStates({});
    }, []);

    const getTraceCause = useCallback((articleId) => traceCauses[articleId] || null, [traceCauses]);
    const isTraceCauseLoading = useCallback((articleId) => loadingStates[articleId] || false, [loadingStates]);
    const getTraceCauseError = useCallback((articleId) => errors[articleId] || null, [errors]);

    return {
        traceCauses,
        generateTraceCause,
        clearTraceCause,
        clearAllTraceCauses,
        getTraceCause,
        isTraceCauseLoading,
        getTraceCauseError,
        loadingStates,
        errors,
    };
};
