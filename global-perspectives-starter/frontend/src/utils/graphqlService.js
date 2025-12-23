import { fetchTopicsCache, fetchSummaryCache, fetchPredictionCache, fetchTraceCauseCache } from '../services/restProxy.js';

const PREDICTION_WORD_LIMIT = 500;

function trimToCompleteSentence(text, maxWords) {
  if (!text || typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  const trimmed = words.slice(0, maxWords).join(' ');

  const boundaries = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
      boundaries.push(i);
    }
  }
  if (boundaries.length) {
    const lastBoundary = boundaries[boundaries.length - 1];
    return trimmed.slice(0, lastBoundary + 1).trim();
  }
  return `${trimmed}...`;
}

function resolveTopicId(input, fallback) {
  if (!input) return fallback ?? null;
  if (typeof input === 'string') {
    const candidate = input.trim();
    return candidate.length ? candidate : fallback ?? null;
  }
  if (typeof input === 'object') {
    const candidate =
      input.topicId ??
      input.topic_id ??
      input.topicID ??
      input.topicid ??
      input.id ??
      null;
    if (candidate != null && String(candidate).trim().length > 0) {
      return String(candidate).trim();
    }
  }
  return fallback != null ? String(fallback).trim() || null : null;
}

function createStableTopicId(topic, index) {
  const rawTitle = typeof topic?.title === 'string' && topic.title.trim().length
    ? topic.title.trim()
    : `Topic ${index + 1}`;
  const normalizedTitle = rawTitle.replace(/\s+/g, ' ');
  return `${normalizedTitle}-${index}`;
}

class GraphQLService {
  async getGeminiTopics(limit = 5) {
    const payload = await fetchTopicsCache();
    if (!payload || payload.success === false) {
      const message = payload?.error || 'Topics cache unavailable';
      throw new Error(message);
    }

    const item = payload?.data ?? {};
    const topics = Array.isArray(item.topics) ? item.topics : [];
    const effectiveLimit = Number.isFinite(limit) ? limit : topics.length;

    const topicsWithIds = topics.map((topic, index) => {
      const existingId = resolveTopicId(topic);
      const topicId = existingId || createStableTopicId(topic, index);
      return { ...topic, id: topicId, topicId };
    });

    return {
      topics: effectiveLimit ? topicsWithIds.slice(0, effectiveLimit) : topicsWithIds,
      ai_powered: true,
      model: item.model || payload?.model || 'gemini-2.5-flash',
      limit: effectiveLimit || item.limit || topics.length,
      cached: payload?.cached ?? true,
      stale: payload?.stale ?? false,
      updatedAt: item.updatedAt,
    };
  }

  async getTopicSummary(topicId) {
    if (!topicId) {
      throw new Error('Missing topicId for summary lookup');
    }
    const payload = await fetchSummaryCache(topicId);
    if (!payload || payload.success === false) {
      const reason = payload?.reason || payload?.error || 'Summary cache unavailable';
      throw new Error(reason);
    }
    const data = payload?.data ?? null;
    if (data && typeof data === 'object') {
      return { ...data, cached: payload?.cached ?? true };
    }
    return data;
  }

  async getTopicPrediction(topicId) {
    if (!topicId) {
      throw new Error('Missing topicId for prediction lookup');
    }
    const payload = await fetchPredictionCache(topicId);
    if (!payload || payload.success === false) {
      const reason = payload?.reason || payload?.error || 'Prediction cache unavailable';
      throw new Error(reason);
    }
    const data = payload?.data ?? null;
    if (data && typeof data === 'object') {
      return { ...data, cached: payload?.cached ?? true };
    }
    return data;
  }

  async getTopicTraceCause(topicId) {
    if (!topicId) {
      throw new Error('Missing topicId for trace cause lookup');
    }
    const payload = await fetchTraceCauseCache(topicId);
    if (!payload || payload.success === false) {
      const reason = payload?.reason || payload?.error || 'Trace cause cache unavailable';
      throw new Error(reason);
    }
    const data = payload?.data ?? null;
    if (data && typeof data === 'object') {
      return { ...data, cached: payload?.cached ?? true };
    }
    return data;
  }

  async generateSummary(topicOrId) {
    const topicId = resolveTopicId(topicOrId);
    if (!topicId) {
      throw new Error('Summaries are only available for cached Gemini topics');
    }
    const data = await this.getTopicSummary(topicId);
    return data?.content ?? '';
  }

  async generateTraceCause(topicOrId) {
    const topicId = resolveTopicId(topicOrId);
    if (!topicId) {
      throw new Error('Trace Cause is only available for cached Gemini topics');
    }
    const data = await this.getTopicTraceCause(topicId);
    return data?.content ?? ''; // Markdown content
  }

  async generatePredictions(topicOrArticle) {
    const topicId = resolveTopicId(topicOrArticle);
    if (!topicId) {
      throw new Error('Predictions are only available for cached Gemini topics');
    }
    const data = await this.getTopicPrediction(topicId);
    const content = typeof data?.content === 'string' ? data.content : '';
    return {
      impact_analysis: trimToCompleteSentence(content, PREDICTION_WORD_LIMIT),
      cached: data?.cached ?? true,
      raw: data,
    };
  }

  async testConnection() {
    try {
      await this.getGeminiTopics(1);
      return true;
    } catch (error) {
      console.error('Topics cache test failed:', error);
      return false;
    }
  }
}

export const graphqlService = new GraphQLService();
export default graphqlService;
