// Map fix round (2026-11-03): honest loading/unavailable/gone texts, the detail fetch keyed by the
// resolved situation, ?layer= followed after mount, ?country=<ISO2>, one freshness stamp, one situations
// list (Alerts) with Intel keeping only stories, and no outlet-count contradiction in the card header.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';

const S = vi.hoisted(() => ({
  world: null, loading: false, error: null,
  topics: [], topicsError: null, topicsSettled: true,
  webFailed: false, detailArgs: [], detailStatus: 'ready', detail: null, isPhone: false,
}));

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: S.world, situations: S.world?.situations || [], loading: S.loading, error: S.error, asOf: null, stale: false }),
  useSituationDetail: (id) => { S.detailArgs.push(id); return { detail: S.detail, status: S.detailStatus }; },
}));
vi.mock('@/shared/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }), MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({
    topics: S.topics, settled: S.topicsSettled, loading: false, error: S.topicsError, isStale: false,
    updatedAt: '2026-11-03T04:00:00Z', generatedDate: null, refetch() {},
  }),
}));
vi.mock('@/features/threads', () => ({
  useWebIndex: () => ({ index: null, loading: false, failed: S.webFailed }),
  deriveFromIndex: () => ({ fedInto: [], fedFrom: [] }),
}));
vi.mock('@/features/briefings', () => ({ useWeeklyBrief: () => ({ brief: null }) }));
vi.mock('@/features/countries', () => ({ CountryCardV2: ({ name }) => <div data-testid="country-card">{name}</div> }));
vi.mock('@/features/map/hooks/useStoryCardData.js', () => ({
  useStoryCardData: () => ({ loading: false, summary: null, analysis: null, summaryError: false, analysisError: false, fetchError: false }),
}));
vi.mock('@/features/map/hooks/usePausedSince.js', () => ({ usePausedSince: () => ({ paused: null }) }));
vi.mock('@/features/map/hooks/useCountryRiskLayer.js', () => ({
  useCountryRiskLayer: () => ({ drawn: [], hiddenOld: 0, loading: false }),
}));
vi.mock('@/shared/hooks/useIsPhone.js', () => ({
  useIsPhone: () => S.isPhone, default: () => S.isPhone, PHONE_BREAKPOINT: 900,
}));
vi.mock('@/shared/map/RadarMap.jsx', () => ({
  default: (p) => <div data-testid="radar" data-situations={p.situations.length} />,
}));

const sit = (over) => ({
  id: 'x', source: 'news', verb_label: 'X', axis: 'conflict', tier: 'high', state: 'peak', escalating: false,
  centroid: { lat: 10, lon: 10 }, iso3_affected: ['UKR'], affected_names: [], opened_at: '2026-11-03T01:00:00Z',
  last_change_at: '2026-11-03T04:00:00Z', what_changed: null, threadId: null, ...over,
});
const world = (situations, over = {}) => ({
  schema: 1, generated_at: '2026-11-03T05:00:00Z', next_expected_at: '2026-11-03T05:30:00Z',
  sources: { gdacs: '2026-11-03T04:50:00Z', news: '2026-11-03T04:00:00Z', newsDegraded: false }, stale: false, situations, ...over,
});
const UKR = sit({ id: 'news#UKR#thread-a', verb_label: 'Ukraine — fighting spreads', threadId: 'thread-a', aliases: ['news#conflict#UKR#old'], what_changed: '2 outlets · coverage 1.2× prior · spreading to USA, IRN' });

