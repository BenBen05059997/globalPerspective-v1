import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const NO_LINK = 'No link found. Shared: nothing but the week.';
let user;
let boardStore;
let connectReply;
const calls = [];

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/shared/data/useGeminiTopics', () => ({
  useGeminiTopics: () => ({ topics: [
    { threadId: 'thread-a', title: 'Hormuz shipping' }, { threadId: 'thread-b', title: 'Gulf talks' }, { threadId: 'thread-c', title: 'Oil price' },
  ] }),
}));
vi.mock('@/shared/api/restProxy', () => ({ fetchThreadAnalyses: vi.fn(() => Promise.resolve({ data: { 'thread-a': { threadTitle: 'Hormuz shipping', riskScore: 62 } } })), boardConfigured: () => true }));
vi.mock('@/features/board/lib/recordViews.js', async (orig) => ({ ...(await orig()), fetchStoryView: vi.fn(async () => null), fetchLinksView: vi.fn(async () => null), fetchCounts: vi.fn(async () => null) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/hooks/useIsPhone.js', () => ({ useIsPhone: () => false }));
vi.mock('@/features/board/lib/boardApi.js', () => ({
  boardAvailable: () => true,
  devMember: () => false,
  callBoard: vi.fn(async (action, body) => {
    calls.push([action, body]);
    switch (action) {
      case 'list_boards': return [{ boardId: 'b1', name: 'My board', pinCount: boardStore.pins.length, updatedAt: 'x' }];
      case 'arrivals': return {recordAvailable:false,arrivals:[]};
      case 'visit_board': return {lastVisitedAt:'2026-10-20T12:00:00Z'};
      case 'get_board': return JSON.parse(JSON.stringify(boardStore));
      case 'update_board': boardStore = { ...body.board }; return JSON.parse(JSON.stringify(boardStore));
      case 'get_follows': return { followedThreads: ['thread-c'], followedActors: ['Oman'] };
      case 'list_presets': return [{ presetId: 'r-mena', name: 'MENA: highest-risk stories', region: 'MENA', pins: [{ pinId: 'p01', kind: 'thread', refId: 'thread-a', title: 'Hormuz shipping', riskScore: 62 }, { pinId: 'p02', kind: 'thread', refId: 'thread-b', title: 'Gulf talks' }], strings: [{ a: 'p01', b: 'p02', owner: 'ours', strength: 'inferred' }] }];
      case 'connect': return connectReply;
      default: throw new Error(`unexpected ${action}`);
    }
  }),
}));

import BoardPage from '@/features/board/BoardPage.jsx';

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

describe('record views', () => {
  it('shows pin readings as absent and the unsettled counts of the pinned story', async () => {
    const views = await import('@/features/board/lib/recordViews.js');
    const today = new Date().toISOString().slice(0, 10);
    views.fetchCounts.mockImplementation(async (d) => (d === today ? { date: d, byStory: { 'thread-a': { newEntries: 2, branchesDue: 0, verdicts: 1 } } } : null));
    boardStore = { ...baseBoard(), recordAvailable: true, pins: baseBoard().pins.map((p) => ({ ...p, recordAvailable: true, line: null, counts: { chapters: null, liveBranches: 1, confirmedLinks: null } })) };
    renderPage();
    expect(await screen.findByText('this week, unsettled: 2 new entries, 0 branches due, 1 verdicts')).toBeInTheDocument();
    expect(screen.getAllByText('no reading yet · first weekly review pending').length).toBeGreaterThan(0);
    views.fetchCounts.mockImplementation(async () => null);
  });
});

describe('signed out', () => {
  it('shows one honest line with a sign-in link, and calls no member action', async () => {
    user = null;
    renderPage('/board');
    expect(screen.getByText(/for signed-in members/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toMatch(/^\/signin\?returnTo=/);
    await screen.findByText(/MENA: highest-risk stories/); // presets are public and may render
    expect(screen.getByText(/Sign in to fork/)).toBeInTheDocument();
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
    expect(screen.getByText(/Shared actors:/).parentElement.textContent).toContain('iran, oman');
    expect(screen.getByText(/Shared places:/).parentElement.textContent).toContain('Iran');
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
    expect(await screen.findByText('No link found')).toBeInTheDocument();
    expect(screen.getByText(NO_LINK)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Medium link')).toBeNull();
    expect(document.querySelector('.board-string')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Add pin' }));
    expect(await screen.findByText(/Pin budget reached/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add Oil price/ })).toBeDisabled();
    expect(calls.some(([a]) => a === 'update_board')).toBe(false);
  });

  it('adds a followed story as a pin and saves', async () => {
    renderPage();
    await screen.findByText(/2 \/ 12/);
    fireEvent.click(screen.getByRole('button', { name: 'Add pin' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Add Oil price/ }));
    await screen.findByText(/3 \/ 12/);
    await waitFor(() => expect(lastUpdate()?.pins).toHaveLength(3), { timeout: 3000 });
  });
});
