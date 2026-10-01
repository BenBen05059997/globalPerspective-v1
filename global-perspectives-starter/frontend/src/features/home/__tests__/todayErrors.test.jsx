// /today fails inline and honestly (P3b): no modal, no "Something went wrong", the failure goes to the
// client-error sink, and every unavailable state carries a working Retry.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));

const refetch = vi.fn();
let topicsState;
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => topicsState }));
vi.mock('@/features/home/hooks/useTodayArchive', () => ({ useTodayArchive: () => ({ entries: [] }) }));
vi.mock('@/features/economy/hooks/useDisruptionsList', () => ({ useDisruptionsList: () => ({ data: [] }) }));
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => ({ data: null }) }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => ({ notes: [], total: 0 }) }));
vi.mock('@/features/account/components/SubscribeCard', () => ({ default: () => null }));
vi.mock('@/features/breaking/components/BreakingStrip', () => ({ default: () => null }));
vi.mock('@/shared/data/contentService', () => ({
  default: {
    getTopicSummary: vi.fn().mockRejectedValue(new Error('Proxy HTTP 500: boom')),
    getTopicPrediction: vi.fn().mockRejectedValue(new Error('Proxy HTTP 500: boom')),
    getTopicTraceCause: vi.fn().mockRejectedValue(new Error('Proxy HTTP 500: boom')),
  },
}));

import Home from '@/features/home/Home';

const wrap = () => render(<MemoryRouter><Home /></MemoryRouter>);

beforeEach(() => { report.mockClear(); refetch.mockClear(); Element.prototype.scrollIntoView = vi.fn(); });

describe('/today failure states', () => {
  it('topics load failure: inline panel with Retry, reported, no modal', () => {
    topicsState = { topics: [], loading: false, error: 'Network error', refetch, isStale: false, updatedAt: null, hasNewData: false };
    wrap();
    expect(screen.getByTestId('today-unavailable')).toBeTruthy();
    expect(screen.getByText("Couldn't load today's topics.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Something went wrong/);
    expect(report).toHaveBeenCalledWith('today-topics', expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('story AI failures: Summary / Prediction / Trace cause each fail in place with Retry', async () => {
    topicsState = {
      topics: [{ topicId: 't1', title: 'Story one', category: 'politics', sources: [] }],
      loading: false, error: null, refetch, isStale: false, updatedAt: null, hasNewData: false,
    };
    wrap();
    for (const label of ['Summary', 'Predict', 'Trace Cause']) fireEvent.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByText('Summary unavailable right now')).toBeTruthy();
    expect(await screen.findByText('Prediction unavailable right now')).toBeTruthy();
    expect(await screen.findByText('Trace cause unavailable right now')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Retry' }).length).toBe(3);
    expect(document.body.textContent).not.toMatch(/Something went wrong|Proxy HTTP 500/);
    expect(report.mock.calls.map((c) => c[0]).sort()).toEqual(['today-prediction', 'today-summary', 'today-trace-cause']);
  });
});