async function renderAt(url, extra = null) {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter initialEntries={[url]}><SituationHome />{extra}</MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear(); vi.resetModules();
  Object.assign(S, {
    world: world([UKR]), loading: false, error: null, topics: [], topicsError: null, topicsSettled: true,
    webFailed: false, detailArgs: [], detailStatus: 'ready', detail: null, isPhone: false,
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T06:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('honest not-found / loading / unavailable texts', () => {
  it('a ?focus= link never says "no longer tracked" while the world is still loading', async () => {
    Object.assign(S, { world: null, loading: true });
    await renderAt('/?focus=news%23gone');
    expect(screen.queryByText(/no longer being tracked/)).toBeNull();
    expect(screen.getByText('Loading the world…')).toBeInTheDocument();
  });

  it('nor when the world failed or was never generated: the feed is unavailable, not "loading" forever', async () => {
    Object.assign(S, { world: null, loading: false, error: new Error('boom') });
    await renderAt('/?focus=news%23gone');
    expect(screen.queryByText(/no longer being tracked/)).toBeNull();
    expect(screen.getAllByText('The situation feed is unavailable right now.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Loading the world…')).toBeNull();
  });

  it('a 404 world (no error, not loading) also reads unavailable on the phone ALERTS tab', async () => {
    Object.assign(S, { world: null, loading: false, error: null, isPhone: true });
    await renderAt('/');
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }));
    expect(within(screen.getByRole('tabpanel')).getByText('The situation feed is unavailable right now.')).toBeInTheDocument();
  });

  it('a ?focus= link absent from a successfully loaded world says it is no longer tracked', async () => {
    await renderAt('/?focus=news%23gone');
    expect(screen.getByText(/no longer being tracked/)).toBeInTheDocument();
  });

  it('a ?story= link says "not on the map" only when stories and the story web answered', async () => {
    await renderAt('/?story=thread-zzz');
    expect(screen.getByText(/That story is not on the map/)).toBeInTheDocument();
  });

  it('a ?story= link with a failed stories feed says it could not load, not "not on the map"', async () => {
    Object.assign(S, { topicsError: 'stories 500' });
    await renderAt('/?story=thread-zzz');
    expect(screen.queryByText(/That story is not on the map/)).toBeNull();
    expect(screen.getByText(/Stories could not be loaded right now/)).toBeInTheDocument();
  });

  it('the evidence list is "loading" while the detail loads and "not available" when it is missing or failed, never "still consolidating"', async () => {
    Object.assign(S, { detailStatus: 'loading' });
    const first = await renderAt('/?focus=news%23UKR%23thread-a');
    expect(screen.getByText('Loading the evidence…')).toBeInTheDocument();
    expect(screen.queryByText(/still consolidating/)).toBeNull();
    first.unmount();
    S.detailStatus = 'failed';
    await renderAt('/?focus=news%23UKR%23thread-a');
    expect(screen.getByText(/evidence list is not available/)).toBeInTheDocument();
    expect(screen.queryByText(/still consolidating/)).toBeNull();
  });

  it('a loaded detail without headlines is still "consolidating"', async () => {
    Object.assign(S, { detailStatus: 'ready', detail: { evidence: { outlets: 2, headlines: [] } } });
    await renderAt('/?focus=news%23UKR%23thread-a');
    expect(screen.getByText(/Coverage is still consolidating/)).toBeInTheDocument();
  });
});

describe('detail fetch follows the resolved situation', () => {
  it('an old-alias ?focus= fetches the situation\'s own id', async () => {
    await renderAt('/?focus=news%23conflict%23UKR%23old');
    expect(S.detailArgs).toContain('news#UKR#thread-a');
    expect(S.detailArgs).not.toContain('news#conflict#UKR#old');
  });
  it('a ?story= link that resolves to a situation fetches that situation, and nothing is fetched with no selection', async () => {
    await renderAt('/?story=thread-a');
    expect(S.detailArgs).toContain('news#UKR#thread-a');
    S.detailArgs = [];
    vi.resetModules();
    await renderAt('/');
    expect(S.detailArgs.every((id) => id === null)).toBe(true);
  });
});

describe('?layer= is followed after mount', () => {
  it('a same-page navigation to ?layer=risk switches the layer, and ?layer=situations switches back', async () => {
    let go;
    function Nav() { go = useNavigate(); return null; }
    await renderAt('/', <Nav />);
    const riskTab = () => screen.getAllByRole('radio', { name: 'Country risk' })[0];
    expect(riskTab()).toHaveAttribute('aria-checked', 'false');
    act(() => go('/?layer=risk'));
    expect(riskTab()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('radar')).toHaveAttribute('data-situations', '0');
    act(() => go('/?layer=situations'));
    expect(riskTab()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('radar')).toHaveAttribute('data-situations', '1');
  });
});

describe('?country=', () => {
  it('a two-letter ISO2 code opens the country by its name', async () => {
    await renderAt('/?country=JP');
    expect(screen.getByTestId('country-card')).toHaveTextContent('Japan');
  });
  it('an unknown code says so instead of opening an empty card', async () => {
    await renderAt('/?country=ZZ');
    expect(screen.queryByTestId('country-card')).toBeNull();
    expect(screen.getByText(/“ZZ” is not a country code or name we recognise/)).toBeInTheDocument();
  });
});

