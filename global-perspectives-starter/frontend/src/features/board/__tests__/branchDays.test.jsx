import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { todayUTC, isOpen, isLate, isLive, isDueThisWeek, uniqueStories, branchCounts, branchCountText, dueCounts } from '../lib/branchDays.js';
import { dueBranches } from '../components/DueStrip.jsx';
import { monthlyView } from '../lib/monthly.js';
import { pinCountParts } from '../lib/graphText.js';
import { writtenByYou, cutByYou } from '../lib/divergence.js';
import UnsettledZone from '../components/UnsettledZone.jsx';
import FoldingRules from '../components/FoldingRules.jsx';
import { DEAD_BRANCH_P } from '../lib/folding.js';
afterEach(cleanup);

// 2026-11-03 is a Tuesday: its ISO week ends Sunday 8 Nov.
const TODAY = '2026-11-03';
const b = (branchId, due, extra = {}) => ({ branchId, text: branchId, due, ...extra });
const story = (threadId, branches) => ({ threadId, forks: [{ forkId: `f-${threadId}`, drawnAt: '2026-10-20', branches }] });
const branches = [
  b('late1', '2026-11-01'), b('late2', '2026-10-01'),                       // open, due before today: late
  b('today', TODAY), b('thu', '2026-11-05'), b('sun', '2026-11-08'),         // live, due this week
  b('next', '2026-11-09'), b('far', '2027-01-01'), b('nodate', undefined),   // live, due later or never
  b('done', '2026-10-01', { verdict: { result: 'yes', at: '2026-10-02' } }), // settled: not open
  b('old', '2026-10-01', { legacy: true }),                                  // recorded before scoring: not open
];
const stories = { 'pin-ref': story('nk', branches) };

describe('one definition of today, live, late and due this week', () => {
  it('today is the UTC day', () => {
    expect(todayUTC(new Date('2026-11-03T23:30:00Z'))).toBe('2026-11-03');
    expect(todayUTC(new Date('2026-11-04T00:30:00Z'))).toBe('2026-11-04');
  });
  it('open, late and live', () => {
    const by = (id) => branches.find((x) => x.branchId === id);
    expect(branches.filter(isOpen).map((x) => x.branchId)).toEqual(['late1', 'late2', 'today', 'thu', 'sun', 'next', 'far', 'nodate']);
    expect(branches.filter((x) => isLate(x, TODAY)).map((x) => x.branchId)).toEqual(['late1', 'late2']);
    expect(isLate(by('today'), TODAY)).toBe(false); // due today is not late
    expect(branches.filter((x) => isLive(x, TODAY)).map((x) => x.branchId)).toEqual(['today', 'thu', 'sun', 'next', 'far', 'nodate']);
    expect(branches.filter((x) => isDueThisWeek(x, TODAY)).map((x) => x.branchId)).toEqual(['today', 'thu', 'sun']); // to the Sunday
  });
  it('counts and wording: live and late, zero parts left out', () => {
    const counts = branchCounts(stories['pin-ref'].forks, TODAY);
    expect(counts).toEqual({ live: 6, late: 2 });
    expect(branchCountText(counts)).toBe('6 live branches · 2 late');
    expect(branchCountText({ live: 1, late: 0 })).toBe('1 live branch');
    expect(branchCountText({ live: 0, late: 3 })).toBe('3 late');
    expect(branchCountText({ live: 0, late: 0 })).toBe('');
  });
  it('a story merged into one survivor counts once', () => {
    expect(uniqueStories({ a: story('nk', []), b: story('nk', []), c: null, d: story('other', []) }).map((x) => x.key)).toEqual(['a', 'd']);
  });

  it('the card, the due strip, the monthly and the unsettled zone agree on the same board', () => {
    const board = { pins: [], strings: [], weights: {} };
    // pin card
    expect(pinCountParts({ recordAvailable: true, counts: { liveBranches: 99 } }, stories['pin-ref'], TODAY)).toEqual(['6 live branches · 2 late']);
    // due strip: upcoming first (four fit), and the same two are flagged late when they are what is left
    expect(dueBranches(stories, TODAY).map((r) => r.late)).toEqual([false, false, false, false]);
    expect(dueBranches({ x: story('nk', branches.slice(0, 2)) }, TODAY).map((r) => r.late)).toEqual([true, true]);
    // monthly: due this week and past due
    const m = monthlyView(board, stories, TODAY);
    expect(m.ours).toEqual({ settled: 0, dueThisWeek: 3, late: 2 });
    // unsettled zone
    expect(dueCounts(stories, TODAY)).toEqual({ dueThisWeek: 3, late: 2 });
    render(<UnsettledZone ids={['nk']} stories={stories} today={TODAY}
      counts={{ byDate: { [TODAY]: { byStory: { nk: { newEntries: 2, branchesDue: 11, verdicts: 0 } } } }, loading: false, error: false, week: [TODAY], since: null, visit: null }} />);
    expect(screen.getByText('this week, unsettled: 2 new entries, 3 branches due, 0 verdicts, 2 past due')).toBeInTheDocument();
  });
});

describe('what the sheet says is true of the code', () => {
  it('the 20% line is the one the tree folds on', () => {
    render(<FoldingRules />);
    expect(screen.getByText(`A branch under ${DEAD_BRANCH_P}%`)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/count on the pin|you can edit yours|Folded from the start/);
  });
});

describe('divergence with a reader\'s line on our string', () => {
  const board = { strings: [
    { a: 'p1', b: 'p2', owner: 'ours', strength: 'inferred', cutAt: '2026-10-20T00:00:00Z', line: 'still true' },
    { a: 'p1', b: 'p3', owner: 'yours', line: 'mine' },
    { a: 'p2', b: 'p3', owner: 'yours', line: 'cut one', cutAt: '2026-10-21T00:00:00Z' },
  ] };
  it('lists both the cut of ours and the line written beside it; a cut string of yours keeps its line out', () => {
    expect(cutByYou(board)).toEqual([{ a: 'p1', b: 'p2', cutAt: '2026-10-20T00:00:00Z' }]);
    expect(writtenByYou(board).map((x) => x.line)).toEqual(['still true', 'mine']);
  });
});
