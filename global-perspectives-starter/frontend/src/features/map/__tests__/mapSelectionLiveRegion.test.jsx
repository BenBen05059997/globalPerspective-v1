// F2.12: the whole rail used to be aria-live="polite", so selecting a situation read out its
// entire detail panel (~1,400 chars). Replaced with one hidden, one-line "Selected: <title>" /
// "Selection cleared" live region, and the rail itself no longer carries aria-live.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const WORLD = {
  schema: 1,
  generated_at: '2026-09-26T05:13:59.323Z',
  next_expected_at: '2026-09-26T05:43:59.323Z',
  sources: { gdacs: '2026-09-26T05:05:07.869Z', news: '2026-09-26T04:50:16.515Z' },
  stale: false,
  situations: [{
    id: 'gdacs#TC#1001325', source: 'gdacs', verb_label: 'Mexico — tropical cyclone', axis: 'humanitarian',
    tier: 'elevated', state: 'escalating', escalating: true, centroid: { lat: 17.4, lon: -110.1 },
    iso3_affected: ['MEX'], affected_names: ['Mexico'], opened_at: '2026-09-24T15:13:59.285Z',
    last_change_at: '2026-09-26T04:13:59.153Z', what_changed: 'Alert raised Green→Orange', threadId: null,
  }],
};

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({
    world: WORLD, situations: WORLD.situations, loading: false, error: null,
    asOf: WORLD.sources.news, stale: false,
  }),
  useSituationDetail: () => ({ detail: null }),
}));

vi.mock('@/features/daily/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: { generatedAt: WORLD.generated_at }, servedDateKey: '2026-09-26', loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));

vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], loading: false, error: null, isStale: false, updatedAt: null, generatedDate: null }),
}));

async function renderHome() {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter><SituationHome /></MemoryRouter>);
}

describe('map console — selection live region (F2.12)', () => {
  // R4a: fixture timestamps are fixed; pin "now" so the 30-day freshness rule never hides them.
  beforeEach(() => {
    localStorage.clear(); vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T06:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('the rail no longer carries aria-live itself', async () => {
    await renderHome();
    const rail = document.querySelector('.sh-rail');
    expect(rail).toBeInTheDocument();
    expect(rail).not.toHaveAttribute('aria-live');
  });

  it('announces "Selected: <title>" when a situation is selected, then "Selection cleared" on back', async () => {
    await renderHome();
    const live = document.querySelector('.sh-sr-only[aria-live="polite"]');
    expect(live).toBeInTheDocument();
    expect(live.textContent).toBe('');

    const feedRow = document.querySelector('.hud-feed-list li button');
    fireEvent.click(feedRow);
    expect(live.textContent).toBe('Selected: Mexico — tropical cyclone');

    fireEvent.click(screen.getByRole('button', { name: /all situations/i }));
    expect(live.textContent).toBe('Selection cleared');
  });
});
