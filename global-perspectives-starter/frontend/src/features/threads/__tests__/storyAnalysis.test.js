import { describe, it, expect, vi } from 'vitest';
import { analysisFromView } from '@/shared/lib/viewAnalysis.js';
import { fetchStoryAnalysis } from '@/shared/api/storyAnalysis.js';
// Captured live 2026-10-31: the `thread_analysis` action response for one story, and the story view built the way
// backend/record/newsStoryRecord/src/views.js (storyAnalysisBy) writes `analysis` from that note.
import actionResponse from './fixtures/threadAnalysisAction.json';
import storyView from './fixtures/storyViewWithAnalysis.json';

const ID = 'thread-spain-high-speed-train-collisi-e41c9f';
const fromAction = actionResponse.data[ID];

// Every field ThreadPage / StoryMode / StoryCard read off the analysis.
const READ_FIELDS = ['threadTitle', 'storyArc', 'trajectory', 'rootCauseChain', 'entryShortTitles', 'inflectionTopicId', 'riskScore',
  'riskLevel', 'dimensions', 'keyActors', 'watchQuestions', 'sentiment', 'lead', 'driftNote', 'entryCount', 'entryTopicIds',
  'generatedAt', 'model', 'threadId', 'iso3'];

describe('analysisFromView', () => {
  it('equals what thread_analysis returned for the same story, whole and field by field', () => {
    const mapped = analysisFromView(storyView);
    expect(mapped).toEqual(fromAction);
    for (const f of READ_FIELDS) expect(mapped[f], f).toEqual(fromAction[f]);
  });

  it('answers null for a view without an analysis, an empty one, or no view', () => {
    expect(analysisFromView({ ...storyView, analysis: null })).toBeNull();
    expect(analysisFromView({ ...storyView, analysis: {} })).toBeNull();
    expect(analysisFromView({ success: true, data: {} })).toBeNull();
    expect(analysisFromView(null)).toBeNull();
  });
});

describe('fetchStoryAnalysis', () => {
  const action = () => vi.fn(() => Promise.resolve(actionResponse));

  it('reads the view and does not call the action when the view has the analysis', async () => {
    const fetchAction = action();
    const views = { fetchStoryView: vi.fn(() => Promise.resolve(storyView)) };
    expect(await fetchStoryAnalysis(ID, { views, fetchAction })).toEqual(fromAction);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it('falls back to the action when the view is missing or has no analysis', async () => {
    for (const view of [null, { ...storyView, analysis: null }]) {
      const fetchAction = action();
      const got = await fetchStoryAnalysis(ID, { views: { fetchStoryView: () => Promise.resolve(view) }, fetchAction });
      expect(got).toEqual(fromAction);
      expect(fetchAction).toHaveBeenCalledWith([ID]);
    }
  });

  it('falls back to the action when the view fetch fails', async () => {
    const fetchAction = action();
    const views = { fetchStoryView: () => Promise.reject(new Error('record view 500')) };
    expect(await fetchStoryAnalysis(ID, { views, fetchAction })).toEqual(fromAction);
  });

  it('answers null when neither source has the story, and lets an action failure through', async () => {
    const views = { fetchStoryView: () => Promise.resolve(null) };
    expect(await fetchStoryAnalysis(ID, { views, fetchAction: () => Promise.resolve({ success: true, data: {} }) })).toBeNull();
    await expect(fetchStoryAnalysis(ID, { views, fetchAction: () => Promise.reject(new Error('Proxy HTTP 500')) })).rejects.toThrow('Proxy HTTP 500');
  });
});
