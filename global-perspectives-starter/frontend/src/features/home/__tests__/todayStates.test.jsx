// /today page states and data mapping: loading, empty, a failed load with and without topics on screen,
// the stale / new-data banners, region grouping, the source counts and panel, the trust strip (shown only
// from real numbers), and a successful Summary through contentService.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const report = vi.fn();
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => report(...a) }));
vi.mock('@/shared/ui/SubscribeCard', () => ({ default: () => null }));
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
import { PROMISE } from '@/shared/ui/ReaderPromise.jsx';

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
    expect(screen.getByText('Loading stories')).toBeInTheDocument();
    expect(document.querySelector('.home-region')).toBeNull();
    expect(document.querySelector('.home-topic')).toBeNull();
    expect(document.querySelector('.lede-band')).toBeNull();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
  });

  it('loaded with no topics and no error: no regions, no lede, no error panel, no fabricated filler', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: PROMISE })).toBeInTheDocument();
    expect(document.querySelector('.home-topic')).toBeNull();
    expect(document.querySelector('.home-count-meta')).toBeNull();
    expect(screen.queryByTestId('today-count')).toBeNull();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
    expect(document.querySelector('.ss-strip')).not.toHaveTextContent(/stories/);
  });

  it('a failed refresh while topics are on screen keeps them and shows no error panel, but still reports', () => {
    topicsState = state({ error: 'Network error', topics: [{ topicId: 'a', title: 'Still here', sources: [] }] });
    mount();
    expect(within(document.querySelector('.home-kind')).getByText('Still here')).toBeInTheDocument();
    expect(screen.queryByTestId('today-unavailable')).toBeNull();
    expect(report).toHaveBeenCalledWith('today-topics', expect.any(Error));
  });

  it('stale data shows a Refresh banner that refetches; new data shows a Load banner (not both)', () => {
    topicsState = state({ isStale: true, hasNewData: true, topics: [{ topicId: 'a', title: 'T', sources: [] }] });
    mount();
    expect(screen.getByText('Stories refreshing — showing latest available')).toBeInTheDocument();
    expect(screen.queryByText('New stories available')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('new data (not stale) offers Load', () => {
    topicsState = state({ hasNewData: true, topics: [{ topicId: 'a', title: 'T', sources: [] }] });
    mount();
    expect(screen.getByText('New stories available')).toBeInTheDocument();
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

  it('with no role stamps: one list in edition order, lead first, no count line; the regions are in the rail', () => {
    topicsState = state({ topics: [topics[1], topics[0], topics[2], topics[3]] });
    mount();
    expect(document.querySelectorAll('.home-kind')).toHaveLength(1);
    expect([...document.querySelectorAll('.home-kind > article')].map((a) => a.id)).toEqual(['topic-fr', 'topic-de', 'topic-jp', 'topic-wd']);
    expect(screen.queryByTestId('today-count')).toBeNull();
    expect(document.querySelector('.gp-kind')).toBeNull();
    const rail = [...document.querySelectorAll('.topic-nav-rail-region h3')].map((h) => h.textContent);
    expect(rail).toEqual(['Europe · 2', 'Asia · 1', 'World · 1']);
  });

  it('the lead story is flagged on its card, its counts sit under the count line, and the strip counts topics and trending', () => {
    topicsState = state({ topics });
    mount();
    expect(within(document.getElementById('topic-fr')).getByText('Lead story · urgent')).toBeInTheDocument();
    expect(document.querySelector('.home-count-meta')).toHaveTextContent('4 stories');
    const strip = document.querySelector('.ss-strip');
    expect(strip).toHaveTextContent(/4\s*stories/);
    expect(strip).toHaveTextContent(/1\s*trending/);
  });

  it('flags urgent and trending topics and links the country', () => {
    topicsState = state({ topics });
    mount();
    const card = document.getElementById('topic-fr');
    expect(within(card).getByText('Lead story · urgent')).toBeInTheDocument(); // the lead card carries urgency in its flag
    expect(within(card).getByText('Trending on X')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'France' })).toHaveAttribute('href', '/weekly/country/France');
    const quiet = document.getElementById('topic-de');
    expect(within(quiet).queryByText('Urgent')).toBeNull();
    expect(within(quiet).queryByText('Trending on X')).toBeNull();
  });

  it('source and outlet counts come from the topic; the panel lists the links and toggles', () => {
    topicsState = state({ topics });
    mount();
    const card = document.getElementById('topic-fr');
    const meta = card.querySelector('.home-topic-meta');
    expect(meta).toHaveTextContent('2 sources for this step');
    // two sources from two outlets -> same number, so the outlet count is not repeated as its own span
    expect([...meta.querySelectorAll(':scope > span')].map((x) => x.textContent)).not.toContain('2 outlets');

    fireEvent.click(within(card).getByRole('button', { name: '2 sources for this step ↗' }));
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
    const meta = document.getElementById('topic-o').querySelector('.home-topic-meta');
    expect(within(meta).getByRole('button').textContent).toBe('2 sources for this step ↗');
    expect([...meta.querySelectorAll(':scope > span')].map((x) => x.textContent)[0]).toBe('1 outlet');
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
    expect(cards[2]).toHaveTextContent('2sources in this edition');
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

describe('/today with the builder stamps (CONTRACT: role, storyId, stories, latest.roles)', () => {
  const stories = {
    'thread-kerch': { title: 'Kerch bridge hit again', born: '2026-11-12', stepCount: 6, firstStep: { date: '2026-11-12', title: 'Blast on the Kerch bridge', role: 'start' }, watch: ['Will the bridge reopen by Friday?', 'Second question'] },
    'thread-new': { title: 'New tariff talks', born: '2026-11-19', stepCount: 1, firstStep: { date: '2026-11-19', title: 'New tariff talks', role: 'start' }, watch: [] },
    'thread-two': { title: 'Second step already', born: '2026-11-18', stepCount: 2, firstStep: { date: '2026-11-18', title: 'Second step already', role: 'start' } },
  };
  const stamped = [
    { topicId: 'n1', title: 'New tariff talks', category: 'economy', role: 'start', storyId: 'thread-new', threadId: 'thread-new', sources: [] },
    { topicId: 'k1', title: 'Kerch bridge hit again', category: 'conflict', urgency: 'high', role: 'move', storyId: 'thread-kerch', threadId: 'thread-old-kerch', sources: [] },
    { topicId: 't2', title: 'Second step already', category: 'politics', role: 'start', storyId: 'thread-two', sources: [] },
    { topicId: 'x0', title: 'No story', category: 'politics', role: null, storyId: null, sources: [] },
  ];

  it('says the counts from latest.roles, splits moved and began, and draws each card from its story stamp', () => {
    topicsState = state({ topics: stamped, stories, roles: { move: 1, start: 2, measure: 0, none: 1 }, updatedAt: '2026-11-19T04:16:00Z' });
    mount();
    expect(screen.getByText('Thursday, November 19, 2026 · Edition 04:16 UTC')).toBeInTheDocument();
    expect(screen.getByTestId('today-count').textContent).toBe('Today 1 story moved, 2 new stories began, no measured change, 1 other item.');
    const [moved, began] = document.querySelectorAll('.home-kind');
    expect(within(moved).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['1 story we follow took a new step', '1 other item in this edition']);
    expect(within(began).getByRole('heading', { level: 2 }).textContent).toBe('2 new stories began');
    expect([...moved.querySelectorAll('article')].map((a) => a.id)).toEqual(['topic-k1', 'topic-x0']);
    expect([...began.querySelectorAll('article')].map((a) => a.id)).toEqual(['topic-n1', 'topic-t2']);

    const kerch = document.getElementById('topic-k1');
    expect(within(kerch).getByText('Moves a story')).toBeInTheDocument();
    expect(within(kerch).getByText('since Nov 12 · 6 steps')).toBeInTheDocument();
    expect(kerch.querySelector('.gp-scard__steps').textContent).toBe('Nov 12 Began: Blast on the Kerch bridge4 steps in between, on the story page');
    expect(within(kerch).getByText('Will the bridge reopen by Friday?')).toBeInTheDocument();
    expect(within(kerch).queryByText('Second question')).toBeNull();
    expect(within(kerch).getByRole('link', { name: 'Track record →' })).toHaveAttribute('href', '/track-record');
    // the story link follows storyId (the merged-into story), not the agent's threadId
    expect(within(kerch).getByRole('link', { name: 'Open the story →' })).toHaveAttribute('href', '/weekly/thread/thread-kerch');

    const fresh = document.getElementById('topic-n1');
    expect(within(fresh).getByText('Starts a story')).toBeInTheDocument();
    expect(within(fresh).getByText('This is the story’s first step. Its next steps will show here.')).toBeInTheDocument();
    expect(fresh.querySelector('.gp-watch')).toBeNull(); // no question, no box
    expect(document.getElementById('topic-t2').querySelector('.gp-scard__steps').textContent).toBe('Nov 18 Began: Second step already');

    const none = document.getElementById('topic-x0');
    expect(none.querySelector('.gp-kind')).toBeNull();
    expect(within(none).queryByRole('link', { name: 'Open the story →' })).toBeNull();
  });

  it('counts a measured change when the builder stamps one', () => {
    topicsState = state({ topics: stamped.slice(1, 2), stories, roles: { move: 1, start: 0, measure: 1, none: 0 } });
    mount();
    expect(screen.getByTestId('today-count').textContent).toBe('Today 1 story moved, no new story began, 1 measured change.');
    expect(screen.getByRole('heading', { level: 2, name: 'No new story began today.' })).toBeInTheDocument();
  });

  it('one card per story (R1): a story’s items are one card, grouped and chipped by editionRole, titled by the newest step, with "Also today"', () => {
    const ferry = {
      title: 'Rival bids', born: '2026-11-19', stepCount: 3, editionRole: 'start',
      firstStep: { date: '2026-11-19', title: 'Route announced', role: 'start' }, newestStep: { date: '2026-11-19', title: 'Rival bids', role: 'move' },
      alsoToday: [{ date: '2026-11-19', title: 'Fares set', role: 'move' }],
    };
    const items = [
      { topicId: 'f1', title: 'Route announced', role: 'start', storyId: 'thread-ferry', sources: [] },
      { topicId: 'f2', title: 'Fares set', role: 'move', storyId: 'thread-ferry', sources: [] },
      { topicId: 'f3', title: 'Rival bids', role: 'move', storyId: 'thread-ferry', sources: [] },
    ];
    topicsState = state({ topics: items, stories: { 'thread-ferry': ferry }, roles: { move: 0, start: 1, measure: 0, none: 0 } });
    mount();
    expect(screen.getByTestId('today-count').textContent).toBe('Today no story we follow moved, 1 new story began, no measured change.');
    const cards = document.querySelectorAll('article.home-topic');
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('topic-f3'); // the newest step's item: its sources and AI buttons
    expect(within(cards[0]).getByText('Starts a story')).toBeInTheDocument();
    expect(cards[0].querySelector('h3').textContent).toBe('Rival bids');
    expect([...cards[0].querySelectorAll('.gp-scard__steps li')].map((li) => li.textContent)).toEqual(['Nov 19 Began: Route announced', 'Also today: Fares set']);
    expect(document.querySelector('.ss-strip')).toHaveTextContent(/1\s*story\b/);
  });

  it('measured cards have their own heading after the moves (R3), also when no story moved', () => {
    const cargo = { title: 'Cargo up', born: '2026-11-19', stepCount: 1, editionRole: 'measure', firstStep: { date: '2026-11-19', title: 'Cargo up', role: 'measure' }, newestStep: { date: '2026-11-19', title: 'Cargo up', role: 'measure' } };
    topicsState = state({ topics: [{ topicId: 'c1', title: 'Cargo up', role: 'measure', storyId: 'thread-cargo', sources: [] }], stories: { 'thread-cargo': cargo }, roles: { move: 0, start: 0, measure: 1, none: 0 } });
    mount();
    expect(screen.getByTestId('today-count').textContent).toBe('Today no story we follow moved, no new story began, 1 measured change.');
    expect([...document.querySelectorAll('.home-kind-hd')].map((h) => h.textContent)).toEqual(['No story we follow took a new step today.', '1 measured change', 'No new story began today.']);
  });

  it('zero moved: the count line and the left heading say so; the began column still shows', () => {
    topicsState = state({ topics: stamped.slice(0, 1).map((t) => ({ ...t, regions: ['Japan'] })), stories, roles: { move: 0, start: 1, measure: 0, none: 0 } });
    mount();
    expect(screen.getByTestId('today-count').textContent).toBe('Today no story we follow moved, 1 new story began, no measured change. 1 country involved.');
    expect(screen.getByRole('heading', { level: 2, name: 'No story we follow took a new step today.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1 new story began' })).toBeInTheDocument();
  });

  it('both zero with items present: one line, and only the "more in this edition" group', () => {
    topicsState = state({ topics: stamped.slice(3), stories, roles: { move: 0, start: 0, measure: 0, none: 1 } });
    mount();
    expect(screen.getByTestId('today-count').textContent).toBe('No story moved or began in this edition.');
    expect([...document.querySelectorAll('.home-kind-hd')].map((h) => h.textContent)).toEqual(['1 other item in this edition']);
    expect(document.getElementById('topic-x0')).toBeInTheDocument();
  });
});
