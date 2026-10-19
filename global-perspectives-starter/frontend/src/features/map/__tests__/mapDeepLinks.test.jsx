// The map's address contract (features/map/lib/deepLinks.js, shared/lib/links.js mapHref):
//   ?focus=<id or an old id in aliases[]>, ?story=<any threadId>, ?country=<ISO3 | name>, ?layer=
// plus the console's entity links (affected countries, situation -> story, country card -> page).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  situationForFocus, topicForStory, situationForThread, topicFromWebIndex, countryForParam, countryCardName, withFocusOutline,
} from '@/features/map/lib/deepLinks.js';

const WORLD = {
  schema: 1,
  generated_at: '2026-09-26T05:13:59.323Z',
  next_expected_at: '2026-09-26T05:43:59.323Z',
  sources: { gdacs: '2026-09-26T05:05:07.869Z', news: '2026-09-26T04:50:16.515Z' },
  stale: false,
  situations: [{
    id: 'news#UKR#thread-ukraine-war-abc123', source: 'news', verb_label: 'Ukraine — fighting spreads', axis: 'conflict',
    tier: 'high', state: 'escalating', escalating: true, centroid: { lat: 49, lon: 32 },
    iso3_affected: ['UKR', 'RUS'], opened_at: '2026-09-24T15:13:59.285Z', last_change_at: '2026-09-26T04:13:59.153Z',
    what_changed: '5 outlets', threadId: 'thread-ukraine-war-abc123', aliases: ['news#conflict#UKR#russia'],
  }, {
    id: 'gdacs#TC#1001325', source: 'gdacs', verb_label: 'Mexico — tropical cyclone', axis: 'humanitarian',
    tier: 'elevated', state: 'escalating', escalating: true, centroid: { lat: 17.4, lon: -110.1 },
    iso3_affected: ['MEX'], opened_at: '2026-09-24T15:13:59.285Z', last_change_at: '2026-09-26T04:13:59.153Z',
    what_changed: 'Alert raised Green→Orange', threadId: null,
  }],
};
const TOPICS = [{ topicId: 'Today topic-0', threadId: 'thread-today-1', title: 'Today’s story', iso3: ['FRA'], regions: ['France'], category: 'politics' }];
const WEB_INDEX = {
  threads: {
    'thread-old-strike-9f9f9f': { title: 'Port strike in Chile', places: [{ name: 'Chile', n: 3 }, { name: 'Pacific Ocean', n: 1 }] },
  },
  links: [], shared: [],
};

vi.mock('@/features/map/hooks/useWorld.js', () => ({
  useWorld: () => ({ world: WORLD, situations: WORLD.situations, loading: false, error: null, asOf: WORLD.sources.news, stale: false }),
  useSituationDetail: () => ({ detail: null }),
}));
vi.mock('@/shared/hooks/useDailyBrief.js', () => ({
  useDailyBrief: () => ({ brief: null, servedDateKey: null, loading: false, error: null }),
  MAX_LOOKBACK_DAYS: 30,
}));
vi.mock('@/shared/data/useGeminiTopics.js', () => ({
  useGeminiTopics: () => ({ topics: TOPICS, settled: true, loading: false, error: null, isStale: false, updatedAt: '2026-09-26T04:00:00Z', generatedDate: null }),
}));
vi.mock('@/features/threads', () => ({
  useWebIndex: () => ({ index: WEB_INDEX, loading: false, failed: false }),
  deriveFromIndex: () => ({ fedInto: [], fedFrom: [] }),
}));
vi.mock('@/features/briefings', () => ({ useWeeklyBrief: () => ({ brief: null }) }));
vi.mock('@/features/countries', () => ({ CountryCardV2: ({ name }) => <div data-testid="country-card">{name}</div> }));
vi.mock('@/features/map/hooks/useStoryCardData.js', () => ({
  useStoryCardData: () => ({ loading: false, summary: null, analysis: null, summaryError: false, analysisError: false, fetchError: false }),
}));
vi.mock('@/features/map/hooks/usePausedSince.js', () => ({ usePausedSince: () => ({ paused: null }) }));
// The radar stands in for both map modes: it reports what the console asked it to focus and shade.
vi.mock('@/shared/map/RadarMap.jsx', () => ({
  default: (p) => <div data-testid="radar" data-focus-id={p.focusId || ''} data-focus-iso3={p.storyFocusIso3 || ''} data-shaded={p.shading.map((e) => e.iso3).join(',')} />,
}));

