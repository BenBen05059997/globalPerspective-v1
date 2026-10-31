import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const fetchStoryView = vi.fn();
const fetchPredictionSnapshot = vi.fn();
const viewForecast = vi.fn();
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchStoryView }) }));
vi.mock('@/shared/api/restProxy.js', () => ({ fetchPredictionSnapshot: (...a) => fetchPredictionSnapshot(...a) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/features/threads/lib/viewForecast.js', () => ({ viewForecast: (...a) => viewForecast(...a) }));

const { useThreadForecast } = await import('@/features/threads/hooks/useThreadForecast.js');

describe('useThreadForecast', () => {
  beforeEach(() => { fetchStoryView.mockReset(); fetchPredictionSnapshot.mockReset(); viewForecast.mockReset(); });

  it('uses the story view when it yields a forecast, without calling the action', async () => {
    fetchStoryView.mockResolvedValue({ threadId: 't' });
    viewForecast.mockReturnValue({ topicId: 'A-1', scenarios: [{ label: 'Most Likely' }] });
    const { result } = renderHook(() => useThreadForecast(['A-1'], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot.topicId).toBe('A-1');
    expect(viewForecast).toHaveBeenCalledWith({ threadId: 't' }, { topicIds: ['A-1'] });
    expect(fetchPredictionSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to prediction_snapshot when the view yields nothing or fails', async () => {
    fetchStoryView.mockRejectedValue(new Error('500'));
    fetchPredictionSnapshot.mockResolvedValue({ success: true, snapshot: { topicId: 'old' } });
    const { result } = renderHook(() => useThreadForecast(['A-1'], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot.topicId).toBe('old');
    expect(fetchPredictionSnapshot).toHaveBeenCalledWith(['A-1']);
  });

  it('is empty without topics', async () => {
    const { result } = renderHook(() => useThreadForecast([], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot).toBeNull();
  });
});
