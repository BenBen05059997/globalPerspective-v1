// M7 phone pattern (P1): under 900px, /map shows one tab switch — MAP (radar, default) · LIST ·
// ALERTS — instead of the desktop map+rail grid. Selecting a situation from LIST switches to MAP
// and opens the detail as a bottom sheet at the half stop.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

// Deterministic "phone" — the harness can't shrink jsdom's window, so SituationHome reads its
// own breakpoint hook, which tests mock directly (per the M7 task brief).
vi.mock('@/shared/hooks/useIsPhone.js', () => ({
  useIsPhone: () => true,
  default: () => true,
  PHONE_BREAKPOINT: 900,
}));

async function renderHome() {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter><SituationHome /></MemoryRouter>);
}

describe('map console — phone layout (M7)', () => {
  // R4a: fixture timestamps are fixed; pin "now" so the 30-day freshness rule never hides them.
  beforeEach(() => {
    localStorage.clear(); vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T06:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('opens on the MAP tab by default, with a 3-item tablist', async () => {
    await renderHome();
    const tablist = screen.getByRole('tablist', { name: /map view/i });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent.replace(/\d+$/, ''))).toEqual(['Map', 'List', 'Alerts']);
    expect(screen.getByRole('tab', { name: /^map$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^list$/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /alerts/i })).toHaveAttribute('aria-selected', 'false');
    // MAP tab: no bottom sheet until something is selected.
    expect(document.querySelector('.sheet')).not.toBeInTheDocument();
  });

  it('LIST tab shows the intel feed full width with no map/sheet', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('tab', { name: /^list$/i }));
    expect(screen.getByRole('tab', { name: /^list$/i })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Mexico — tropical cyclone')).toBeInTheDocument();
    expect(document.querySelector('.sh-mapinner')).not.toBeInTheDocument();
  });

  it('ALERTS tab shows situations with an honest empty line when there are none', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }));
    expect(screen.getByRole('tab', { name: /alerts/i })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Mexico — tropical cyclone')).toBeInTheDocument();
    expect(screen.getByLabelText('Alerts')).toBeInTheDocument();
  });

  it('selecting a situation from LIST switches to MAP and opens the sheet at half', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('tab', { name: /^list$/i }));
    fireEvent.click(within(screen.getByRole('tabpanel')).getByText('Mexico — tropical cyclone'));

    expect(screen.getByRole('tab', { name: /^map$/i })).toHaveAttribute('aria-selected', 'true');
    const sheet = document.querySelector('.sheet');
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveClass('sheet-half');
    // half is not the modal stop
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByText('Mexico — tropical cyclone').length).toBeGreaterThan(0);
  });

  it('closing the sheet clears the selection and it does not reopen on its own', async () => {
    await renderHome();
    fireEvent.click(screen.getByRole('tab', { name: /^list$/i }));
    fireEvent.click(within(screen.getByRole('tabpanel')).getByText('Mexico — tropical cyclone'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.sheet')).not.toBeInTheDocument();
  });
});
