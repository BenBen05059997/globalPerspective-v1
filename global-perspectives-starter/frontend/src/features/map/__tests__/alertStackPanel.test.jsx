// R4a · the desktop console's alert stack: a card per open situation (GDACS + news), a click
// selects it (the map flies there, the live region announces it), and an honest empty line.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let SITUATIONS = [];
vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({
    world: { schema: 1, generated_at: '2026-09-26T05:13:59Z', sources: { gdacs: '2026-09-26T05:05:07Z', news: '2026-09-26T04:50:16Z' }, situations: SITUATIONS },
    situations: SITUATIONS, loading: false, error: null, asOf: '2026-09-26T04:50:16Z', stale: false,
  }),
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/features/daily/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: { generatedAt: '2026-09-12T09:00:00Z' }, servedDateKey: '2026-09-12', loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: [], loading: false, error: null, isStale: false, updatedAt: null, generatedDate: null }),
}));

const base = { iso3_affected: [], affected_names: [], threadId: null, centroid: { lat: 10, lon: 10 } };
const GDACS = { ...base, id: 'gdacs#TC#1', source: 'gdacs', verb_label: 'Mexico — tropical cyclone', axis: 'humanitarian', tier: 'elevated', state: 'emerging', escalating: false, affected_names: ['Mexico'], opened_at: '2026-09-26T02:00:00Z', last_change_at: '2026-09-26T02:00:00Z', what_changed: 'GDACS Orange alert opened · tropical cyclone' };
const NEWS = { ...base, id: 'news#1', source: 'news', verb_label: 'Sudan — fighting', axis: 'conflict', tier: 'high', state: 'peak', escalating: false, affected_names: ['Sudan'], opened_at: '2026-09-20T00:00:00Z', last_change_at: '2026-09-24T00:00:00Z', what_changed: '9 outlets' };
const STALE = { ...base, id: 'news#old', source: 'news', verb_label: 'Old one', axis: 'economic', tier: 'moderate', state: 'peak', escalating: false, opened_at: '2026-07-01T00:00:00Z', last_change_at: '2026-08-01T00:00:00Z' };

async function renderHome() {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter><SituationHome /></MemoryRouter>);
}

describe('map console — desktop alert stack (R4a)', () => {
  beforeEach(() => {
    localStorage.clear(); vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T06:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('lists open situations most severe first, with kind, tier, GDACS level and badge', async () => {
    SITUATIONS = [GDACS, NEWS, STALE];
    await renderHome();
    const stack = screen.getByRole('region', { name: 'Alerts' });
    const cards = within(stack).getAllByRole('button');
    expect(cards.map((c) => within(c).getByText(/—/).textContent)).toEqual(['Sudan — fighting', 'Mexico — tropical cyclone']);
    expect(within(cards[0]).getByText('◆')).toBeInTheDocument(); // steady (peak)
    expect(within(cards[1]).getByText('ORANGE ALERT')).toBeInTheDocument();
    expect(within(cards[1]).getByText('●')).toBeInTheDocument(); // new (emerging)
    // the 30d+ one is not a card, but it is counted
    expect(within(stack).queryByText('Old one')).not.toBeInTheDocument();
    expect(within(stack).getByText(/1 open situation not updated in 30\+ days/)).toBeInTheDocument();
  });

  it('a card click selects the situation (announced) and marks the card pressed', async () => {
    SITUATIONS = [GDACS, NEWS];
    await renderHome();
    const stack = screen.getByRole('region', { name: 'Alerts' });
    const card = within(stack).getByText('Mexico — tropical cyclone').closest('button');
    fireEvent.click(card);
    expect(document.querySelector('.sh-sr-only[aria-live="polite"]').textContent).toBe('Selected: Mexico — tropical cyclone');
    expect(within(screen.getByRole('region', { name: 'Alerts' })).getByText('Mexico — tropical cyclone').closest('button'))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the honest, computed empty line when nothing is open', async () => {
    SITUATIONS = [];
    await renderHome();
    const stack = screen.getByRole('region', { name: 'Alerts' });
    const label = new Date('2026-09-12T09:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(within(stack).getByText(`No disaster alerts open · news situations paused since ${label}`)).toBeInTheDocument();
    expect(within(stack).queryAllByRole('button')).toHaveLength(0);
  });
});
