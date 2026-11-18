// A merged situation keeps its oldest member's threadId but is titled by the current lead story, so
// the lead link and "Full analysis →" would open a different story than the one named. Hide them.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const sit = (over) => ({
  id: 'news#UKR#thread-old-1', source: 'news', verb_label: 'Ukraine — ceasefire talks open', axis: 'conflict',
  tier: 'high', state: 'escalating', escalating: true, centroid: { lat: 49, lon: 32 },
  iso3_affected: ['UKR'], affected_names: ['Ukraine'], opened_at: '2026-09-24T15:13:59.285Z',
  last_change_at: '2026-09-26T04:13:59.153Z', what_changed: '5 outlets', threadId: 'thread-old-1', ...over,
});
const state = vi.hoisted(() => ({ world: null }));

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: state.world, situations: state.world.situations, loading: false, error: null, asOf: state.world.sources.news, stale: false }),
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/shared/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], settled: true, loading: false, error: null, isStale: false, updatedAt: null, generatedDate: null }),
}));
vi.mock('@/features/threads', () => ({
  useWebIndex: () => ({ index: null, loading: false, failed: false }),
  deriveFromIndex: () => ({ fedInto: [], fedFrom: [] }),
}));
vi.mock('@/features/briefings', () => ({ useWeeklyBrief: () => ({ brief: null }) }));
vi.mock('@/features/countries', () => ({ CountryCardV2: () => null }));
vi.mock('@/features/map/hooks/useStoryCardData.js', () => ({
  useStoryCardData: () => ({ loading: false, summary: null, analysis: null, summaryError: false, analysisError: false, fetchError: false }),
}));
vi.mock('@/features/map/hooks/usePausedSince.js', () => ({ usePausedSince: () => ({ paused: null }) }));
vi.mock('@/shared/map/RadarMap.jsx', () => ({ default: () => <div data-testid="radar" /> }));

async function renderWith(situation, url) {
  state.world = {
    schema: 1, generated_at: '2026-09-26T05:13:59.323Z', next_expected_at: '2026-09-26T05:43:59.323Z',
    sources: { gdacs: '2026-09-26T05:05:07.869Z', news: '2026-09-26T04:50:16.515Z' }, stale: false, situations: [situation],
  };
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter initialEntries={[url]}><SituationHome /></MemoryRouter>);
}

describe('merged situation links', () => {
  // fixture timestamps are fixed; pin "now" so the freshness rule keeps the situation open
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-26T06:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('a merged lead shows its title with no reading link, and still selects on the map', async () => {
    await renderWith(sit({ threadIds: ['thread-old-1', 'thread-new-2'] }), '/');
    expect(screen.queryByRole('link', { name: /^Read ·/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Show on map/ })).toBeInTheDocument();
    expect(document.querySelector('.hud-brief-title')?.textContent).toBe('Ukraine — ceasefire talks open');
  });

  it('a merged situation detail has no "Full analysis →"', async () => {
    await renderWith(sit({ threadIds: ['thread-old-1', 'thread-new-2'] }), '/?focus=news%23UKR%23thread-old-1');
    expect(screen.getByRole('heading', { name: 'Ukraine — ceasefire talks open' })).toBeInTheDocument();
    expect(screen.queryByText(/Full analysis/)).toBeNull();
  });

  it('a single-thread lead still links to its story', async () => {
    await renderWith(sit({ threadIds: ['thread-old-1'] }), '/');
    expect(screen.getByRole('link', { name: /^Read ·/ })).toHaveAttribute('href', '/weekly/thread/thread-old-1');
  });

  it('a single-thread situation detail still has "Full analysis →"', async () => {
    await renderWith(sit({ threadIds: ['thread-old-1'] }), '/?focus=news%23UKR%23thread-old-1');
    expect(screen.getByRole('link', { name: /Full analysis/ })).toHaveAttribute('href', '/weekly/thread/thread-old-1');
  });
});
