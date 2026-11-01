import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const recordForecast = vi.fn();
vi.mock('@/shared/api/forecastViews.js', () => ({ recordForecast: (...a) => recordForecast(...a) }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

const { useStoryQuestion } = await import('@/features/briefings/hooks/useStoryQuestion.js');

const future = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
const snapshot = { scenarios: [{ label: 'A', triggers: [{ id: '0-0', text: 'Will it', deadline: future, question: true, qid: 'q', p: 50, state: 'awaiting' }] }] };
let n = 0;
const thread = () => `th-${(n += 1)}`; // the hook caches per thread for the tab

describe('useStoryQuestion reads the record only (decision 0052)', () => {
  beforeEach(() => { recordForecast.mockReset(); });

  it('uses the forecasts view when it answers', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current.text).toBe('Will it');
  });

  it('a story with no forecast, answered by the record, shows nothing', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot: null });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(recordForecast).toHaveBeenCalledWith(id));
    expect(result.current).toBeNull();
  });

  it('shows nothing when the record cannot answer (stale views, unreadable file)', async () => {
    recordForecast.mockResolvedValue({ answered: false, snapshot: null });
    const id = thread();
    const { result } = renderHook(() => useStoryQuestion(id));
    await waitFor(() => expect(recordForecast).toHaveBeenCalledWith(id));
    expect(result.current).toBeNull();
  });
});
