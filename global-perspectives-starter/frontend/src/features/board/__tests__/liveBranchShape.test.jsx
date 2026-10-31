import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DueStrip, { dueBranches } from '@/features/board/components/DueStrip.jsx';
import RailBranches from '@/features/board/components/RailBranches.jsx';
import BoardWeekly from '@/features/board/components/BoardWeekly.jsx';
import StoryTree from '@/features/board/components/StoryTree.jsx';
import { branchLine, branchScenario, branchPercent } from '../lib/branchView.js';
import { forkWeights } from '../lib/divergence.js';
import { drawnBranches, foldTrunk } from '../lib/storyTree.js';
afterEach(cleanup);

// The LIVE record shape: text is the scenario name, trigger the question, p null, the number is scenarioP.
const voidLegacy = { at: '2026-10-28T00:00:00Z', result: 'void', decidedBy: 'operator-job', voidReason: 'issued_before_method', evidence: null };
const live = (id, name, sp, trigger, due, verdict = null, legacy = false) =>
  ({ branchId: id, text: name, p: null, scenarioP: sp, trigger, resolutionSource: '', due, question: false, qid: null, verdict, scoring: null, state: null, legacy });
const story = {
  threadId: 'nk', builtFrom: { factsThrough: '2026-10-31' },
  entries: [{ eventId: 'e1', date: '2026-08-01', title: 'Old event' }, { eventId: 'e2', date: '2026-08-20', title: 'Newest event' }],
  forks: [
    { forkId: 'old', drawnAt: '2026-08-02', branches: [live('o1', 'Most Likely', 65, 'Old fork open question', '2026-09-01'), live('o2', 'Optimistic', 20, 'Old fork two', '2026-09-01')] },
    { forkId: 'new', drawnAt: '2026-10-20', branches: [
      live('n1', 'Most Likely', 65, 'IAEA adopts a resolution on the new enrichment site', '2026-12-31'),
      live('n2', 'Optimistic', 20, 'Talks resume in Beijing', '2026-11-20'),
      live('n3', 'Pessimistic', 15, 'A sixth test is announced', '2026-10-25'),
      live('n4', 'Settled', 5, 'Already settled', '2026-10-01', voidLegacy, true),
    ] },
  ],
};

describe('branch view helpers', () => {
  it('reads the live and the modern shape', () => {
    const b = story.forks[1].branches[0];
    expect([branchLine(b), branchScenario(b), branchPercent(b)]).toEqual(['IAEA adopts a resolution on the new enrichment site', 'Most Likely', 65]);
    const modern = { text: 'Will talks resume?', p: 40, question: true, qid: 'q1' };
    expect([branchLine(modern), branchScenario(modern), branchPercent(modern)]).toEqual(['Will talks resume?', null, 40]);
    expect(branchPercent({ p: NaN, scenarioP: undefined })).toBeNull();
  });
});

