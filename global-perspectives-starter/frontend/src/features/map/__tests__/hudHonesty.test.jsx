// M2: the console must never claim the news desk is "live"/"updated" when it has produced 0
// news situations while analysis is paused — it must say so plainly, with a computed date.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const OLD_GENERATED_AT = '2026-09-12T09:00:00.000Z'; // > 36h before any plausible "now" in CI

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
    last_change_at: '2026-09-26T04:13:59.153Z', what_changed: 'Alert raised', threadId: null,
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
  useDailyBrief: () => ({ brief: { generatedAt: OLD_GENERATED_AT }, servedDateKey: '2026-09-12', loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));

describe('map console — honesty (M2)', () => {
  // R4a: fixture timestamps are fixed; pin "now" so the 30-day freshness rule never hides them.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-26T06:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the paused status line with a computed date, and never claims the news desk is live/updated', async () => {
    const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
    render(<MemoryRouter><SituationHome /></MemoryRouter>);

    const expectedLabel = new Date(OLD_GENERATED_AT).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(screen.getAllByText(new RegExp(`PAUSED SINCE ${expectedLabel}`, 'i')).length).toBeGreaterThan(0);

    const newsRow = screen.getByText(/0 new stories/i);
    expect(newsRow.textContent).toMatch(/analysis paused since/i);
    expect(newsRow.textContent).not.toMatch(/^live/i);
    expect(newsRow.textContent).not.toMatch(/updated/i);

    // GDACS is the one source allowed to say "live" (it is genuinely polled live).
    expect(screen.getByText(/^live · checked/i)).toBeInTheDocument();
  });

  it('shows a dimmed-but-present zero count for tiers with no open situations', async () => {
    const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
    render(<MemoryRouter><SituationHome /></MemoryRouter>);
    // "high" has 0 open situations in this fixture but must still be rendered, not hidden.
    const zero = document.querySelector('.hud-brief-count-zero .hud-brief-count-n');
    expect(zero).toBeTruthy();
    expect(zero.textContent).toBe('0');
  });
});
