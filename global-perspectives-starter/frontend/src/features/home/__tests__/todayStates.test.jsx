// /today page states and data mapping: loading, empty, a failed load with and without topics on screen,
// the stale / new-data banners, region grouping, the source counts and panel, the trust strip (shown only
// from real numbers), and a successful Summary through contentService.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));
vi.mock('@/features/breaking/components/BreakingStrip', () => ({ default: () => null }));
vi.mock('@/features/home/hooks/useTodayArchive', () => ({ useTodayArchive: () => ({ entries: [] }) }));

let topicsState;
let trackRecord;
let corrections;
vi.mock('@/shared/data/useGeminiTopics', () => ({ useGeminiTopics: () => topicsState }));
vi.mock('@/features/track-record/hooks/useTrackRecord', () => ({ useTrackRecord: () => ({ data: trackRecord }) }));
vi.mock('@/features/track-record/hooks/useCorrectionsFeed', () => ({ useCorrectionsFeed: () => corrections }));

const getTopicSummary = vi.fn();
vi.mock('@/shared/data/contentService', () => ({
  default: {
    getTopicSummary: (...a) => getTopicSummary(...a),
    getTopicPrediction: vi.fn(),
    getTopicTraceCause: vi.fn(),
  },
}));

import Home from '@/features/home/Home';

const refetch = vi.fn();
const state = (over = {}) => ({
  topics: [], loading: false, error: null, refetch, isStale: false, updatedAt: null, hasNewData: false, ...over,
});
const src = (over = {}) => ({ title: 'Report', source: 'reuters.com', url: 'https://reuters.com/a', outletCountry: 'GB', tier: 'primary', ...over });
const mount = () => render(<MemoryRouter><Home /></MemoryRouter>);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  report.mockClear(); refetch.mockClear(); getTopicSummary.mockReset();
  trackRecord = null;
  corrections = { notes: [], total: 0 };
  topicsState = state();
});

