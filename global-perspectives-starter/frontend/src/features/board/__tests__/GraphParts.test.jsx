import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BoardTopBar from '@/features/board/components/BoardTopBar.jsx';
import DueStrip, { dueBranches } from '@/features/board/components/DueStrip.jsx';
import RailBranches from '@/features/board/components/RailBranches.jsx';
import WeekScrubber from '@/features/board/components/WeekScrubber.jsx';
import MissingCard from '@/features/board/components/MissingCard.jsx';
import { pinTypeLine, pinCountParts, stringLabel } from '@/features/board/lib/graphText.js';
import { failedCombos, ghostPosition } from '@/features/board/lib/boardOps.js';
import { isoWeekEnd } from '@/features/board/lib/recordViews.js';

afterEach(cleanup);

const story = {
  threadId: 'story-a',
  forks: [{
    forkId: 'f1', drawnAt: '2026-10-19',
    branches: [
      { branchId: 'f1-0', text: 'Premiums rise again', p: 65, trigger: 'A second insurer announces an increase', due: '2026-11-30', verdict: null },
      { branchId: 'f1-1', text: 'Talks restart', p: 10, trigger: 'Talks restart', due: '2026-10-12', verdict: { at: '2026-10-13', result: 'no' } },
      { branchId: 'f1-2', text: 'Old question', p: null, due: '2026-10-01', legacy: true, verdict: null },
      { branchId: 'f1-3', text: 'Shipping resumes', p: 20, trigger: 'Traffic returns', due: '2026-10-25', verdict: null },
    ],
  }],
};

describe('top bar', () => {
  const props = { board: { boardId: 'b1', name: 'Gulf and the Horn' }, pinCount: 7, saving: false, views: ['graph'], view: 'graph', onView: vi.fn(), weekEnd: '2026-10-18', addOpen: false, onAdd: vi.fn(), onRename: vi.fn() };
  it('shows the board name, the week ending as a reader date, the pin count and the Add pin button', () => {
    render(<BoardTopBar {...props} />);
    expect(screen.getByText('Studio board')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Board name: Gulf and the Horn/ })).toBeInTheDocument();
    expect(screen.getByText('Week ending 18 Oct 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('7 of 12 pins used')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add pin' }));
    expect(props.onAdd).toHaveBeenCalled();
  });
  it('shows the Map and Graph switch only when the board has more than one view', () => {
    const onView = vi.fn();
    const { rerender } = render(<BoardTopBar {...props} onView={onView} />);
    expect(screen.queryByRole('group', { name: 'Board view' })).toBeNull();
    rerender(<BoardTopBar {...props} onView={onView} views={['map', 'graph']} />);
    expect(screen.getByRole('button', { name: 'Graph' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onView).toHaveBeenCalledWith('map');
  });
});

