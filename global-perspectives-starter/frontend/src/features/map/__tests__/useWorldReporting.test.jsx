// useWorld error reporting: one retry before a failure counts; only a real first-load failure is reported.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorld } from '@/features/map/hooks/useWorld.js';

const h = vi.hoisted(() => ({ fetchWorld: vi.fn(), report: vi.fn() }));
vi.mock('@/features/map/api/worldData.js', () => ({
  fetchWorld: (...a) => h.fetchWorld(...a),
  fetchSituationDetail: vi.fn(),
  oldestSource: () => null,
}));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: (...a) => h.report(...a) }));

const BUNDLE = { situations: [], sources: {} };
const boom = () => new TypeError('Failed to fetch');
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(2000); });
const setVisibility = (v) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });

beforeEach(() => { vi.useFakeTimers(); h.fetchWorld.mockReset(); h.report.mockReset(); setVisibility('visible'); });
afterEach(() => { vi.useRealTimers(); setVisibility('visible'); });

describe('useWorld error reporting', () => {
  it('retry then success: no report', async () => {
    h.fetchWorld.mockRejectedValueOnce(boom()).mockResolvedValueOnce(BUNDLE);
    const { result } = renderHook(() => useWorld());
    await settle();
    expect(h.fetchWorld).toHaveBeenCalledTimes(2);
    expect(result.current.world).toBe(BUNDLE);
    expect(h.report).not.toHaveBeenCalled();
  });

  it('retry then fail with no bundle: exactly one report', async () => {
    h.fetchWorld.mockRejectedValue(boom());
    const { result } = renderHook(() => useWorld());
    await settle();
    expect(h.fetchWorld).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeTruthy();
    expect(h.report).toHaveBeenCalledTimes(1);
    expect(h.report).toHaveBeenCalledWith('map-world', expect.any(Error));
  });

  it('failed poll while a bundle is held: silent, error still set for the stale banner', async () => {
    h.fetchWorld.mockResolvedValueOnce(BUNDLE).mockRejectedValue(boom());
    const { result } = renderHook(() => useWorld());
    await settle();
    await act(async () => { result.current.refresh(); await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.error).toBeTruthy();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('failure while the page is hidden: no report', async () => {
    h.fetchWorld.mockRejectedValue(boom());
    setVisibility('hidden');
    renderHook(() => useWorld());
    await settle();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('failure after pagehide: no report', async () => {
    h.fetchWorld.mockRejectedValue(boom());
    renderHook(() => useWorld());
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await settle();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('our own abort (unmount): no report, no retry', async () => {
    h.fetchWorld.mockImplementation((signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const { unmount } = renderHook(() => useWorld());
    unmount();
    await settle();
    expect(h.fetchWorld).toHaveBeenCalledTimes(1);
    expect(h.report).not.toHaveBeenCalled();
  });
});