describe('/today loading and empty', () => {
  it('loading: shows the inline loader, no topics, no lede and no error panel', () => {
    topicsState = state({ loading: true, topics: [{ topicId: 'a', title: 'Hidden while loading', sources: [] }] });
    mount();
    expect(screen.getByText('Loading topics')).toBeInTheDocument();
    expect(document.querySelector('.home-region')).toBeNull();
    expect(document.querySelector('.home-topic')).toBeNull();
    expect(document.querySelector('.lede-band')).toBeNull();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
  });

  it('loaded with no topics and no error: no regions, no lede, no error panel, no fabricated filler', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: "Today's Global Topics" })).toBeInTheDocument();
    expect(document.querySelector('.home-region')).toBeNull();
    expect(document.querySelector('.lede-band')).toBeNull();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
    expect(document.querySelector('.ss-strip')).not.toHaveTextContent(/topics/);
  });

  it('a failed refresh while topics are on screen keeps them and shows no error panel, but still reports', () => {
    topicsState = state({ error: 'Network error', topics: [{ topicId: 'a', title: 'Still here', sources: [] }] });
    mount();
    expect(within(document.querySelector('.home-region')).getByText('Still here')).toBeInTheDocument();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
    expect(report).toHaveBeenCalledWith('today-topics', expect.any(Error));
  });

  it('stale data shows a Refresh banner that refetches; new data shows a Load banner (not both)', () => {
    topicsState = state({ isStale: true, hasNewData: true, topics: [{ topicId: 'a', title: 'T', sources: [] }] });
    mount();
    expect(screen.getByText('Topics refreshing — showing latest available')).toBeInTheDocument();
    expect(screen.queryByText('New topics available')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('new data (not stale) offers Load', () => {
    topicsState = state({ hasNewData: true, topics: [{ topicId: 'a', title: 'T', sources: [] }] });
    mount();
    expect(screen.getByText('New topics available')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('/today topics', () => {
  const topics = [
    { topicId: 'fr', title: 'French strike', category: 'politics', regions: ['France'], primaryCountry: 'France', urgency: 'high', x_trending: true, sources: [src(), src({ title: 'B', source: 'lemonde.fr', outletCountry: 'FR', url: 'https://lemonde.fr/b' })] },
    { topicId: 'de', title: 'German budget', category: 'economy', regions: ['Germany'], sources: [] },
    { topicId: 'jp', title: 'Japan quake', category: 'disaster', regions: ['Japan'], sources: [] },
    { topicId: 'wd', title: 'Global summit', category: 'politics', sources: [] },
  ];

  it('groups topics by region with counts: the biggest region first, World last', () => {
    topicsState = state({ topics });
    mount();
    const names = [...document.querySelectorAll('.home-region-hd h2')].map((h) => h.textContent);
    expect(names).toEqual(['Europe', 'Asia', 'World']);
    const europe = [...document.querySelectorAll('.home-region')].find((s) => s.querySelector('h2').textContent === 'Europe');
    expect(within(europe).getByText('2 topics')).toBeInTheDocument();
    const asia = [...document.querySelectorAll('.home-region')].find((s) => s.querySelector('h2').textContent === 'Asia');
    expect(within(asia).getByText('1 topic')).toBeInTheDocument();
  });

  it('shows the lede band for the most urgent topic with real tallies, and the status strip topic/trending counts', () => {
    topicsState = state({ topics });
    mount();
    const lede = document.querySelector('.lede-band');
    expect(lede).toHaveTextContent('French strike');
    expect(lede).toHaveTextContent('urgent');
    expect(lede).toHaveTextContent('4 stories');
    const strip = document.querySelector('.ss-strip');
    expect(strip).toHaveTextContent(/4\s*topics/);
    expect(strip).toHaveTextContent(/1\s*trending/);
  });

  it('flags urgent and trending topics and links the country', () => {
    topicsState = state({ topics });
    mount();
    const card = document.getElementById('topic-fr');
    expect(within(card).getByText('Urgent')).toBeInTheDocument();
    expect(within(card).getByText('Trending')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'France' })).toHaveAttribute('href', '/weekly/country/France');
    const quiet = document.getElementById('topic-de');
    expect(within(quiet).queryByText('Urgent')).toBeNull();
    expect(within(quiet).queryByText('Trending')).toBeNull();
  });

  it('source and outlet counts come from the topic; the panel lists the links and toggles', () => {
    topicsState = state({ topics });
    mount();
    const card = document.getElementById('topic-fr');
    const meta = card.querySelector('.home-topic-meta');
    expect(meta).toHaveTextContent('2 sources');
    // two sources from two outlets -> same number, so the outlet count is not repeated as its own span
    expect([...meta.querySelectorAll(':scope > span')].map((x) => x.textContent)).not.toContain('2 outlets');

    fireEvent.click(within(card).getByRole('button', { name: '2 sources ↗' }));
    const panel = card.querySelector('.home-sources-panel');
    const links = within(panel).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://reuters.com/a', 'https://lemonde.fr/b']);
    expect(links[0]).toHaveAttribute('target', '_blank');
    fireEvent.click(within(card).getAllByRole('button', { name: 'Hide sources' })[0]);
    expect(card.querySelector('.home-sources-panel')).toBeNull();
  });

  it('two sources from one outlet read as 2 sources, 1 outlet', () => {
    topicsState = state({ topics: [{ topicId: 'o', title: 'One outlet', category: 'politics', sources: [src(), src({ title: 'Second piece' })] }] });
    mount();
    const spans = [...document.getElementById('topic-o').querySelectorAll('.home-topic-meta > span')].map((x) => x.textContent);
    expect(spans[0]).toBe('2 sources');
    expect(spans[1]).toBe('1 outlet');
  });

  it('a topic with no sources array offers a Google News search link built from its title', () => {
    topicsState = state({ topics: [{ topicId: 'x', title: 'Dam & flood risk', category: 'disaster' }] });
    mount();
    const link = within(document.getElementById('topic-x')).getByRole('link', { name: /View sources/ });
    expect(link.getAttribute('href')).toBe('https://www.google.com/search?q=Dam%20%26%20flood%20risk&tbm=nws&tbs=qdr:d');
  });

  it('Summary success renders the takeaways as a list from the cached reply', async () => {
    getTopicSummary.mockResolvedValue({ content: '- First point\n- Second point', generatedAt: '2026-11-02T08:00:00Z' });
    topicsState = state({ topics: [topics[1]] });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(await screen.findByText('AI Key Takeaways')).toBeInTheDocument();
    expect(getTopicSummary).toHaveBeenCalledWith('de');
    expect(screen.getByText('First point')).toBeInTheDocument();
    expect(screen.getByText('Second point')).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
  });
});

describe('/today trust strip', () => {
  const oneTopic = [{ topicId: 'a', title: 'A', category: 'politics', sources: [src(), src({ title: 'C' })] }];

  it('is absent when there are no real numbers to show', () => {
    topicsState = state({ topics: [{ topicId: 'a', title: 'A', sources: [] }] });
    mount();
    expect(document.querySelector('.home-trust-strip')).toBeNull();
  });

  it('shows forecasts, corrections and source counts from real data, each linking where it should', () => {
    trackRecord = { totalDatedTriggers: 1234 };
    corrections = { notes: new Array(5).fill({}), total: 87 };
    topicsState = state({ topics: oneTopic });
    mount();
    const strip = document.querySelector('.home-trust-strip');
    const cards = strip.querySelectorAll('.home-trust-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('1,234');
    expect(cards[0]).toHaveTextContent(/dated, falsifiable forecast triggers/);
    expect(within(cards[0]).getByRole('link')).toHaveAttribute('href', '/track-record');
    // corrections use the server total (87), not the 5 rows the anonymous reader got
    expect(cards[1]).toHaveTextContent('87');
    expect(within(cards[1]).getByRole('link', { name: /Members see the full history/ })).toHaveAttribute('href', '/membership');
    expect(cards[2]).toHaveTextContent('2');
    expect(cards[2]).toHaveTextContent('sources across 1 stories tracked today');
    expect(within(cards[2]).queryByRole('link')).toBeNull();
  });

  it('with no server total it falls back to the rows it has; with neither, the corrections card is omitted', () => {
    corrections = { notes: new Array(3).fill({}), total: 0 };
    topicsState = state({ topics: [{ topicId: 'a', title: 'A', sources: [] }] });
    mount();
    expect(document.querySelector('.home-trust-card')).toHaveTextContent('3');
    expect(document.querySelectorAll('.home-trust-card')).toHaveLength(1);
  });

  it('is hidden while topics load', () => {
    trackRecord = { totalDatedTriggers: 10 };
    topicsState = state({ loading: true });
    mount();
    expect(document.querySelector('.home-trust-strip')).toBeNull();
  });
});
