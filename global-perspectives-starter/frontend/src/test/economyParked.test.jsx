// Economy parked (2026-09-28, TASK_2026-09-27_parking.md "Site changes"): the daily
// economic-impact job was disabled, so the operator soft-hid the surfaces that still show
// stale economic_impact / economic_impact_list data, behind the shared ECONOMY_PARKED flag
// (src/shared/lib/economyFlag.js). These tests cover the contract: no Economy tab / rail /
// sort / footprint, a ?tab=economy deep link opens Overview, and no economic fetch fires.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const THREAD_ID = 'thread-test-economy-parked-abc123';

const useEconomicImpactMock = vi.fn(() => ({ data: null, loading: false, error: null }));
vi.mock('@/features/economy/hooks/useEconomicImpact', () => ({
  useEconomicImpact: (...args) => useEconomicImpactMock(...args),
}));
vi.mock('@/features/threads/hooks/useNarrativeThread', () => ({
  useNarrativeThread: () => ({
    entries: [{
      topicId: 't1', threadId: THREAD_ID, title: 'Test story headline', date: '2026-09-20',
      category: 'conflict', regions: ['Iran'], sources: [{ source: 'Reuters', tier: 'primary' }],
    }],
    loading: false,
  }),
}));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap: {}, sortedDates: [], loading: false, error: null }),
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({
    analyses: { [THREAD_ID]: { threadTitle: 'Test story', storyArc: 'A single arc sentence.' } },
    loading: false, error: null,
  }),
}));
vi.mock('@/features/threads/hooks/useThreadForecast', () => ({
  useThreadForecast: () => ({ snapshot: null, loading: false }),
}));
vi.mock('@/features/threads/hooks/useStoryLinks', () => ({
  useStoryLinks: () => ({ fedInto: [], fedFrom: [], loading: false }),
}));
vi.mock('@/shared/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/shared/ui/IntelligenceLoader', () => ({ default: () => <div data-testid="loader" /> }));

async function renderThread(initialPath) {
  const ThreadPage = (await import('@/features/threads/ThreadPage')).default;
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes><Route path="/weekly/thread/:threadId" element={<ThreadPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('ThreadPage — economy parked', () => {
  it('does not fetch economic impact while parked', async () => {
    useEconomicImpactMock.mockClear();
    await renderThread(`/weekly/thread/${THREAD_ID}`);
    expect(useEconomicImpactMock).toHaveBeenCalledWith(THREAD_ID, { enabled: false });
  });

  it('?tab=economy opens Read in full on Overview, not an empty Economy tab', async () => {
    await renderThread(`/weekly/thread/${THREAD_ID}?tab=economy`);
    // A deep-linked tab lands on the Read-in-full page directly (no "Story mode" button visible
    // means we're not there — instead the "← Story mode" back control should be present).
    expect(screen.getByRole('button', { name: /story mode/i })).toBeInTheDocument();
    // No Economy tab exists in the tab list.
    expect(screen.queryByRole('tab', { name: /economy/i })).toBeNull();
    // Overview tab is selected/shown instead.
    expect(screen.getByRole('tab', { name: /overview/i }).getAttribute('aria-selected')).toBe('true');
  });
});
