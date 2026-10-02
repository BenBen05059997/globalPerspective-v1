// Read in full, "Why" (P8): "Shares actors with" (FACT, from the story-web index), the provenance line and
// the "N older links hidden" count render only from real rows; weight-1 overlaps are collapsed.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const THREAD_ID = 'thread-test-why-shared-abc123';
const LINKS = vi.hoisted(() => ({ value: null }));

vi.mock('@/features/threads/hooks/useNarrativeThread', () => ({
  useNarrativeThread: () => ({
    entries: [{ topicId: 't1', threadId: THREAD_ID, title: 'Test story headline', date: '2026-09-20', category: 'conflict', regions: ['Iran'], sources: [{ source: 'Reuters', tier: 'primary' }] }],
    loading: false,
  }),
}));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({ useWeeklyArchive: () => ({ dayMap: {}, sortedDates: [], loading: false, error: null }) }));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({ analyses: { [THREAD_ID]: { threadTitle: 'Test story', storyArc: 'An arc.' } }, loading: false, error: null }),
}));
vi.mock('@/features/economy/hooks/useEconomicImpact', () => ({ useEconomicImpact: () => ({ data: null, loading: false, error: null }) }));
vi.mock('@/features/threads/hooks/useThreadForecast', () => ({ useThreadForecast: () => ({ snapshot: null, loading: false }) }));
vi.mock('@/features/threads/hooks/useStoryLinks', () => ({ useStoryLinks: () => LINKS.value }));
vi.mock('@/shared/contexts/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));

const base = { fedInto: [], fedFrom: [], loading: false, note: null, state: 'linked', shared: [], hiddenOlder: 0, provenance: null };
async function renderPage() {
  const ThreadPage = (await import('@/features/threads/ThreadPage')).default;
  render(
    <MemoryRouter initialEntries={[`/weekly/thread/${THREAD_ID}`]}>
      <Routes><Route path="/weekly/thread/:threadId" element={<ThreadPage />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: /read in full/i })[0]);
}

describe('ThreadPage — Why: shared actors, provenance, hidden-older', () => {
  it('shows strong overlaps, collapses weight-1 rows, and prints the provenance and hidden lines', async () => {
    LINKS.value = {
      ...base,
      shared: [
        { otherThreadId: 'B', otherTitle: 'Story B', actors: ['Donald Trump', 'Iran'], weight: 2, webs: [{ country: 'United States', generatedAt: '2026-10-01T05:00:00Z' }] },
        { otherThreadId: 'C', otherTitle: 'Story C', actors: ['Kyiv'], weight: 1, webs: [{ country: 'Ukraine', generatedAt: '2026-10-01T05:00:00Z' }] },
      ],
      hiddenOlder: 2,
      provenance: { countries: ['United States', 'Ukraine'], asOf: '2026-10-01T05:00:00Z' },
    };
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /shares actors with/i }));
    expect(screen.getByText('FACT')).toBeInTheDocument();
    expect(screen.getByText('Story B')).toBeInTheDocument();
    expect(screen.getByText('Donald Trump · Iran')).toBeInTheDocument();
    expect(screen.queryByText('Story C')).toBeNull(); // weight 1: collapsed
    fireEvent.click(screen.getByRole('button', { name: /show 1 weaker overlap/i }));
    expect(screen.getByText('Story C')).toBeInTheDocument();
    expect(screen.getByTestId('why-provenance')).toHaveTextContent('From analyses of United States · Ukraine, as of');
    expect(screen.getByTestId('why-hidden-older')).toHaveTextContent('2 older links hidden');
  });

  it('shows none of it when the index has nothing for the story', async () => {
    LINKS.value = { ...base };
    await renderPage();
    expect(screen.queryByRole('button', { name: /shares actors with/i })).toBeNull();
    expect(screen.queryByTestId('why-provenance')).toBeNull();
    expect(screen.queryByTestId('why-hidden-older')).toBeNull();
  });
});