describe('one freshness stamp and one count', () => {
  it('the phone header and the desktop sensor row both say the map file\'s own age', async () => {
    const desktop = await renderAt('/');
    expect(screen.getByText(/updated 1h ago/)).toBeInTheDocument(); // sensor row: generated_at 05:00, now 06:00
    desktop.unmount();
    S.isPhone = true;
    vi.resetModules();
    await renderAt('/');
    expect(screen.getByText(/Map file updated 1h ago/)).toBeInTheDocument();
  });
  it('the phone Alerts badge equals the rows in the Alerts list', async () => {
    S.isPhone = true;
    S.world = world([UKR, sit({ id: 'b', verb_label: 'B', tier: 'moderate' }), sit({ id: 'c', verb_label: 'C', tier: 'low' })]);
    await renderAt('/');
    expect(screen.getByRole('tab', { name: /alerts/i }).textContent).toMatch(/3$/);
    fireEvent.click(screen.getByRole('tab', { name: /alerts/i }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button').filter((b) => b.classList.contains('al-card'))).toHaveLength(3);
    expect(within(screen.getByLabelText('Alerts')).getByText(/3 open/)).toBeInTheDocument();
  });
});

describe('card header', () => {
  it('shows no outlet count of its own (the stat box has the live one)', async () => {
    Object.assign(S, { detail: { evidence: { outlets: 6, headlines: [{ url: 'u', title: 'T', domain: 'd.com' }] } } });
    await renderAt('/?focus=news%23UKR%23thread-a');
    expect(screen.queryByText(/2 outlets/)).toBeNull();
    expect(screen.getByText(/spreading to USA, IRN/)).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});

describe('Alerts is the one situations list; Intel keeps only stories', () => {
  const T = (threadId, title) => ({ topicId: `t-${threadId}`, threadId, title, iso3: ['FRA'], category: 'politics' });
  beforeEach(() => {
    S.world = world([
      UKR,
      sit({ id: 'news#UKR#thread-a2', verb_label: 'Ukraine — dup of the same thread', threadId: 'thread-a', tier: 'moderate' }),
      sit({ id: 'gdacs#TC#1', source: 'gdacs', verb_label: 'Mexico — tropical cyclone', axis: 'humanitarian', tier: 'elevated', iso3_affected: ['MEX'] }),
      sit({ id: 'news#low', verb_label: 'A quiet one', tier: 'low' }),
    ]);
    S.topics = [T('thread-a', 'Topic that is a situation'), T('thread-b', 'A plain story')];
  });
  const intel = () => screen.getByLabelText('Intel feed');
  const alerts = () => screen.getByLabelText('Alerts');

  it('no situation is listed in Intel', async () => {
    await renderAt('/');
    for (const label of ['Ukraine — fighting spreads', 'Mexico — tropical cyclone', 'A quiet one']) {
      expect(within(intel()).queryByText(label)).toBeNull();
    }
  });
  it('a topic whose thread a situation carries is not in Intel (it has a pin and an Alerts row); other stories are', async () => {
    await renderAt('/');
    expect(within(intel()).queryByText('Topic that is a situation')).toBeNull();
    expect(within(intel()).getByText('A plain story')).toBeInTheDocument();
  });
  it('every plotted situation is in Alerts as a keyboard-reachable button (one thread listed once)', async () => {
    await renderAt('/');
    const cards = within(alerts()).getAllByRole('button').filter((b) => b.classList.contains('al-card'));
    const titles = cards.map((b) => within(b).getByText(/—|quiet/).textContent);
    expect(titles).toEqual(expect.arrayContaining(['Mexico — tropical cyclone', 'Ukraine — fighting spreads', 'A quiet one']));
    expect(titles).not.toContain('Ukraine — dup of the same thread'); // same thread: one row
    for (const b of cards) { expect(b.tabIndex).toBeGreaterThanOrEqual(0); expect(b.tagName).toBe('BUTTON'); }
    fireEvent.click(cards[0]);
    expect(document.querySelector('.sh-detail-title')).toHaveTextContent('Ukraine — fighting spreads');
  });
  it('a quiet day is a dated header with zero or few stories, no placeholder text', async () => {
    S.topics = [];
    const none = await renderAt('/');
    expect(within(intel()).getByText('Stories')).toBeInTheDocument();
    expect(within(intel()).getByText(/from NOV 3/i)).toBeInTheDocument();
    expect(within(intel()).queryAllByRole('button')).toHaveLength(0);
    expect(intel().textContent).not.toMatch(/quiet|no stories|nothing/i);
    none.unmount();
    S.topics = [T('thread-b', 'A plain story')];
    vi.resetModules();
    await renderAt('/');
    expect(within(intel()).getAllByRole('button')).toHaveLength(1);
  });
});
