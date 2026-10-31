import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const { stories, call } = vi.hoisted(() => ({ stories: { value: {} }, call: vi.fn() }));
vi.mock('../hooks/useStoryViews.js', () => ({ useStoryViews: () => ({ stories: stories.value, links: {}, errors: {}, loading: false }) }));
vi.mock('../lib/boardApi.js', () => ({ callBoard: call }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import VerdictCard from '../components/VerdictCard.jsx';
import BoardWeekly from '../components/BoardWeekly.jsx';
import ArrivalsTray from '../components/ArrivalsTray.jsx';
import { evidenceRows, verdictMemo } from '../lib/panelParts.js';
import { devVerdict } from '../dev/panelFixtures.js';

afterEach(() => { cleanup(); vi.clearAllMocks(); stories.value = {}; });

const record = { entries: [
  { date: '2026-10-16', title: 'Entry', sources: [{ outlet: 'BBC', title: 'BBC headline' }, { outlet: 'Other', title: 'Not shared' }] },
  { date: '2026-10-17', title: 'Entry 2', sources: [{ outlet: 'reuters', title: 'Reuters headline' }] },
] };

describe('panelParts', () => {
  it('evidence rows are the dated headlines of shared outlets, newest first', () => {
    const rows = evidenceRows({ a: record, b: record }, ['BBC', 'Reuters']);
    expect(rows.map((r) => `${r.date} ${r.outlet} ${r.headline}`)).toEqual(['2026-10-17 reuters Reuters headline', '2026-10-16 BBC BBC headline']);
    expect(evidenceRows({ a: record }, [])).toEqual([]);
  });
  it('memo text names the pair, grounds and the line', () => {
    const memo = verdictMemo({ labelA: 'A', labelB: 'B', strengthWord: 'Weak link', note: 'n', shared: ['iran'], evidence: [], line: ' mine ' });
    expect(memo).toContain('A / B');
    expect(memo).toContain('Shared: iran');
    expect(memo).toContain('My line: mine');
  });
});

describe('verdict card (artboard 3)', () => {
  const a = { kind: 'thread', refId: 'story-a' };
  const b = { kind: 'thread', refId: 'story-b' };
  const show = (result, props = {}) => render(<VerdictCard labelA="Hormuz" labelB="Premiums" state={{ result }} onKeep={vi.fn()} onDismiss={vi.fn()} {...props} />);

  it('shows the header, chips, evidence, joint trace with its lag, and the line input', () => {
    stories.value = { 'story-a': record };
    show(devVerdict(a, b));
    expect(screen.getByText('Connection verdict')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Who sits in both' })).getByText('us navy')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Evidence' })).getByText('BBC headline')).toBeInTheDocument();
    expect(screen.getByText('lag: 2 days')).toBeInTheDocument();
    expect(screen.getByLabelText(/Your line/)).toBeInTheDocument();
    expect(screen.queryByText(/mechanism|what follows|break it/i)).toBeNull();
  });

  it('draws no evidence or trace when the data is absent, and the plain pairing line stands in', () => {
    const r = devVerdict(a, b);
    r.grounds = [{ kind: 'comovement', detail: { pairs: 2, lagDays: 3 } }];
    show(r);
    expect(screen.queryByRole('region', { name: 'Evidence' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Joint trace' })).toBeNull();
    expect(screen.getByText(/2 pairings, up to 3 days apart/)).toBeInTheDocument();
  });

  it('Close and Drop it dismiss; Keep string passes the line', () => {
    const onKeep = vi.fn();
    const onDismiss = vi.fn();
    show(devVerdict(a, b), { onKeep, onDismiss });
    fireEvent.change(screen.getByLabelText(/Your line/), { target: { value: 'why' } });
    fireEvent.click(screen.getByRole('button', { name: 'Keep string' }));
    expect(onKeep).toHaveBeenCalledWith('why');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drop it' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('Export as memo copies the text', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    show(devVerdict(a, b));
    fireEvent.click(screen.getByRole('button', { name: 'Export as memo' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Hormuz / Premiums')));
    expect(await screen.findByText('Memo copied to the clipboard.')).toBeInTheDocument();
  });
});

describe('weekly (artboard 4)', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const board = { name: 'Gulf', dismissed: [], pins: [{ pinId: 'p1', kind: 'thread', refId: 'story-a', lastMoved: '2026-10-20', line: 'A reading' }], strings: [{ a: 'p1', b: 'p2', owner: 'yours', keptAt: '2026-10-19', line: 'my note' }] };
  const link = { 'story-a': { confirmedLinks: [{ otherThreadId: 'oil', direction: 'drives', mechanism: 'Oil moves it', week: '2026-W43', cites: [] }] } };
  const dueStory = { a: { threadId: 'a', forks: [{ branches: [{ branchId: 'x', text: 'Vessel struck', p: 80, due: '2026-10-23', verdict: null }] }] } };

  it('titles the week, counts the changes and lists moved pins and strings', () => {
    render(<MemoryRouter><BoardWeekly board={board} stories={dueStory} links={link} now={now} info={{ p1: { label: 'Hormuz', risk: 85 } }} /></MemoryRouter>);
    expect(screen.getByText('Your board moved · week ending 25 Oct')).toBeInTheDocument();
    expect(screen.getByText('1 pin moved · 1 string changed · 1 new link found')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText(/my note/)).toBeInTheDocument();
    expect(screen.getByText(/week of 19 Oct/)).toBeInTheDocument();
    expect(screen.queryByText('Due this week')).toBeNull();
  });

  it('a new link has Add pin and Dismiss only when the handlers are given', () => {
    const { rerender } = render(<MemoryRouter><BoardWeekly board={board} stories={{}} links={link} now={now} /></MemoryRouter>);
    expect(screen.getByText('New link we found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add pin' })).toBeNull();
    const onAddPin = vi.fn();
    const onDismissLink = vi.fn();
    rerender(<MemoryRouter><BoardWeekly board={board} stories={{}} links={link} now={now} onAddPin={onAddPin} onDismissLink={onDismissLink} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Add pin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAddPin).toHaveBeenCalledWith('oil');
    expect(onDismissLink).toHaveBeenCalledWith('oil');
  });

  it('a dismissed link is not listed', () => {
    render(<MemoryRouter><BoardWeekly board={{ ...board, dismissed: ['oil'] }} stories={{}} links={link} now={now} /></MemoryRouter>);
    expect(screen.queryByText('New link we found')).toBeNull();
  });
});

describe('arrivals clue pool (artboard 5)', () => {
  const cards = [
    { threadId: 't1', title: 'First story', date: '2026-10-19', strength: 'strong', via: [{ pinId: 'p1', threadId: 'x', mechanism: 'm1', direction: 'drives' }, { pinId: 'p2', threadId: 'y', mechanism: 'm2' }] },
    { threadId: 't2', title: 'Second story', date: '2026-10-18', strength: 'medium', via: [{ pinId: 'p1', threadId: 'x', mechanism: 'm3' }] },
  ];
  const board = { boardId: 'b', pins: [{ pinId: 'p1', kind: 'thread', refId: 'x', line: 'Pin one' }], dismissed: [] };
  const setup = (props = {}) => {
    call.mockResolvedValue({ recordAvailable: true, since: '2026-10-18', arrivals: cards });
    return render(<MemoryRouter><ArrivalsTray board={board} onKeep={vi.fn()} onDismiss={vi.fn()} {...props} /></MemoryRouter>);
  };

  it('counts unseen cards, shows them face down with only a teaser, and turns one over', async () => {
    setup();
    expect(await screen.findByText('2 unseen')).toBeInTheDocument();
    expect(screen.getByText('Cards wait here. Nothing is on the board until you place it.')).toBeInTheDocument();
    expect(screen.getByText('via Pin one / 2 tracked stories')).toBeInTheDocument();
    expect(screen.queryByText(/m1/)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Turn over' })[0]);
    expect(screen.getByText('1 unseen')).toBeInTheDocument();
    expect(screen.getByText(/Via Pin one: m1 \(drives\)/)).toBeInTheDocument();
    expect(screen.getByText('strong')).toBeInTheDocument();
  });

  it('keeping a turned-over card passes it on', async () => {
    const onKeep = vi.fn();
    setup({ onKeep });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Turn over' }))[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Keep story' }));
    expect(onKeep).toHaveBeenCalledWith(cards[1]);
  });

  it('a dismissed card fades before it goes', async () => {
    const onDismiss = vi.fn();
    const { rerender } = setup({ onDismiss });
    fireEvent.click((await screen.findAllByRole('button', { name: 'Turn over' }))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss arrival' }));
    expect(onDismiss).toHaveBeenCalledWith('t1');
    rerender(<MemoryRouter><ArrivalsTray board={{ ...board, dismissed: ['t1'] }} onKeep={vi.fn()} onDismiss={onDismiss} /></MemoryRouter>);
    expect(screen.getByText('Dismissed · fading')).toBeInTheDocument();
    expect(screen.getByText('1 unseen')).toBeInTheDocument();
  });
});
