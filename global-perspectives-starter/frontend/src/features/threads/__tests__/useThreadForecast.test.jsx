import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const recordForecast = vi.fn();
vi.mock('@/shared/api/forecastViews.js', () => ({ recordForecast: (...a) => recordForecast(...a) }));

const { useThreadForecast } = await import('@/features/threads/hooks/useThreadForecast.js');

describe('useThreadForecast reads the record only (decision 0052)', () => {
  beforeEach(() => { recordForecast.mockReset(); });

  it('returns the record forecast for the page topicIds', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot: { topicId: 'A-1', scenarios: [{ label: 'Most Likely' }] } });
    const { result } = renderHook(() => useThreadForecast(['A-1', 'A-2'], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot.topicId).toBe('A-1');
    expect(recordForecast).toHaveBeenCalledWith('t', ['A-1', 'A-2']);
  });

  it('a story that drew no question is empty', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot: null });
    const { result } = renderHook(() => useThreadForecast(['A-1'], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot).toBeNull();
  });

  it('the record not answering (stale views, unreadable file) is empty, with no other source', async () => {
    recordForecast.mockResolvedValue({ answered: false, snapshot: null });
    const { result } = renderHook(() => useThreadForecast(['A-1'], 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.snapshot).toBeNull();
  });

  it('null topicIds asks for the story\'s forecast whole (a story with no entries has no topics)', async () => {
    recordForecast.mockResolvedValue({ answered: true, snapshot: { topicId: 'A-1', scenarios: [{ label: 'Most Likely' }] } });
    const { result } = renderHook(() => useThreadForecast(null, 't'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(recordForecast).toHaveBeenCalledWith('t', null);
    expect(result.current.snapshot.topicId).toBe('A-1');
  });

  it('is empty without topics or without a thread, and asks nothing', async () => {
    const a = renderHook(() => useThreadForecast([], 't'));
    const b = renderHook(() => useThreadForecast(['A-1'], null));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(a.result.current.snapshot).toBeNull();
    expect(b.result.current.snapshot).toBeNull();
    expect(recordForecast).not.toHaveBeenCalled();
  });
});
