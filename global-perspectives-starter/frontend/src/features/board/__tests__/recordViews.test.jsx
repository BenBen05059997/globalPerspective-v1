import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import RecordPinDetails from '../components/RecordPinDetails.jsx';
import StoryTree from '../components/StoryTree.jsx';
import BoardWeekly from '../components/BoardWeekly.jsx';
import UnsettledZone from '../components/UnsettledZone.jsx';
import story from '../dev/recordViews/story-a.json';
import storyB from '../dev/recordViews/story-b.json';
import counts from '../dev/recordViews/counts.json';
import { boardWeek, sumCounts, isoWeekOf } from '../lib/recordProjection.js';
import { fetchStoryView, fetchCounts, isoWeekStart, datesBetween } from '../lib/recordViews.js';
import { countDates } from '../hooks/useWeekCounts.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const NO_READING = 'no reading yet · first weekly review pending';
const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

describe('story tree on the 0037 story view', () => {
  it('missing tree renders only its documented empty line', () => {
    const { container } = render(<StoryTree />);
    expect(container.textContent).toBe('Branch status starts when the story record goes live.');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('line and chapters say no reading yet; entries, verdicts and sources are facts', () => {
    render(<StoryTree story={story} />);
    expect(screen.getByText(NO_READING)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'chapters' }));
    expect(screen.getByText(NO_READING)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'forks and events' }));
    expect(screen.getByRole('button', { name: 'Tankers reroute around the strait' })).toBeInTheDocument();
    expect(screen.getByText('Premiums rise again · 65% · happened · 20 Oct')).toBeInTheDocument();
    expect(screen.getByText(/“Second insurer raises premiums”/)).toBeInTheDocument();
    expect(screen.getByText('Shipping resumes the old route · 20% · open · due 30 Nov')).toBeInTheDocument();
    expect(screen.getByText('Talks restart · 10% · not reported by 12 Oct')).toBeInTheDocument();
    expect(screen.getByText('Sanctions eased · 5% · could not be checked · the source was unavailable')).toBeInTheDocument();
    expect(screen.getByText('Old question · recorded before scoring began')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/not checked yet|has not been checked|did not happen|failed/);
    expect(screen.getAllByText(`Status history: ${NO_READING}`)).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Insurers raise war-risk premiums' }));
    expect(screen.getByRole('link', { name: 'BBC' })).toHaveAttribute('href', 'https://example.org/b');
    expect(screen.queryByText(/Branches killed/)).toBeNull();
  });
  it('no entries and no forks use their documented texts', () => {
    render(<StoryTree story={{ ...story, entries: [], forks: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'forks and events' }));
    expect(screen.getByText('No dated event has been recorded for this story.')).toBeInTheDocument();
    expect(screen.getByText('No forecast branch has been recorded for this story.')).toBeInTheDocument();
  });
  it('a read story shows its line, chapters (from – to · title, summary) and branch status words', () => {
    render(<StoryTree story={storyB} />);
    expect(screen.getByText(/Shipping adapts around the strait/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'chapters' }));
    expect(screen.getByText(/Operators reroute/)).toBeInTheDocument();
    expect(screen.getByText('Tanker operators change course as premiums climb.')).toBeInTheDocument();
    expect(document.querySelectorAll('li time')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'forks and events' }));
    expect(screen.getByText(/holding · No insurer has moved/)).toBeInTheDocument();
    expect(screen.getByText(/late · No convoy announced/)).toBeInTheDocument();
    expect(screen.queryByText(/Status history/)).toBeNull();
  });
  it('verdict wording wins over a branch status word; unread stories show the status-history line', () => {
    const withStatus = { ...story, reading: { state: 'read', week: '2026-W43' }, branchStatus: { 'f1-0': { status: 'fired', why: 'x', week: '2026-W43' }, 'f1-1': { status: 'holding', why: 'waiting', week: '2026-W43' } } };
    render(<StoryTree story={withStatus} />);
    fireEvent.click(screen.getByRole('button', { name: 'forks and events' }));
    expect(screen.queryByText(/fired/)).toBeNull();
    expect(screen.getByText(/holding · waiting/)).toBeInTheDocument();
    expect(screen.queryByText(/Status history/)).toBeNull();
  });
});

