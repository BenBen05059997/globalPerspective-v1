// M6 · L2: the "Key" legend is a compact, collapsed-by-default toggle (aria-expanded), remembered
// per viewer in localStorage — it used to be an always-open block covering the map's bottom-left
// corner. Must also survive a throwing localStorage (private window / blocked storage).
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('map console — Key legend (M6, L2)', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('is collapsed by default, with aria-expanded=false on the toggle', async () => {
    await renderHome();
    const btn = screen.getByRole('button', { name: /key/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/how to read the map/i)).not.toBeInTheDocument();
  });

  it('opens on click, sets aria-expanded=true, and remembers the choice', async () => {
    await renderHome();
    const btn = screen.getByRole('button', { name: /key/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/how to read the map/i)).toBeInTheDocument();
    expect(localStorage.getItem('gp_map_legend_open')).toBe('1');
  });

  it('closes via the close button and persists that too', async () => {
    localStorage.setItem('gp_map_legend_open', '1');
    await renderHome();
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByLabelText(/how to read the map/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('gp_map_legend_open')).toBe('0');
  });

  it('opens already-expanded when a prior visit left it open', async () => {
    localStorage.setItem('gp_map_legend_open', '1');
    await renderHome();
    const btn = screen.getByRole('button', { name: /key/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/how to read the map/i)).toBeInTheDocument();
  });

  it('still renders and toggles correctly when localStorage throws', async () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await renderHome();
    const btn = screen.getByRole('button', { name: /key/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/how to read the map/i)).toBeInTheDocument();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});
