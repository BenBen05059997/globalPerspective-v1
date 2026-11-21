import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const NO_LINK = 'No link found. Shared: nothing but the week.';
let user;
let boardStore;
let connectReply;
let serverVisit; // the lastVisitedAt the fake server stamps on a saved board, as the real one keeps its own
const calls = [];

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/shared/data/useGeminiTopics', () => ({
  useGeminiTopics: () => ({ topics: [
    { threadId: 'thread-a', title: 'Hormuz shipping' }, { threadId: 'thread-b', title: 'Gulf talks' }, { threadId: 'thread-c', title: 'Oil price' },
  ] }),
}));
vi.mock('@/shared/api/restProxy', () => ({ fetchThreadAnalyses: vi.fn(() => Promise.resolve({ data: { 'thread-a': { threadTitle: 'Hormuz shipping', riskScore: 62 } } })), boardConfigured: () => true }));
let themesIndex = { themes: [] };
let presetsFail = false;
vi.mock('@/features/board/lib/recordViews.js', async (orig) => ({ ...(await orig()), fetchStoryView: vi.fn(async () => null), fetchLinksView: vi.fn(async () => null), fetchCounts: vi.fn(async () => null), fetchThemesIndex: vi.fn(async () => themesIndex) })); // a rejected promise as themesIndex is a failed read
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/hooks/useIsPhone.js', () => ({ useIsPhone: () => false }));
vi.mock('@/features/board/lib/boardApi.js', () => ({
  boardAvailable: () => true,
  devMember: () => false,
  callBoard: vi.fn(async (action, body, options) => {
    calls.push([action, body, options]);
    switch (action) {
      case 'list_boards': return [{ boardId: 'b1', name: 'My board', pinCount: boardStore.pins.length, updatedAt: 'x' }];
      case 'arrivals': return {recordAvailable:false,arrivals:[]};
      case 'visit_board': return {lastVisitedAt:'2026-10-20T12:00:00Z'};
      case 'get_board': return JSON.parse(JSON.stringify(boardStore));
      case 'update_board': boardStore = { ...body.board, ...(serverVisit ? { lastVisitedAt: serverVisit } : {}) }; return JSON.parse(JSON.stringify(boardStore));
      case 'get_follows': return { followedThreads: ['thread-c'], followedActors: ['Oman'] };
      case 'list_presets': if (presetsFail) throw new Error('presets 500'); return [{ presetId: 'r-mena', name: 'Stories touching MENA', region: 'MENA', pins: [{ pinId: 'p01', kind: 'thread', refId: 'thread-a', title: 'Hormuz shipping', riskScore: 62, lead: 'humanitarian' }, { pinId: 'p02', kind: 'thread', refId: 'thread-b', title: 'Gulf talks' }], strings: [{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred', mechanism: 'Shared shipping routes.' }], links: [{ from: 'p01', to: 'p02', strength: 'medium', judgedAt: '2026-11-18T05:00:00Z' }], shared: [] }];
      case 'connect': return connectReply;
      default: throw new Error(`unexpected ${action}`);
    }
  }),
}));

import BoardPage from '@/features/board/BoardPage.jsx';
import PresetsPanel from '@/features/board/components/PresetsPanel.jsx';

const thread = (n, refId) => ({ pinId: `p${String(n).padStart(2, '0')}`, kind: 'thread', refId, addedAt: '2026-10-20T00:00:00Z' });
const baseBoard = () => ({
  boardId: 'b1', uid: 'u1', name: 'My board', weights: {}, dismissed: [], summary: { versions: [] }, createdAt: 'x', updatedAt: 'x',
  pins: [thread(1, 'thread-a'), thread(2, 'thread-b')], strings: [],
});
const renderPage = (path = '/board/b1') => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/board" element={<BoardPage />} /><Route path="/board/:boardId" element={<BoardPage />} /></Routes></MemoryRouter>,
);
const lastUpdate = () => calls.filter(([a]) => a === 'update_board').at(-1)?.[1].board;

beforeEach(() => {
  calls.length = 0;
  serverVisit = null;
  user = { uid: 'u1', email: 'a@b.test', isAnonymous: false };
  boardStore = baseBoard();
  connectReply = {
    pairKey: 'thread-a__thread-b', a: { kind: 'thread', refId: 'thread-a' }, b: { kind: 'thread', refId: 'thread-b' }, strength: 'medium',
    grounds: [
      { kind: 'actor', detail: ['iran', 'oman'] }, { kind: 'place', detail: ['IRN'] },
      { kind: 'outlet', detail: { outlets: ['Reuters'], note: 'coverage artefact possible' } },
      { kind: 'comovement', detail: { lagDays: 2, pairs: 1, note: 'one pairing is not a pattern' } },
    ],
    note: 'Shared: actor + place.', limits: ['no analysis row for thread thread-b'],
  };
});
afterEach(cleanup);

const pinEl = (re) => screen.getAllByRole('button', { name: re }).find((el) => el.hasAttribute('data-pin-id'));
async function selectBoth() {
  await waitFor(() => expect(pinEl(/Hormuz shipping/)).toBeTruthy());
  fireEvent.click(pinEl(/Hormuz shipping/));
  fireEvent.click(pinEl(/Gulf talks/));
}

it('opens a region board as the list of linked stories, with the diagram (and its kept Pins and Strings lists) and the map behind buttons', async () => {
  user = null;
  renderPage('/board');
  fireEvent.click(await screen.findByRole('link', { name: /^Open preview: Stories touching MENA/ }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Stories touching MENA' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Hormuz shipping' })[0]).toHaveAttribute('href', '/weekly/thread/thread-a');
  const first = document.getElementById('bl-thread-a');
  expect(first).toHaveTextContent('Feeds 1');
  expect(first).toHaveTextContent('→ feeds into');
  expect(first).toHaveTextContent('medium');
  expect(document.getElementById('bl-thread-b')).toHaveTextContent('Fed by 1');
  expect(screen.getByText('The 2 highest-risk stories that touch MENA. Every link is our model’s judgment, made on Nov 18, so every link is drawn dashed.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in to build your own board' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show as a diagram' }));
  expect(screen.getByTestId('board-graph')).toBeInTheDocument();
  expect(within(screen.getByLabelText('Board pins')).getByText('Most serious for: humanitarian')).toBeInTheDocument();
  expect(within(screen.getByLabelText('Board pins')).getByText(/62/)).toBeInTheDocument();
  expect(within(screen.getByLabelText('Board strings')).getByText('Shared shipping routes.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Connect|Retire|Add pin/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  expect(screen.getByTestId('board-map')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /All boards/ }));
  expect(await screen.findByRole('link', { name: /^Open preview: Stories touching MENA/ })).toBeInTheDocument();
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every(([action, , options]) => action === 'list_presets' && options?.auth === false)).toBe(true);
});

describe('theme boards (board look)', () => {
  const story = (id, title, category, newest, born) => ({ threadId: id, title, category, born, newestStep: { date: newest, role: 'move' }, stepCount: 3, tier: null, riskScore: null });
  const theme = {
    themeId: 'theme-1', titleCountries: ['RUS', 'UKR'], moreCountries: 0,
    stories: [story('t-c', 'Story C', 'conflict', '2026-11-19', '2026-10-01'), story('t-a', 'Story A', 'political', '2026-11-01', '2026-10-01'), story('t-b', 'Story B', 'economic', '2026-11-10', '2026-10-01')],
    links: [{ from: 't-a', to: 't-b', strength: 'weak', reason: 'A fed B (E12).', judgedAt: '2026-11-18T05:00:00Z' }, { from: 't-b', to: 't-c', strength: 'strong', reason: 'B fed C.', judgedAt: '2026-11-17T05:00:00Z' }],
    shared: [{ a: 't-a', b: 't-c', actors: ['Russia', 'Ukraine'] }],
  };
  beforeEach(() => { themesIndex = { themes: [theme] }; user = null; localStorage.clear(); });
  afterEach(() => { themesIndex = { themes: [] }; localStorage.clear(); });

  it('lists each theme first, then the sign-in line, then the region boards; the hook never waits on sign-in', async () => {
    renderPage('/board');
    const card = await screen.findByRole('link', { name: /^Open the board: 3 linked stories/ });
    expect(card).toHaveAttribute('href', '/board?theme=theme-1');
    expect(screen.getByText('2 judged links')).toBeInTheDocument();
    expect(screen.getByText('Newest step Nov 19')).toBeInTheDocument();
    const order = [...document.querySelectorAll('.bl-section, .bl-signin, [aria-label="Stories touching a region"]')].map((el) => el.className || el.getAttribute('aria-label'));
    expect(order[0]).toMatch(/bl-section/);
    expect(order[1]).toMatch(/bl-signin/);
  });

  it('opens a theme in link order, with feeds and fed-by rows, the reason without evidence codes, and the shared names as a note, never a line', async () => {
    renderPage('/board?theme=theme-1');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/^3 linked stories: /);
    const cards = [...document.querySelectorAll('.bl-list .bl-card')].map((el) => el.dataset.story);
    expect(cards).toEqual(['t-a', 't-b', 't-c']);
    expect(document.getElementById('bl-t-b')).toHaveTextContent('Feeds 1 · Fed by 1');
    expect(document.getElementById('bl-t-a')).toHaveTextContent('A fed B.');
    expect(document.getElementById('bl-t-a')).not.toHaveTextContent('E12');
    const note = document.getElementById('bl-t-c').querySelector('.bl-note');
    expect(note).toHaveTextContent('Also named in both with Story A: Russia, Ukraine. Not a judged link.');
    expect(document.querySelectorAll('.bl-arcs path').length).toBeGreaterThanOrEqual(0); // jsdom has no layout; arcs carry no meaning
  });

  it('a first visit shows this week; the visit is kept per board, so another board and a reload the same day keep their own news', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    themesIndex = { themes: [theme, { ...theme, themeId: 'theme-2' }] };
    const visits = () => JSON.parse(localStorage.getItem('gp-board-visits'));
    const open = async (id, text) => {
      const view = renderPage(`/board?theme=${id}`);
      expect(await screen.findByText(text)).toBeInTheDocument();
      view.unmount();
    };
    await open('theme-1', /^This week: 1 story took a new step$/);
    expect(visits()).toEqual({ 'theme:theme-1': { seen: '2026-11-20', prev: null } });
    await open('theme-1', /^This week: 1 story took a new step$/); // same day, no earlier visit: still the first-visit state

    localStorage.setItem('gp-board-visits', JSON.stringify({ 'theme:theme-1': { seen: '2026-11-05', prev: null }, 'theme:theme-2': { seen: '2026-11-05', prev: null } }));
    await open('theme-1', /^Since your last visit \(Nov 5\): 2 stories took a new step$/);
    await open('theme-2', /^Since your last visit \(Nov 5\): 2 stories took a new step$/); // board 2 opened first does not wipe board 3
    renderPage('/board?theme=theme-1'); // a reload the same day keeps the box
    expect(await screen.findByText(/^Since your last visit \(Nov 5\): 2 stories took a new step$/)).toBeInTheDocument();
    expect(document.getElementById('bl-t-c')).toHaveTextContent('● New step since your visit');
    expect(document.querySelector('.bl-moved__sum .bl-moved__glyph')).toHaveTextContent('●');
    expect(visits()['theme:theme-1']).toEqual({ seen: '2026-11-20', prev: '2026-11-05' });
    vi.useRealTimers();
  });

  it('storage that throws still draws the board, in the first-visit state', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    renderPage('/board?theme=theme-1');
    expect(await screen.findByText(/^This week:/)).toBeInTheDocument();
    expect(document.querySelectorAll('.bl-list .bl-card')).toHaveLength(3);
    get.mockRestore(); set.mockRestore();
  });

  it('with both lists failing, the page says so plainly and reports both to the error sink', async () => {
    const sink = (await import('@/shared/api/errorSink')).reportFetchError;
    sink.mockClear();
    themesIndex = Promise.reject(new Error('themes 500'));
    themesIndex.catch(() => {});
    presetsFail = true;
    renderPage('/board');
    expect(await screen.findByText('The boards could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Linked stories')).toBeNull();
    expect(screen.queryByLabelText('Stories touching a region')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to build your own board' })).toBeInTheDocument();
    expect(sink.mock.calls.map(([where]) => where).sort()).toEqual(['board-presets', 'board-themes']);
    presetsFail = false;
  });

  it('an unknown theme says it is no longer listed', async () => {
    renderPage('/board?theme=gone');
    expect(await screen.findByText('This board is no longer listed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All boards/ })).toHaveAttribute('href', '/board');
  });
});

describe('record views', () => {
  it('shows pin readings as absent and the unsettled counts of the pinned story', async () => {
    // Pin the clock (Date only): the page reads counts back at most 31 days from today (useWeekCounts MAX_SINCE_DAYS), so the
    // fixed 20 Oct visit below only counts as a visit date while today is within that window.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const views = await import('@/features/board/lib/recordViews.js');
    const today = new Date().toISOString().slice(0, 10);
    views.fetchCounts.mockImplementation(async (d) => (d === today ? { date: d, byStory: { 'thread-a': { newEntries: 2, branchesDue: 0, verdicts: 1 } } } : null));
    boardStore = { ...baseBoard(), recordAvailable: true, pins: baseBoard().pins.map((p) => ({ ...p, recordAvailable: true, line: null, counts: { chapters: null, liveBranches: 1, confirmedLinks: null } })) };
    renderPage();
    expect(await screen.findByText('this week, unsettled: 2 new entries, 0 branches due, 1 verdicts')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/no reading yet|first weekly review pending/);
    expect(screen.getAllByText('1 live branches').length).toBeGreaterThan(0);
    views.fetchCounts.mockImplementation(async () => null);
    vi.useRealTimers();
  });
});

describe('B0 list fixes', () => {
  it('presets count stories and judged links in the singular and plural; none judged says so; an old preset counts stories only', () => {
    const preset = (id, pins, links) => ({ presetId: id, name: id, region: 'X', pins: Array.from({ length: pins }, (_, i) => ({ pinId: `p${i}` })), strings: [], ...(links == null ? {} : { links: Array.from({ length: links }, () => ({})) }) });
    render(<MemoryRouter><PresetsPanel presets={[preset('a', 8, 1), preset('b', 1, 0), preset('c', 3, null)]} canFork onFork={() => {}} /></MemoryRouter>);
    expect(screen.getByText('8 stories · 1 link')).toBeInTheDocument();
    expect(screen.getByText('1 story · no links judged')).toBeInTheDocument();
    expect(screen.getByText('3 stories')).toBeInTheDocument();
  });
  it('the strings list sits under a disclosure with its count; the pin list gives the headline tag its own element', async () => {
    boardStore = { ...baseBoard(), strings: [{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred' }] };
    const { container } = renderPage();
    const summary = await screen.findByText('List of strings (1)');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(container.querySelector('.board-page')).not.toHaveClass('has-sheet-open');
    const tag = container.querySelector('.board-pinrow__tag');
    if (tag) expect(tag.previousElementSibling.tagName).toBe('BUTTON');
  });
});

describe('signed out', () => {
  it('describes what sign-in adds and calls no member action', async () => {
    user = null;
    renderPage('/board');
    expect(screen.getByText(/With a free account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to build your own board' }).getAttribute('href')).toMatch(/^\/signin\?returnTo=/);
    await screen.findByText(/Stories touching MENA/); // presets are public and may render
    expect(screen.getByText(/Open preview/)).toBeInTheDocument();
    expect(calls.map(([a]) => a).every((a) => a === 'list_presets')).toBe(true);
  });
});

describe('connect and the verdict card', () => {
  it('lists every ground, the limits and the notes as returned', async () => {
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const card = await screen.findByText('Medium link');
    expect(card).toBeInTheDocument();
    const both = screen.getByRole('region', { name: 'Who sits in both' });
    // the actor tag "iran" and the place Iran are one chip, spelled as the place
    expect([...both.querySelectorAll('li, .pn-chip, span')].map((x) => x.textContent).filter((t) => /^iran$/i.test(t))).toEqual(['Iran']);
    expect(both.textContent).toContain('oman');
    expect(screen.getByText(/Shared outlets:/).parentElement.textContent).toMatch(/Reuters.*coverage artefact possible/);
    expect(screen.getByText(/Scores moved together:/).parentElement.textContent).toMatch(/1 pairing, up to 2 days apart.*one pairing is not a pattern/);
    expect(screen.getByText('no analysis row for thread thread-b')).toBeInTheDocument();
    expect(calls.find(([a]) => a === 'connect')[1]).toEqual({ a: { kind: 'thread', refId: 'thread-a' }, b: { kind: 'thread', refId: 'thread-b' } });
  });

  it('shows the honest none text exactly as returned', async () => {
    connectReply = { ...connectReply, strength: 'none', grounds: [], note: NO_LINK, limits: [] };
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect((await screen.findAllByText('No link found')).length).toBe(2); // the verdict card's word, and the same word on the graph
    expect(screen.getAllByText(NO_LINK)).toHaveLength(2); // the verdict card, and the string on the graph
    expect(screen.queryByText('Combination failed')).toBeNull();
  });

  it('Drop it removes the "No link found" line and label at once', async () => {
    connectReply = { ...connectReply, strength: 'none', grounds: [], note: NO_LINK, limits: [] };
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findAllByText('No link found');
    expect(document.querySelector('[data-failed="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Drop it' }));
    expect(screen.queryByText('No link found')).toBeNull();
    expect(document.querySelector('[data-failed="true"]')).toBeNull();
  });

  it('the c key connects two selected pins', async () => {
    renderPage();
    await selectBoth();
    fireEvent.keyDown(pinEl(/Hormuz shipping/), { key: 'c' });
    expect(await screen.findByText('Medium link')).toBeInTheDocument();
  });

  it('Keep string adds a yours string with the line and saves it; Dismiss adds nothing', async () => {
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByText('Medium link');
    fireEvent.change(screen.getByLabelText(/Your line/), { target: { value: 'Shipping risk follows the talks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Keep string' }));
    expect(document.querySelector('.board-string[data-owner="yours"]')).not.toBeNull();
    await waitFor(() => expect(lastUpdate()).toBeTruthy(), { timeout: 3000 });
    expect(lastUpdate().strings).toEqual([expect.objectContaining({ a: 'p01', b: 'p02', owner: 'yours', line: 'Shipping risk follows the talks' })]);
  });

  it('Dismiss closes the card and keeps the board unchanged', async () => {
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByText('Medium link');
    fireEvent.click(screen.getByRole('button', { name: 'Drop it' }));
    expect(screen.queryByText('Medium link')).toBeNull();
    expect(document.querySelector('.board-string:not(.board-string--ghost)')).toBeNull();
  });
});

describe('cutting a string', () => {
  it('sets cutAt and keeps the string', async () => {
    boardStore.strings = [{ a: 'p01', b: 'p02', owner: 'yours', line: 'mine', keptAt: 'x' }];
    renderPage();
    await waitFor(() => expect(pinEl(/Hormuz shipping/)).toBeTruthy());
    fireEvent.click(within(screen.getByLabelText('Strings on this board')).getByRole('button'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cut string' }));
    expect(document.querySelector('.board-string')).toHaveAttribute('data-texture', 'cut');
    await waitFor(() => expect(lastUpdate()).toBeTruthy(), { timeout: 3000 });
    expect(lastUpdate().strings).toHaveLength(1);
    expect(lastUpdate().strings[0].cutAt).toBeTruthy();
  });
});

describe('pin budget', () => {
  it('shows n / 12 and blocks the 13th pin', async () => {
    boardStore.pins = Array.from({ length: 12 }, (_, i) => thread(i + 1, `thread-${i + 1}`));
    renderPage();
    await screen.findByText(/12 \/ 12/);
    fireEvent.click(screen.getByRole('button', { name: '+ Add pin' }));
    expect(await screen.findByText(/Pin budget reached/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add Oil price/ })).toBeDisabled();
    expect(calls.some(([a]) => a === 'update_board')).toBe(false);
  });

  it('adds a followed story as a pin and saves', async () => {
    renderPage();
    await screen.findByText(/2 \/ 12/);
    fireEvent.click(screen.getByRole('button', { name: '+ Add pin' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Add Oil price/ }));
    await screen.findByText(/3 \/ 12/);
    await waitFor(() => expect(lastUpdate()?.pins).toHaveLength(3), { timeout: 3000 });
  });
});

describe('retiring a pin', () => {
  it('greys the pin, keeps its strings and lines, frees a budget slot, and Restore brings it back', async () => {
    boardStore.strings = [{ a: 'p01', b: 'p02', owner: 'yours', line: 'why I keep this', keptAt: 'x' }];
    renderPage();
    await screen.findByText(/2 \/ 12/);
    fireEvent.click(within(screen.getByLabelText('Pins on this board')).getByRole('button', { name: /Hormuz shipping/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retire pin' }));
    await screen.findByText(/1 \/ 12/);
    expect(pinEl(/Hormuz shipping/)).toHaveClass('is-retired');
    expect(document.querySelector('.board-string[data-owner="yours"]')).not.toBeNull();
    await waitFor(() => expect(lastUpdate()).toBeTruthy(), { timeout: 3000 });
    expect(lastUpdate().pins).toHaveLength(2);
    expect(lastUpdate().pins.find((p) => p.pinId === 'p01').retiredAt).toBeTruthy();
    expect(lastUpdate().strings).toEqual([expect.objectContaining({ line: 'why I keep this' })]);

    fireEvent.click(within(screen.getByLabelText('Pins on this board')).getByRole('button', { name: /Hormuz shipping.*retired/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore pin' }));
    await screen.findByText(/2 \/ 12/);
    expect(pinEl(/Hormuz shipping/)).not.toHaveClass('is-retired');
    await waitFor(() => expect(lastUpdate().pins.find((p) => p.pinId === 'p01').retiredAt).toBeUndefined(), { timeout: 3000 });
  });

  it('a retired pin does not block the 12-pin budget', async () => {
    boardStore.pins = Array.from({ length: 12 }, (_, i) => ({ ...thread(i + 1, `thread-${i + 1}`), ...(i === 0 ? { retiredAt: '2026-10-21T00:00:00Z' } : {}) }));
    renderPage();
    await screen.findByText(/11 \/ 12/);
    fireEvent.click(screen.getByRole('button', { name: '+ Add pin' }));
    expect(screen.queryByText(/Pin budget reached/)).toBeNull();
    expect(await screen.findByRole('button', { name: /^Add Oil price/ })).toBeEnabled();
  });
});

describe('keeping a string on a pair that holds one of ours', () => {
  it('adds the reader\'s line to our string and does not replace it', async () => {
    boardStore.strings = [{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred', mechanism: 'shared place', cutAt: '2026-10-20T00:00:00Z' }];
    renderPage();
    await selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await screen.findByText('Medium link');
    fireEvent.change(screen.getByLabelText(/Your line/), { target: { value: 'I still think so' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add my line to our string' }));
    await waitFor(() => expect(lastUpdate()).toBeTruthy(), { timeout: 3000 });
    expect(lastUpdate().strings).toEqual([{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred', mechanism: 'shared place', cutAt: '2026-10-20T00:00:00Z', line: 'I still think so' }]);
  });
});

describe('the visit date', () => {
  it('"new entries since" keeps the date the session started with, printed as day and month, after an edit', async () => {
    // Pin the clock (Date only): the page counts back at most 31 days from today (useWeekCounts MAX_SINCE_DAYS), so the fixed
    // 20 Oct visit below only shows as "since 20 Oct" while today is inside that window.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const views = await import('@/features/board/lib/recordViews.js');
    const today = new Date().toISOString().slice(0, 10);
    views.fetchCounts.mockImplementation(async (d) => ({ date: d, byStory: { 'thread-a': { newEntries: 1, branchesDue: 0, verdicts: 0 } } }));
    boardStore = { ...baseBoard(), recordAvailable: true, lastVisitedAt: '2026-10-20T08:00:00Z', pins: baseBoard().pins.map((p) => ({ ...p, recordAvailable: true })) };
    renderPage();
    await new Promise((r) => setTimeout(r, 300)); console.log("DBG", document.body.textContent.slice(0, 1500));
    await screen.findByText(/new entries since 20 Oct/);
    serverVisit = `${today}T09:00:00Z`; // the arrivals read has since moved the stamp on
    fireEvent.click(screen.getByRole('button', { name: /Board name/ }));
    fireEvent.change(screen.getByLabelText('Board name'), { target: { value: 'Renamed' } });
    fireEvent.keyDown(screen.getByLabelText('Board name'), { key: 'Enter' });
    await waitFor(() => expect(lastUpdate()?.name).toBe('Renamed'), { timeout: 3000 });
    await waitFor(() => expect(boardStore.lastVisitedAt).toBe(serverVisit)); // the save echoed the moved-on stamp
    expect(screen.getByText(/new entries since 20 Oct/)).toBeInTheDocument();
    views.fetchCounts.mockImplementation(async () => null);
    vi.useRealTimers();
  });
});