async function renderAt(url) {
  const SituationHome = (await import('@/features/map/SituationHome.jsx')).default;
  return render(<MemoryRouter initialEntries={[url]}><SituationHome /></MemoryRouter>);
}
const radar = () => screen.getByTestId('radar');

describe('map deep links — pure resolvers', () => {
  it('?focus= finds a situation by id or by an old id in aliases[]', () => {
    expect(situationForFocus(WORLD.situations, 'gdacs#TC#1001325').id).toBe('gdacs#TC#1001325');
    expect(situationForFocus(WORLD.situations, 'news#conflict#UKR#russia').id).toBe('news#UKR#thread-ukraine-war-abc123');
    expect(situationForFocus(WORLD.situations, 'news#gone')).toBeNull();
  });
  it('?story= resolves today’s topic, the situation with the thread, or the index thread', () => {
    expect(topicForStory(TOPICS, 'thread-today-1').title).toBe('Today’s story');
    const unthreaded = { topicId: 'Loose topic-3', title: 'Loose' };
    expect(topicForStory([unthreaded], 'Loose topic-3')).toBe(unthreaded);
    expect(situationForThread(WORLD.situations, 'thread-ukraine-war-abc123').id).toBe('news#UKR#thread-ukraine-war-abc123');
    expect(topicFromWebIndex(WEB_INDEX, 'thread-old-strike-9f9f9f')).toEqual({
      threadId: 'thread-old-strike-9f9f9f', title: 'Port strike in Chile', fromIndex: true, iso3: ['CHL'], regions: ['Chile'],
    });
    expect(topicFromWebIndex({ threads: { t: { title: 'X', iso3: ['ARE'] } } }, 't').regions).toEqual(['UAE']);
    expect(topicFromWebIndex(WEB_INDEX, 'thread-unknown')).toBeNull();
  });
  it('?country= takes an ISO3 code or a name; regions resolve to nothing', () => {
    expect(countryForParam('ARE')).toEqual({ iso3: 'ARE', name: 'UAE' });
    expect(countryForParam('United Arab Emirates').iso3).toBe('ARE');
    expect(countryForParam('Europe')).toBeNull();
    expect(countryCardName('ARE')).toBe('UAE');
    expect(countryCardName('United States')).toBe('United States');
  });
  it('outlines a focused country that has no wash of its own, once', () => {
    const shaded = [{ iso3: 'FRA', count: 1 }];
    expect(withFocusOutline(shaded, 'FRA', 'France')).toBe(shaded);
    expect(withFocusOutline(shaded, 'CHL', 'Chile').map((e) => e.iso3)).toEqual(['FRA', 'CHL']);
    expect(withFocusOutline(shaded, 'CHL', 'Chile')[1].outlineOnly).toBe(true);
    expect(withFocusOutline(shaded, null)).toBe(shaded);
  });
});

