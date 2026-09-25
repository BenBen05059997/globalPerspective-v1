// ThreadPage must render both stored rootCauseChain shapes: a plain string, and the
// three-layer object {proximate, medium_term, deeper_structural} that crashed the page
// (React error #31) when "Root cause" was opened.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const THREAD_ID = 'thread-test-root-cause-abc123';
let rootCauseChain;

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
  useThreadAnalyses: () => ({ analyses: { [THREAD_ID]: { threadTitle: 'Test story', rootCauseChain } }, loading: false, error: null }),
}));
vi.mock('@/features/economy/hooks/useEconomicImpact', () => ({
  useEconomicImpact: () => ({ data: null, loading: false, error: null }),
}));
vi.mock('@/features/threads/hooks/useThreadForecast', () => ({
  useThreadForecast: () => ({ snapshot: null, loading: false }),
}));
vi.mock('@/shared/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('@/shared/ui/IntelligenceLoader', () => ({ default: () => <div data-testid="loader" /> }));

async function renderPage() {
  const ThreadPage = (await import('@/features/threads/ThreadPage')).default;
  render(
    <MemoryRouter initialEntries={[`/weekly/thread/${THREAD_ID}`]}>
      <Routes><Route path="/weekly/thread/:threadId" element={<ThreadPage />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /root cause/i }));
}

describe('ThreadPage — root cause', () => {
  it('renders the three-layer object as labelled steps without crashing', async () => {
    rootCauseChain = { proximate: 'Blockade began.', medium_term: 'Months-long war.', deeper_structural: 'Decades of rivalry.' };
    await renderPage();
    expect(screen.getByText('Trigger')).toBeTruthy();
    expect(screen.getByText('Enabling condition')).toBeTruthy();
    expect(screen.getByText('Structural factor')).toBeTruthy();
    expect(screen.getByText('Decades of rivalry.')).toBeTruthy();
  });

  it('still renders a plain-string root cause', async () => {
    rootCauseChain = 'A single paragraph of causes.';
    await renderPage();
    expect(screen.getByText('A single paragraph of causes.')).toBeTruthy();
    expect(screen.queryByText('Trigger')).toBeNull();
  });
});
