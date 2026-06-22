/**
 * Tests for useSystemsAnalysis hook — cache behavior and fetch lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const MOCK_DATA = {
  nodes: [
    { threadId: 'thread-a-123456', category: 'politics', peakDate: '2026-04-20', summary: 'Thread A summary' },
    { threadId: 'thread-b-abcdef', category: 'energy', peakDate: '2026-04-22', summary: 'Thread B summary' },
  ],
  edges: [
    { from: 'thread-a-123456', to: 'thread-b-abcdef', lagDays: 2, confidence: 'strong', mechanism: 'A caused B', citedEntries: [] },
  ],
};

vi.mock('../services/restProxy.js', () => ({
  fetchSystemsAnalysis: vi.fn(),
}));

import { fetchSystemsAnalysis } from '../services/restProxy.js';
import { useSystemsAnalysis } from '../hooks/useSystemsAnalysis';

// Minimal localStorage mock
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

describe('useSystemsAnalysis — fetch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    fetchSystemsAnalysis.mockResolvedValue({ success: true, data: MOCK_DATA });
  });

  it('returns null data initially while loading', async () => {
    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    expect(result.current.data).toBeNull();
  });

  it('fetches and sets data for a given country', async () => {
    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSystemsAnalysis).toHaveBeenCalledWith('Iran');
    expect(result.current.data).toEqual(MOCK_DATA);
  });

  it('does not fetch when countryName is null', async () => {
    const { result } = renderHook(() => useSystemsAnalysis(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSystemsAnalysis).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when countryName is empty string', async () => {
    renderHook(() => useSystemsAnalysis(''));
    await waitFor(() => true);
    expect(fetchSystemsAnalysis).not.toHaveBeenCalled();
  });
});

describe('useSystemsAnalysis — cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    fetchSystemsAnalysis.mockResolvedValue({ success: true, data: MOCK_DATA });
  });

  it('writes fetched data to localStorage', async () => {
    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'gp_systems_Iran',
      expect.stringContaining('"nodes"')
    );
  });

  it('reads from cache when data is fresh (within TTL)', async () => {
    const cachedEntry = JSON.stringify({ data: MOCK_DATA, ts: Date.now() });
    localStorageMock.getItem.mockReturnValueOnce(cachedEntry);

    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(fetchSystemsAnalysis).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(MOCK_DATA);
  });

  it('re-fetches when cache is stale (> 1 hour old)', async () => {
    const staleTs = Date.now() - (61 * 60 * 1000); // 61 minutes ago
    const staleEntry = JSON.stringify({ data: { nodes: [], edges: [] }, ts: staleTs });
    localStorageMock.getItem.mockReturnValueOnce(staleEntry);

    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(fetchSystemsAnalysis).toHaveBeenCalledWith('Iran');
    expect(result.current.data).toEqual(MOCK_DATA);
  });

  it('handles malformed cache entry gracefully', async () => {
    localStorageMock.getItem.mockReturnValueOnce('not-valid-json{{{{');

    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchSystemsAnalysis).toHaveBeenCalledWith('Iran');
  });
});

describe('useSystemsAnalysis — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('sets error when fetch throws', async () => {
    fetchSystemsAnalysis.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('handles API returning success:false gracefully', async () => {
    fetchSystemsAnalysis.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useSystemsAnalysis('Iran'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
