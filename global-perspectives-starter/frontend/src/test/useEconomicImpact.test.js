/**
 * Tests for useEconomicImpact + useDisruptionsList — cache + fetch lifecycle.
 * Mirrors useSystemsAnalysis.test.js pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const MOCK_IMPACT = {
  scope: 'thread',
  scopeId: 'thread-iran-x1',
  hasImpact: true,
  headline: 'Iran-Israel tensions push Brent +4%',
  severity: 'severe',
  severityScore: 72,
  confidence: 'high',
  horizon: 'days',
  instruments: [
    { instrumentId: 'BRENT', direction: 'up', magnitude: 'moderate', rationale: 'supply risk', citedTopicIds: ['topic-abc'] },
    { instrumentId: 'GOLD', direction: 'up', magnitude: 'moderate', rationale: 'haven bid', citedTopicIds: ['topic-abc'] },
  ],
  winners: [{ name: 'Saudi Arabia', type: 'country', why: 'spare capacity' }],
  losers: [{ name: 'Japan', type: 'country', why: 'oil import dependence' }],
  mechanism: 'Hormuz transits [topic-abc]',
  citedTopicIds: ['topic-abc'],
  generatedAt: '2026-05-19T07:30:00Z',
};

const MOCK_LIST = [
  { ...MOCK_IMPACT, scopeId: 'thread-a', severity: 'severe', severityScore: 85 },
  { ...MOCK_IMPACT, scopeId: 'thread-b', severity: 'moderate', severityScore: 65 },
  { ...MOCK_IMPACT, scopeId: 'thread-c', severity: 'minor', severityScore: 25 },
];

vi.mock('../services/restProxy.js', () => ({
  fetchEconomicImpact: vi.fn(),
  fetchDisruptionsList: vi.fn(),
}));

import { fetchEconomicImpact, fetchDisruptionsList } from '../services/restProxy.js';
import { useEconomicImpact } from '../hooks/useEconomicImpact';
import { useDisruptionsList } from '../hooks/useDisruptionsList';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(k => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
    removeItem: vi.fn(k => { delete store[k]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('useEconomicImpact — fetch lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    fetchEconomicImpact.mockResolvedValue({ success: true, data: MOCK_IMPACT });
  });

  it('returns null initially while loading', () => {
    const { result } = renderHook(() => useEconomicImpact('thread-iran-x1'));
    expect(result.current.data).toBeNull();
  });

  it('fetches and sets data for a given threadId', async () => {
    const { result } = renderHook(() => useEconomicImpact('thread-iran-x1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchEconomicImpact).toHaveBeenCalledWith('thread-iran-x1');
    expect(result.current.data).toEqual(MOCK_IMPACT);
  });

  it('does not fetch when threadId is null', async () => {
    const { result } = renderHook(() => useEconomicImpact(null));
    await waitFor(() => true);
    expect(fetchEconomicImpact).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('returns null data on 404 (no record)', async () => {
    fetchEconomicImpact.mockResolvedValue({ success: false, error: 'Not found' });
    const { result } = renderHook(() => useEconomicImpact('thread-no-impact'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it('returns null data on network error (graceful fallback)', async () => {
    fetchEconomicImpact.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useEconomicImpact('thread-iran-x1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('network down');
  });

  it('writes fetched data to localStorage', async () => {
    const { result } = renderHook(() => useEconomicImpact('thread-iran-x1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'gp_econ_thread-iran-x1',
      expect.stringContaining('"hasImpact":true'),
    );
  });

  it('reads from cache when data is fresh (within TTL)', async () => {
    const cachedEntry = JSON.stringify({ data: MOCK_IMPACT, ts: Date.now() });
    localStorageMock.getItem.mockReturnValueOnce(cachedEntry);
    const { result } = renderHook(() => useEconomicImpact('thread-iran-x1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(fetchEconomicImpact).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(MOCK_IMPACT);
  });
});

describe('useDisruptionsList — filters + cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    fetchDisruptionsList.mockResolvedValue({ success: true, data: MOCK_LIST });
  });

  it('fetches list with no filters by default', async () => {
    const { result } = renderHook(() => useDisruptionsList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchDisruptionsList).toHaveBeenCalledWith({
      minSeverity: null, country: null, limit: 50,
    });
    expect(result.current.data).toHaveLength(3);
  });

  it('passes minSeverity filter to API', async () => {
    renderHook(() => useDisruptionsList({ minSeverity: 'moderate' }));
    await waitFor(() => expect(fetchDisruptionsList).toHaveBeenCalled());
    expect(fetchDisruptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ minSeverity: 'moderate' }),
    );
  });

  it('passes country filter to API', async () => {
    renderHook(() => useDisruptionsList({ country: 'Iran' }));
    await waitFor(() => expect(fetchDisruptionsList).toHaveBeenCalled());
    expect(fetchDisruptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'Iran' }),
    );
  });

  it('returns empty array on network error', async () => {
    fetchDisruptionsList.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDisruptionsList());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it('caches by filter key', async () => {
    const { rerender } = renderHook(({ country }) => useDisruptionsList({ country }), {
      initialProps: { country: 'Iran' },
    });
    await waitFor(() => expect(fetchDisruptionsList).toHaveBeenCalledTimes(1));
    rerender({ country: 'Iran' });
    await waitFor(() => true);
    // Same filter → cached, no second call
    expect(fetchDisruptionsList).toHaveBeenCalledTimes(1);
  });
});
