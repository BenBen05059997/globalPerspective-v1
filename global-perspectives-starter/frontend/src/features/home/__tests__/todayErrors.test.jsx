// /today fails inline and honestly (P3b): no modal, no "Something went wrong", the failure goes to the
// client-error sink, and every unavailable state carries a working Retry.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));

const refetch = vi.fn();
let topicsState;
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => topicsState }));
vi.mock('@/features/home/hooks/useTodayArchive', () => ({ useTodayArchive: () => ({ entries: [] }) }));
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => ({ data: null }) }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => ({ notes: [], total: 0 }) }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));
vi.mock('@/features/breaking/components/BreakingStrip', () => ({ default: () => null }));
const svc = vi.hoisted(() => ({
  getTopicSummary: vi.fn(),
  getTopicPrediction: vi.fn(),
  getTopicTraceCause: vi.fn(),
}));
const views = vi.hoisted(() => ({ fresh: false, view: null }));
vi.mock('@/shared/api/viewsFresh.js', () => ({ loadViewsFresh: async () => ({ fresh: views.fresh }) }));
vi.mock('@/shared/api/todayView.js', () => ({ loadTodayView: async () => views.view }));
vi.mock('@/shared/data/contentService', () => ({ default: svc }));

import Home from '@/features/home/Home';

const wrap = () => render(<MemoryRouter><Home /></MemoryRouter>);

const oneTopic = () => {
  topicsState = {
    topics: [{ topicId: 't1', title: 'Story one', category: 'politics', sources: [] }],
    loading: false, error: null, refetch, isStale: false, updatedAt: null, hasNewData: false,
  };
};

beforeEach(() => {
  views.fresh = false; views.view = null;
  report.mockClear(); refetch.mockClear(); Element.prototype.scrollIntoView = vi.fn();
  for (const f of Object.values(svc)) f.mockReset().mockRejectedValue(new Error('Proxy HTTP 500: boom'));
});

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

  it('an empty result is the honest unavailable state with a working Retry, reported', async () => {
    oneTopic();
    svc.getTopicSummary.mockResolvedValue({ content: '   ' });
    svc.getTopicTraceCause.mockResolvedValue({ content: '' });
    wrap();
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trace Cause' }));
    expect(await screen.findByText('Summary unavailable right now')).toBeTruthy();
    expect(await screen.findByText('Trace cause unavailable right now')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/generation failed/);
    expect(report.mock.calls.map((c) => c[0]).sort()).toEqual(['today-summary', 'today-trace-cause']);
    svc.getTopicSummary.mockResolvedValue({ content: '- A real takeaway' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    expect(await screen.findByText(/A real takeaway/)).toBeTruthy();
  });

  it('retry timers stop when the page unmounts', async () => {
    vi.useFakeTimers();
    try {
      oneTopic();
      svc.getTopicSummary.mockRejectedValue(new Error('Cache miss'));
      const { unmount } = wrap();
      fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
      await vi.advanceTimersByTimeAsync(0);
      expect(svc.getTopicSummary).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10000);
      expect(svc.getTopicSummary).toHaveBeenCalledTimes(2);
      unmount();
      await vi.advanceTimersByTimeAsync(60000);
      expect(svc.getTopicSummary).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Predict on a topic the latest run wrote without a forecast says so at once: no request, no retry, no network wording, links the story', async () => {
    topicsState = {
      topics: [{ topicId: 't1', threadId: 'thread-a-1', title: 'Story one', category: 'politics', sources: [] }],
      loading: false, error: null, refetch, isStale: false, updatedAt: null, hasNewData: false,
    };
    views.fresh = true;
    views.view = {
      schemaVersion: 1,
      latest: { topicIds: ['t1'], generationId: 'g1' },
      entries: [{ topicId: 't1', generationId: 'g1', notes: { summary: {}, trace_cause: {} } }],
    };
    wrap();
    fireEvent.click(screen.getByRole('button', { name: 'Predict' }));
    const card = await screen.findByTestId('no-forecast');
    expect(card.textContent).toMatch(/No new forecast was drawn for this story in the latest run/);
    expect(card.textContent).toMatch(/at most once a week/);
    expect(card.textContent).not.toMatch(/network|connecting/i);
    expect(card.querySelector('a')).toHaveAttribute('href', expect.stringContaining('/weekly/thread/thread-a-1'));
    expect(svc.getTopicPrediction).not.toHaveBeenCalled();
    expect(screen.queryByText('Prediction unavailable right now')).toBeNull();
    expect(report).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('no-forecast')).toBeNull();
  });

  it('a topic whose view shows a forecast (or cannot prove none) still asks and reports as before', async () => {
    oneTopic();
    views.fresh = true;
    views.view = { schemaVersion: 1, latest: { topicIds: ['t1'], generationId: 'g1' }, entries: [{ topicId: 't1', generationId: 'g1', notes: { summary: {}, prediction: {} } }] };
    wrap();
    fireEvent.click(screen.getByRole('button', { name: 'Predict' }));
    expect(await screen.findByText('Prediction unavailable right now')).toBeTruthy();
    expect(svc.getTopicPrediction).toHaveBeenCalledTimes(1);
  });
});
