import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RecordPinDetails from '../components/RecordPinDetails.jsx';
import BoardWeekly from '../components/BoardWeekly.jsx';
import UnsettledZone from '../components/UnsettledZone.jsx';
import story from '../dev/recordViews/story-a.json';
import counts from '../dev/recordViews/counts.json';
import { boardWeek, sumCounts, isoWeekOf } from '../lib/recordProjection.js';
import { fetchStoryView, fetchCounts, isoWeekStart, datesBetween } from '../lib/recordViews.js';
import { countDates } from '../hooks/useWeekCounts.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

describe('weekly', () => {
  it('absent records never invent changes or counts', () => {
    render(<BoardWeekly board={{ pins: [], strings: [], recordAvailable: false }} stories={{}} />);
    expect(screen.getByText('Nothing on your board changed in the last seven days.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
  it('uses dated changes within its seven-day window only; verdicts need a verdict date', () => {
    const board = { pins: [{ pinId: 'p1', lastMoved: '2026-10-19' }], strings: [{ a: 'p1', b: 'p2', keptAt: '2026-10-19', cutAt: '2026-09-01' }] };
    const week = boardWeek(board, { a: story }, {}, new Date('2026-10-21T12:00:00Z'));
    expect(week.moved).toHaveLength(1); expect(week.strings).toHaveLength(1);
    expect(week.branches).toEqual([{ branchId: 'f1-0', text: 'Premiums rise again', threadId: 'story-a', date: '2026-10-20', result: 'yes', status: 'happened · 20 Oct' }]);
    expect(boardWeek(board, { a: story }, {}, new Date('2026-11-30T12:00:00Z')).branches).toHaveLength(0);
  });
  it('renders recorded verdicts and confirmed links', () => {
    render(<MemoryRouter><BoardWeekly board={{ recordAvailable: true, pins: [{ pinId: 'p1', lastMoved: '2026-10-21' }], strings: [] }} stories={{ a: story }}
      links={{ 'story-a': { confirmedLinks: [{ otherThreadId: 'b', direction: 'drives', mechanism: 'Recorded transmission', week: '2026-W43', cites: [] }] } }} now={new Date('2026-10-21T12:00:00Z')} /></MemoryRouter>);
    expect(screen.getByText(/Premiums rise again: happened · 20 Oct/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded transmission/)).toBeInTheDocument();
  });
  it('a confirmed link counts only in the current ISO week', () => {
    const link = (week) => ({ otherThreadId: 'b', direction: 'shared_cause', mechanism: 'm', week, cites: [] });
    const now = new Date('2026-10-21T12:00:00Z');
    expect(isoWeekOf(now)).toBe('2026-W43'); expect(isoWeekOf(new Date('2027-01-03T00:00:00Z'))).toBe('2026-W53');
    const out = boardWeek({ pins: [], strings: [] }, {}, { a: { confirmedLinks: [link('2026-W43'), link('2026-W42')] } }, now);
    expect(out.links.map((l) => l.week)).toEqual(['2026-W43']);
  });
});

describe('pin details', () => {
  it('render nothing without a record; null readings are omitted, real counts (including zero) stay', () => {
    const { container, rerender } = render(<RecordPinDetails pin={{ counts: { chapters: 0 } }} />);
    expect(container.textContent).toBe('');
    rerender(<RecordPinDetails pin={{ recordAvailable: true, line: null, counts: { chapters: null, liveBranches: 0, confirmedLinks: null } }} />);
    expect(container.textContent).toBe('0 live branches');
  });
});

describe('unsettled zone', () => {
  const week = ['2026-10-19', '2026-10-20', '2026-10-21'];
  const zone = (byDate, extra = {}) => render(<UnsettledZone ids={['story-a']} counts={{ byDate, loading: false, error: false, week, since: null, visit: null, ...extra }} />);
  it('sums the week for the pinned stories only, with the exact label', () => {
    zone({ '2026-10-20': { byStory: { 'story-a': { newEntries: 2, branchesDue: 1, verdicts: 1 }, other: { newEntries: 9, branchesDue: 9, verdicts: 9 } } }, '2026-10-21': counts });
    expect(screen.getByText('this week, unsettled: 3 new entries, 1 branches due, 1 verdicts')).toBeInTheDocument();
  });
  it('all zero says nothing new; no files at all renders nothing; failures say so', () => {
    zone({ '2026-10-21': { byStory: {} } });
    expect(screen.getByText('Nothing new this week.')).toBeInTheDocument();
    cleanup(); const { container } = zone({ '2026-10-21': null });
    expect(container.textContent).toBe('');
    cleanup(); zone({}, { error: true });
    expect(screen.getByText('This week’s counts could not be read.')).toBeInTheDocument();
  });
  it('new entries since the last visit appear only when there are some', () => {
    zone({ '2026-10-21': counts }, { since: ['2026-10-21'], visit: '2026-10-20' });
    expect(screen.getByText('1 new entries since 2026-10-20')).toBeInTheDocument();
    cleanup(); zone({ '2026-10-21': { byStory: {} } }, { since: ['2026-10-21'], visit: '2026-10-20' });
    expect(screen.queryByText(/since/)).toBeNull();
  });
  it('sums, weeks and the visit window', () => {
    expect(sumCounts({ a: { byStory: { x: { newEntries: 1, branchesDue: 2, verdicts: 3 } } } }, ['a', 'b'], ['x'])).toEqual({ newEntries: 1, branchesDue: 2, verdicts: 3 });
    expect(isoWeekStart('2026-10-21')).toBe('2026-10-19'); expect(isoWeekStart('2026-10-25')).toBe('2026-10-19'); expect(isoWeekStart('2026-10-26')).toBe('2026-10-26');
    expect(datesBetween('2026-10-19', '2026-10-21')).toEqual(week);
    expect(countDates('2026-10-21', '2026-10-20T09:00:00Z')).toMatchObject({ week, since: ['2026-10-21'], visit: '2026-10-20' });
    expect(countDates('2026-10-21', '2026-10-21T01:00:00Z').since).toEqual([]);
    expect(countDates('2026-10-21', '2026-01-01T00:00:00Z').since).toBeNull();
    expect(countDates('2026-10-21', undefined).since).toEqual([]);
  });
});

describe('record view fetches', () => {
  it('404 is null, other failures throw, an alias fetches the survivor', async () => {
    const fetchMock = vi.fn(async (url) => url.endsWith('stories/gone.json') ? res(404)
      : url.endsWith('stories/merged.json') ? res(200, { threadId: 'merged', aliasOf: 'story-a' })
        : url.endsWith('stories/story-a.json') ? res(200, story) : res(500));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchStoryView('gone')).toBeNull();
    expect(await fetchStoryView('merged')).toEqual(story);
    expect(fetchMock).toHaveBeenCalledWith('/data/record/views/stories/story-a.json', expect.anything());
    await expect(fetchCounts('2026-10-21')).rejects.toThrow(/500/);
    expect(await fetchStoryView('../bad')).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});
