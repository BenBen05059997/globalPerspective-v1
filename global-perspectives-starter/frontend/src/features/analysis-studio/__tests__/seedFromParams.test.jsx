// /analyze?stories=<threadId> must preselect a thread that exists only in the 30-day archive, even though
// the real useWeeklyArchive hook starts with loading=false and an empty dayMap and fills it after mount
// (cache read or fetch). Uses the real hook with a mocked fetchArchiveRange.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

configure({ asyncUtilTimeout: 5000 });

const MOCK_USER = { uid: 'test-user', isAnonymous: false };
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: MOCK_USER, loading: false }) }));
vi.mock('@/shared/hooks/useMembership', () => ({
  useMembership: () => ({ isMember: false, creditBalance: 0, available: false, refresh: vi.fn() }),
}));
const TOPICS = [{ topicId: 'today-1', threadId: 'thread-today-1', title: 'A story from today', category: 'Politics', regions: ['Europe'] }];
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => ({ topics: TOPICS, loading: false, settled: true }) }));

const ARCHIVE = {
  '2026-10-19': {
    source: 'archive',
    updatedAt: '2026-10-19T00:00:00.000Z',
    entries: [{ topicId: 'French Students-3', threadId: 'thread-french-student-protests-turn-v-68e0fb', title: 'French student protests turn violent', category: 'Politics', regions: ['Europe'] }],
  },
  '2026-09-30': {
    source: 'archive',
    updatedAt: '2026-09-30T00:00:00.000Z',
    entries: [{ topicId: 'French Students-1', threadId: 'thread-french-student-protests-turn-v-68e0fb', title: 'French students march', category: 'Politics', regions: ['Europe'] }],
  },
};
vi.mock('@/shared/api/restProxy', () => ({
  analyzeConfigured: () => false,
  runMemberAnalysis: vi.fn(),
  fetchSummaryCache: vi.fn(async () => null),
  fetchPredictionCache: vi.fn(async () => null),
  fetchTraceCauseCache: vi.fn(async () => null),
  fetchNarrativeThread: vi.fn(async () => ({ data: [] })),
  fetchThreadAnalyses: vi.fn(async () => ({ data: {} })),
  fetchPredictionSnapshot: vi.fn(async () => ({ snapshot: null })),
  fetchArchiveRange: vi.fn(async () => ({ data: ARCHIVE })),
}));

import AnalysisStudio from '@/features/analysis-studio/AnalysisStudio.jsx';

const THREAD = 'thread-french-student-protests-turn-v-68e0fb';
function renderAt(search) {
  return render(
    <MemoryRouter initialEntries={[`/analyze${search}`]}><AnalysisStudio /></MemoryRouter>
  );
}

describe('AnalysisStudio ?stories= seeding with a late-arriving archive', () => {
  beforeEach(() => { localStorage.clear(); });

  it('preselects an archive-only thread id after the archive fetch completes', async () => {
    renderAt(`?stories=${THREAD}`);
    await waitFor(() => expect(screen.getByText('1/4')).toBeInTheDocument());
  });

  it('preselects it when the archive comes from a fresh localStorage cache', async () => {
    localStorage.setItem('gp_weekly_archive_v1', JSON.stringify({ dayMap: ARCHIVE, tier: 'member', uid: 'test-user', timestamp: Date.now() }));
    renderAt(`?stories=${THREAD}`);
    await waitFor(() => expect(screen.getByText('1/4')).toBeInTheDocument());
  });

  it('still preselects a today topic id and leaves a no-param visit empty', async () => {
    const { unmount } = renderAt('?stories=today-1');
    await waitFor(() => expect(screen.getByText('1/4')).toBeInTheDocument());
    unmount();
    renderAt('');
    await screen.findByText('A story from today');
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });
});
