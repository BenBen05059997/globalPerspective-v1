import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const recordForecast = vi.fn();
const fetchPredictionSnapshotByThread = vi.fn();
vi.mock('@/shared/api/forecastViews.js', () => ({ recordForecast: (...a) => recordForecast(...a) }));
vi.mock('@/shared/api/restProxy.js', () => ({ fetchPredictionSnapshotByThread: (...a) => fetchPredictionSnapshotByThread(...a) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

const { useStoryQuestion } = await import('@/features/briefings/hooks/useStoryQuestion.js');

const future = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
const snapshot = { scenarios: [{ label: 'A', triggers: [{ id: '0-0', text: 'Will it', deadline: future, question: true, qid: 'q', p: 50, state: 'awaiting' }] }] };
let n = 0;
const thread = () => `th-${(n += 1)}`; // the hook caches per thread for the tab

describe('useStoryQuestion reads the record first (decision 0052)', () => {
  beforeEach(() => { recordForecast.mockReset(); fetchPredictionSnapshotByThread.mockReset(); });

  it('uses the forecasts view when it answers and never calls the action', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current.text).toBe('Will it');
    expect(fetchPredictionSnapshotByThread).not.toHaveBeenCalled();
  });

  it('a story with no forecast, answered by the record, shows nothing and does not call the action', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot: null });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(recordForecast).toHaveBeenCalledWith(id));
    expect(result.current).toBeNull();
    expect(fetchPredictionSnapshotByThread).not.toHaveBeenCalled();
  });

  it('falls back to the action when the record cannot answer', async () => {
    recordForecast.mockResolvedValue({ answered: false, snapshot: null });
    fetchPredictionSnapshotByThread.mockResolvedValue({ success: true, snapshot });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(fetchPredictionSnapshotByThread).toHaveBeenCalledTimes(1);
  });
});
