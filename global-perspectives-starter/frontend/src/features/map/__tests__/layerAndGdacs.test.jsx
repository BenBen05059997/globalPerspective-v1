// normalizeLayer (URL / localStorage value -> a valid map layer or null) and useGdacsStatus (the site status
// line's disaster-alert state: one cached world read, only while enabled, 'unknown' when it fails).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const fetchWorld = vi.fn();
vi.mock('@/features/map/api/worldData.js', () => ({ fetchWorld: (...a) => fetchWorld(...a) }));

import { normalizeLayer, DEFAULT_LAYER } from '@/features/map/lib/layerMode.js';
import { useGdacsStatus } from '@/features/map/hooks/useGdacsStatus';
import { clearMemoryCache } from '@/shared/api/useCachedQuery.js';

describe('normalizeLayer', () => {
  it.each(['situations', 'risk'])('keeps the valid mode %s', (v) => {
    expect(normalizeLayer(v)).toBe(v);
  });

  it.each([['Risk'], [''], [null], [undefined], ['countries'], [1], [['risk']]])('%j -> null so the caller falls back', (v) => {
    expect(normalizeLayer(v)).toBeNull();
  });

  it('the default layer is itself valid', () => {
    expect(normalizeLayer(DEFAULT_LAYER)).toBe(DEFAULT_LAYER);
  });
});

describe('useGdacsStatus', () => {
  beforeEach(() => { fetchWorld.mockReset(); clearMemoryCache(); });

  it('disabled: no read at all and nothing claimed', () => {
    const { result } = renderHook(() => useGdacsStatus(false));
    expect(result.current).toEqual({ state: 'unknown', checkedAt: null });
    expect(fetchWorld).not.toHaveBeenCalled();
  });

  it('enabled: reads the world bundle once and reports live for a check under two hours old', async () => {
    const checked = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    fetchWorld.mockResolvedValue({ sources: { gdacs: checked } });
    const { result } = renderHook(() => useGdacsStatus(true));
    await waitFor(() => expect(result.current.state).toBe('live'));
    expect(result.current.checkedAt.toISOString()).toBe(checked);
    expect(fetchWorld).toHaveBeenCalledTimes(1);
  });

  it('a check older than two hours is stale', async () => {
    fetchWorld.mockResolvedValue({ sources: { gdacs: new Date(Date.now() - 3 * 3600 * 1000).toISOString() } });
    const { result } = renderHook(() => useGdacsStatus(true));
    await waitFor(() => expect(result.current.state).toBe('stale'));
  });

  it('a world bundle with no GDACS stamp, a missing bundle (404 -> null) and a failed read all stay unknown', async () => {
    fetchWorld.mockResolvedValueOnce({ sources: {} });
    const a = renderHook(() => useGdacsStatus(true));
    await waitFor(() => expect(fetchWorld).toHaveBeenCalledTimes(1));
    expect(a.result.current.state).toBe('unknown');
    a.unmount();

    clearMemoryCache();
    fetchWorld.mockResolvedValueOnce(null);
    const b = renderHook(() => useGdacsStatus(true));
    await waitFor(() => expect(fetchWorld).toHaveBeenCalledTimes(2));
    expect(b.result.current).toEqual({ state: 'unknown', checkedAt: null });
    b.unmount();

    clearMemoryCache();
    fetchWorld.mockRejectedValueOnce(new Error('worldData 500'));
    const c = renderHook(() => useGdacsStatus(true));
    await waitFor(() => expect(fetchWorld).toHaveBeenCalledTimes(3));
    expect(c.result.current).toEqual({ state: 'unknown', checkedAt: null });
  });
});