describe('weekly', () => {
  it('absent records never invent changes or counts', () => {
    render(<BoardWeekly board={{ pins: [], strings: [], recordAvailable: false }} stories={{}} />);
    expect(screen.getByText('Pin changes start when the story record goes live.')).toBeInTheDocument();
    expect(screen.getByText('Branch status starts when the story record goes live.')).toBeInTheDocument();
    expect(screen.getByText('No confirmed link has been recorded this week.')).toBeInTheDocument();
  });
  it('uses dated changes within its seven-day window only; verdicts need a verdict date', () => {
    const board = { pins: [{ pinId: 'p1', lastMoved: '2026-10-19' }], strings: [{ a: 'p1', b: 'p2', keptAt: '2026-10-19', cutAt: '2026-09-01' }] };
    const week = boardWeek(board, { a: story }, {}, new Date('2026-10-21T12:00:00Z'));
    expect(week.moved).toHaveLength(1); expect(week.strings).toHaveLength(1);
    expect(week.branches).toEqual([{ branchId: 'f1-0', text: 'Premiums rise again', threadId: 'story-a', date: '2026-10-20', result: 'yes', status: 'happened · 20 Oct' }]);
    expect(boardWeek(board, { a: story }, {}, new Date('2026-11-30T12:00:00Z')).branches).toHaveLength(0);
  });
  it('renders recorded verdicts and confirmed links', () => {
    render(<BoardWeekly board={{ recordAvailable: true, pins: [{ pinId: 'p1', lastMoved: '2026-10-21' }], strings: [] }} stories={{ a: story }}
      links={{ 'story-a': { confirmedLinks: [{ otherThreadId: 'b', direction: 'drives', mechanism: 'Recorded transmission', week: '2026-W43', cites: [] }] } }} now={new Date('2026-10-21T12:00:00Z')} />);
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
  it('render nothing without a record, and say no reading yet for null readings while keeping zero counts', () => {
    const { container, rerender } = render(<RecordPinDetails pin={{ counts: { chapters: 0 } }} />);
    expect(container.textContent).toBe('');
    rerender(<RecordPinDetails pin={{ recordAvailable: true, line: null, counts: { chapters: null, liveBranches: 0, confirmedLinks: null } }} />);
    expect(screen.getByText(NO_READING)).toBeInTheDocument();
    expect(container.textContent).toContain(`chapters: ${NO_READING} · 0 live branches · confirmed links: ${NO_READING}`);
  });
});

describe('unsettled zone', () => {
  const week = ['2026-10-19', '2026-10-20', '2026-10-21'];
  const zone = (byDate, extra = {}) => render(<UnsettledZone ids={['story-a']} counts={{ byDate, loading: false, error: false, week, since: null, visit: null, ...extra }} />);
  it('sums the week for the pinned stories only, with the exact label', () => {
    zone({ '2026-10-20': { byStory: { 'story-a': { newEntries: 2, branchesDue: 1, verdicts: 1 }, other: { newEntries: 9, branchesDue: 9, verdicts: 9 } } }, '2026-10-21': counts });
    expect(screen.getByText('this week, unsettled: 3 new entries, 1 branches due, 1 verdicts')).toBeInTheDocument();
  });
  it('all zero says nothing new; no files at all says not generated yet; failures say so', () => {
    zone({ '2026-10-21': { byStory: {} } });
    expect(screen.getByText('Nothing new this week.')).toBeInTheDocument();
    cleanup(); zone({ '2026-10-21': null });
    expect(screen.getByText('This week’s counts are not generated yet.')).toBeInTheDocument();
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
