import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AlertsPanel from '@/features/board/components/AlertsPanel.jsx';
import MonthlyCard from '@/features/board/components/MonthlyCard.jsx';
import { monthlyView, firstLine } from '@/features/board/lib/monthly.js';

afterEach(cleanup);
const labelOf = (id) => `Pin ${id}`;
const board = {
  pins: [{ pinId: 'p1', kind: 'thread', refId: 't1', lastMoved: '2026-09-20' }, { pinId: 'p2', kind: 'thread', refId: 't2' }],
  strings: [{ a: 'p1', b: 'p2', owner: 'ours', strength: 'medium' }, { a: 'p1', b: 'p3', owner: 'yours', line: 'watch Cairo', keptAt: '2026-10-25T00:00:00Z' }],
  weights: { f1: { b1: 0.5 } },
  summary: { versions: [{ text: 'First week. More.', writtenAt: '2026-10-10T00:00:00Z' }, { text: 'Second week. More.', writtenAt: '2026-10-17T00:00:00Z' }] },
};
const stories = { t1: { threadId: 't1', forks: [{ forkId: 'f1', branches: [
  { branchId: 'b1', text: 'Premiums rise', due: '2026-10-20', verdict: { at: '2026-10-20', result: 'yes' } },
  { branchId: 'b2', text: 'Talks restart', p: 40, due: '2026-11-05', verdict: null },
] }] } };

describe('monthlyView', () => {
  it('reads the arc, previous summaries, branches and quiet pins from stored data', () => {
    const m = monthlyView(board, stories, '2026-10-31');
    expect(m.arc.map((v) => v.date)).toEqual(['2026-10-10', '2026-10-17']);
    expect(m.previous).toHaveLength(1);
    expect(m.ours.settled).toBe(1);
    expect(m.yours).toEqual({ set: 1, settled: 1 });
    expect(m.quiet).toEqual([{ pinId: 'p1', weeks: 5 }]);
    expect(m.dates.map((d) => d.line)).toEqual(['Talks restart']);
  });
  it('first line of a summary is its first sentence', () => expect(firstLine('One. Two.')).toBe('One.'));
  it('renders nothing for an empty board', () => {
    const { container } = render(<MonthlyCard board={{ pins: [], strings: [], weights: {}, summary: { versions: [] } }} stories={{}} today="2026-10-31" labelOf={labelOf} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the parts and retires a quiet pin', () => {
    let retired = null;
    render(<MonthlyCard board={board} stories={stories} today="2026-10-31" labelOf={labelOf} onRetire={(id) => { retired = id; }} />);
    expect(screen.getByText(/Previous summaries/)).toBeTruthy();
    expect(screen.getByText('Second week.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retire pin Pin p1' }));
    expect(retired).toBe('p1');
  });
});

describe('AlertsPanel', () => {
  it('switches a row and the quiet board', () => {
    render(<AlertsPanel board={board} labelOf={labelOf} />);
    const row = screen.getByRole('group', { name: 'Delivery for Branch fired, Pin p1' });
    fireEvent.click(screen.getByRole('button', { name: 'Branch fired, Pin p1' }));
    expect(row.textContent).toContain('no alert');
    fireEvent.click(screen.getByRole('button', { name: 'Quiet board: weekly only, no alerts' }));
    expect(screen.getByRole('button', { name: 'A date is tomorrow, All pins' }).disabled).toBe(true);
  });
});