describe('live-shaped branches on the board', () => {
  it('due strip: story, question, scenario tag, date and percent; upcoming first, past due after, none with a verdict', () => {
    const rows = dueBranches({ nk: story }, '2026-11-01');
    expect(rows.map((r) => r.id)).toEqual(['nk:n2', 'nk:n1', 'nk:o1', 'nk:o2']);
    render(<DueStrip stories={{ nk: story }} today="2026-11-01" labelOf={() => 'North Korea'} />);
    expect(screen.getAllByText('North Korea').length).toBeGreaterThan(0);
    expect(screen.getByText('Talks resume in Beijing')).toBeInTheDocument();
    expect(screen.getByText('20 Nov · 20%')).toBeInTheDocument();
    expect(screen.queryByText('Already settled')).toBeNull();
  });
  it('due strip: past-due branches never crowd out upcoming ones', () => {
    const many = { threadId: 's', forks: [{ forkId: 'f', branches: [
      ...[1, 2, 3, 4, 5].map((i) => live(`p${i}`, 'Most Likely', 10, `past ${i}`, `2026-09-0${i}`)),
      live('u1', 'Most Likely', 10, 'upcoming', '2026-12-01')] }] };
    expect(dueBranches({ s: many }, '2026-11-01')[0].line).toBe('upcoming');
  });
  it('rail shows the scenario with the scenarioP percent', () => {
    render(<RailBranches stories={{ nk: story }} labelOf={() => 'NK'} />);
    expect(screen.getAllByText('Most Likely').length).toBeGreaterThan(0);
    expect(screen.getAllByText('65%').length).toBeGreaterThan(0);
  });
  it('weekly: real outcomes listed, every "could not be checked" folded into one counted line', () => {
    const real = { ...live('n5', 'Most Likely', 75, 'Real thing happened', '2026-10-07', { at: '2026-10-28T00:00:00Z', result: 'yes', evidence: { date: '2026-10-07' } }) };
    const voids = [1, 2, 3].map((i) => live(`v${i}`, 'Most Likely', 10, `Unchecked ${i}`, '2026-10-01', voidLegacy, true));
    const st = { threadId: 'nk', forks: [{ forkId: 'f', branches: [real, ...voids] }] };
    render(<MemoryRouter><BoardWeekly board={{ recordAvailable: true, pins: [], strings: [] }} stories={{ nk: st }} now={new Date('2026-10-30T12:00:00Z')} /></MemoryRouter>);
    expect(screen.getByText(/Real thing happened \(Most Likely\): happened · 7 Oct/)).toBeInTheDocument();
    expect(screen.queryByText(/Unchecked 1/)).toBeNull();
    expect(screen.getByText('3 could not be checked (recorded before scoring began)')).toBeInTheDocument();
  });
  it('divergence weights use scenarioP and the question', () => {
    const board = { pins: [{ pinId: 'p1', kind: 'thread', refId: 'nk' }], weights: {} };
    const f = forkWeights(board, { nk: story }).find((x) => x.forkId === 'new');
    expect(f.branches[0]).toMatchObject({ line: 'IAEA adopts a resolution on the new enrichment site', text: 'Most Likely', ours: 65 });
  });
});

describe('story tree drawing', () => {
  it('draws only the open branches of the newest fork that has any, at most six', () => {
    expect(drawnBranches(story.forks).map((b) => b.branchId)).toEqual(['n1', 'n2', 'n3']);
    const big = [{ forkId: 'x', drawnAt: '2026-10-01', branches: Array.from({ length: 10 }, (_, i) => live(`b${i}`, 'Most Likely', 5, `q${i}`, '2026-12-01')) }];
    expect(drawnBranches(big)).toHaveLength(6);
    expect(drawnBranches([{ forkId: 'x', drawnAt: '2026-10-01', branches: [live('s', 'a', 1, 'b', '2026-10-01', voidLegacy, true)] }])).toEqual([]);
  });
  it('renders the branch question with the scenario tag and percent-weighted lines; the older fork stays in the list only', () => {
    const { container } = render(<MemoryRouter><StoryTree story={story} /></MemoryRouter>);
    const svg = container.querySelector('svg.story-tree__svg');
    expect([...svg.querySelectorAll('path.st-branch')].map((p) => Number(p.getAttribute('stroke-width')))).toEqual([26, 8, 6]);
    expect(svg.textContent).toContain('IAEA adopts a resolution');
    expect(svg.textContent).not.toContain('Old fork open question');
    expect(container.textContent).toContain('Old fork open question');
  });
  it('draws the newest event on the trunk even when every event is older than four weeks', () => {
    expect(foldTrunk(story.entries, story.forks, '2026-10-31').shown.map((e) => e.eventId)).toEqual(['e2']);
    const { container } = render(<MemoryRouter><StoryTree story={story} /></MemoryRouter>);
    const svg = container.querySelector('svg.story-tree__svg');
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.textContent).toContain('Newest event');
  });
});