describe('map deep links — the console', () => {
  beforeEach(() => {
    localStorage.clear(); vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T06:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('?focus=<old id> opens the situation that absorbed it, flies to it, and links its story and countries', async () => {
    await renderAt('/?focus=news%23conflict%23UKR%23russia');
    expect(screen.getByRole('heading', { name: 'Ukraine — fighting spreads' })).toBeInTheDocument();
    expect(radar()).toHaveAttribute('data-focus-id', 'news#UKR#thread-ukraine-war-abc123');
    expect(screen.getByRole('link', { name: 'Full analysis →' })).toHaveAttribute('href', '/weekly/thread/thread-ukraine-war-abc123');
    expect(screen.getByRole('link', { name: 'Ukraine' })).toHaveAttribute('href', '/weekly/country/Ukraine');
    expect(screen.getByRole('link', { name: 'Russia' })).toHaveAttribute('href', '/weekly/country/Russia');
    expect(screen.queryByText(/no longer being tracked/)).toBeNull();
  });

  it('a situation without a thread has no story link (only its countries)', async () => {
    await renderAt('/?focus=gdacs%23TC%231001325');
    expect(screen.queryByRole('link', { name: 'Full analysis →' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Mexico' })).toHaveAttribute('href', '/weekly/country/Mexico');
  });

  it('?story=<thread of a situation> selects that situation', async () => {
    await renderAt('/?story=thread-ukraine-war-abc123');
    expect(screen.getByRole('heading', { name: 'Ukraine — fighting spreads' })).toBeInTheDocument();
    expect(radar()).toHaveAttribute('data-focus-id', 'news#UKR#thread-ukraine-war-abc123');
  });

  it('?story=<today’s thread> opens its story card and flies to its country', async () => {
    await renderAt('/?story=thread-today-1');
    expect(screen.getByRole('heading', { name: 'Today’s story' })).toBeInTheDocument();
    expect(radar()).toHaveAttribute('data-focus-iso3', 'FRA');
    expect(screen.getByRole('link', { name: 'Open full story →' })).toHaveAttribute('href', '/weekly/thread/thread-today-1');
    expect(screen.getByRole('link', { name: 'France' })).toHaveAttribute('href', '/weekly/country/France');
  });

  it('?story=<any thread in the story web> opens a card from the index and outlines its country', async () => {
    await renderAt('/?story=thread-old-strike-9f9f9f');
    expect(screen.getByRole('heading', { name: 'Port strike in Chile' })).toBeInTheDocument();
    expect(radar()).toHaveAttribute('data-focus-iso3', 'CHL');
    expect(radar().getAttribute('data-shaded').split(',')).toContain('CHL');
    expect(screen.getByRole('link', { name: 'Open full story →' })).toHaveAttribute('href', '/weekly/thread/thread-old-strike-9f9f9f');
  });

  it('?story=<unknown id> says so instead of an empty card', async () => {
    await renderAt('/?story=thread-nowhere');
    expect(screen.getByText(/That story is not on the map/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open full story →' })).toBeNull();
  });

  it('?country=<ISO3> opens the card under the canonical name, flies there, and links the country page', async () => {
    await renderAt('/?country=ARE');
    expect(screen.getByTestId('country-card')).toHaveTextContent('UAE');
    expect(radar()).toHaveAttribute('data-focus-iso3', 'ARE');
    expect(radar().getAttribute('data-shaded').split(',')).toContain('ARE');
    expect(screen.getByRole('link', { name: 'Open the country page →' })).toHaveAttribute('href', '/weekly/country/UAE');
  });

  it('?country=<name> keeps the name for the card and still flies to it', async () => {
    await renderAt('/?country=France');
    expect(screen.getByTestId('country-card')).toHaveTextContent('France');
    expect(radar()).toHaveAttribute('data-focus-iso3', 'FRA');
  });

  it('?country=<region> opens the card without a country page link or a fly-to', async () => {
    await renderAt('/?country=Europe');
    expect(screen.getByTestId('country-card')).toHaveTextContent('Europe');
    expect(screen.queryByRole('link', { name: 'Open the country page →' })).toBeNull();
    expect(radar()).toHaveAttribute('data-focus-iso3', '');
  });

  it('?layer=risk still selects the risk layer alongside a country', async () => {
    await renderAt('/?country=FRA&layer=risk');
    expect(screen.getByRole('radio', { name: 'Country risk' })).toHaveAttribute('aria-checked', 'true');
    expect(radar()).toHaveAttribute('data-focus-iso3', 'FRA');
  });
});