describe('due on your board', () => {
  it('lists open branches with a due date, nearest first, with the date and our percentage', () => {
    expect(dueBranches({ a: story }, '2026-10-20').map((r) => r.id)).toEqual(['story-a:f1-3', 'story-a:f1-0']);
    render(<DueStrip stories={{ a: story }} today="2026-10-20" />);
    expect(screen.getByText('25 Oct · 20%')).toBeInTheDocument();
    expect(screen.getByText('Premiums rise again')).toBeInTheDocument();
  });
  it('says "past due" for an open branch whose date has passed, and is absent with nothing open', () => {
    render(<DueStrip stories={{ a: story }} today="2026-11-02" />);
    expect(screen.getByText('25 Oct · 20% · past due')).toBeInTheDocument();
    cleanup();
    const { container } = render(<DueStrip stories={{}} today="2026-10-20" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('branches in the rail', () => {
  it('lists the open branches with percentage and trigger, tagged as a model judgment', () => {
    render(<RailBranches stories={{ a: story }} labelOf={() => 'Hormuz'} />);
    expect(screen.getByText('Premiums rise again')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('trigger: A second insurer announces an increase')).toBeInTheDocument();
    expect(screen.getByText('MODEL JUDGMENT')).toBeInTheDocument();
    expect(screen.queryByText('Talks restart')).toBeNull(); // settled
  });
});

describe('week scrubber', () => {
  it('steps through the kept weeks and reports the chosen one; absent with fewer than two', () => {
    const onChange = vi.fn();
    render(<WeekScrubber weeks={['2026-10-04', '2026-10-11', '2026-10-18']} note="No archive for 14 Oct" onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Week' }), { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith('2026-10-04');
    expect(screen.getByText('No archive for 14 Oct')).toBeInTheDocument();
    cleanup();
    const { container } = render(<WeekScrubber weeks={['2026-10-18']} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('what is missing', () => {
  it('says how many pins touch an actor you do not follow, and adds or follows it', () => {
    const onAdd = vi.fn();
    const onFollow = vi.fn();
    render(<MissingCard actors={[{ name: 'oil price', pins: ['p01', 'p02', 'p04'] }]} onAdd={onAdd} onFollow={onFollow} />);
    expect(screen.getByText('3 of your pins touch oil price. You do not follow it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add pin oil price' }));
    fireEvent.click(screen.getByRole('button', { name: 'Follow oil price' }));
    expect(onAdd).toHaveBeenCalledWith('oil price');
    expect(onFollow).toHaveBeenCalledWith('oil price');
  });
  it('hides Add pin when the board is full, and is absent with nothing missing', () => {
    render(<MissingCard actors={[{ name: 'x', pins: ['p01', 'p02'] }]} full onAdd={vi.fn()} onFollow={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Add pin/ })).toBeNull();
    cleanup();
    const { container } = render(<MissingCard actors={[]} onAdd={vi.fn()} onFollow={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('graph text', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  it('words the type line from crisis type and kind, "New this week" for a story born in the last seven days', () => {
    expect(pinTypeLine({ kind: 'thread' }, { category: 'conflict' }, now).text).toBe('Conflict · Story');
    expect(pinTypeLine({ kind: 'thread' }, { category: 'conflict' }, now).dot).toBe('var(--hue-conflict)');
    expect(pinTypeLine({ kind: 'thread', born: '2026-10-18' }, {}, now).text).toBe('New this week');
    expect(pinTypeLine({ kind: 'thread', born: '2026-09-01' }, {}, now)).toEqual({ text: 'Story', dot: undefined });
    expect(pinTypeLine({ kind: 'country' }, { category: 'conflict' }, now).text).toBe('Country');
  });
  it('lists only the counts the pin carries', () => {
    expect(pinCountParts({ recordAvailable: true, counts: { chapters: 2, liveBranches: null, confirmedLinks: 0 } })).toEqual(['2 chapters', '0 confirmed links']);
    expect(pinCountParts({ counts: { chapters: 2 } })).toEqual([]);
  });
  it('labels strings; "Not confirmed" only when the string says so', () => {
    expect(stringLabel({ owner: 'ours', strength: 'medium', confirmed: false, mechanism: 'm' })).toEqual({ head: 'Ours · Medium · Not confirmed', body: 'm' });
    expect(stringLabel({ owner: 'ours', strength: 'strong' }).head).toBe('Ours · Strong');
    expect(stringLabel({ owner: 'yours', line: 'x' })).toEqual({ head: 'Yours', body: '“x”' });
  });
});

describe('board helpers', () => {
  it('failedCombos lists a test with no link where no string joins the pair', () => {
    const board = { pins: [{ pinId: 'p01', kind: 'thread', refId: 't1' }, { pinId: 'p02', kind: 'thread', refId: 't2' }, { pinId: 'p03', kind: 'thread', refId: 't3' }], strings: [{ a: 'p01', b: 'p03', owner: 'yours' }] };
    const none = (a, b) => ({ a: { kind: 'thread', refId: a }, b: { kind: 'thread', refId: b }, strength: 'none', note: 'No link found.' });
    expect(failedCombos(board, [none('t1', 't2'), none('t1', 't3'), { ...none('t2', 't3'), strength: 'weak' }])).toEqual([{ a: 'p01', b: 'p02', text: 'No link found.' }]);
  });
  it('ghostPosition stays inside the canvas', () => {
    const at = ghostPosition([{ x: 100, y: 100 }, { x: 900, y: 100 }], [{ x: 100, y: 100 }, { x: 900, y: 100 }], 1080, 660);
    expect(at.x).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(660);
  });
  it('isoWeekEnd is the Sunday of the ISO week', () => {
    expect(isoWeekEnd('2026-10-14')).toBe('2026-10-18');
    expect(isoWeekEnd('2026-10-18')).toBe('2026-10-18');
    expect(isoWeekEnd('2026-10-19')).toBe('2026-10-25');
  });
});
