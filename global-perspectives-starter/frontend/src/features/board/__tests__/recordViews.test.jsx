import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
const res = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

describe('story tree on the 0037 story view', () => {
  it('missing tree renders nothing', () => {
    const { container } = render(<StoryTree />);
    expect(container.textContent).toBe('');
  });
  it('unread story: no line or chapters tab, no placeholder; entries, verdicts and sources are facts', () => {
    render(<StoryTree story={story} />);
    expect(screen.queryByRole('button', { name: 'line' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'chapters' })).toBeNull();
    expect(screen.getByRole('button', { name: 'event' })).toBeDisabled();
    expect(screen.getByText('choose an event on the trunk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tankers reroute around the strait' })).toBeInTheDocument();
    expect(screen.getAllByText((_, el) => el.tagName === 'SUMMARY' && /^\d{1,2} [A-Z][a-z]{2} · \d+ branches$/.test(el.textContent)).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d/);
    expect(screen.getByText('Premiums rise again · 65% · happened · 20 Oct')).toBeInTheDocument();
    expect(screen.getByText(/“Second insurer raises premiums”/)).toBeInTheDocument();
    expect(screen.getByText('Shipping resumes the old route · 20% · open · due 30 Nov')).toBeInTheDocument();
    expect(screen.getByText('Talks restart · 10% · not reported by 12 Oct')).toBeInTheDocument();
    expect(screen.getByText('Sanctions eased · 5% · could not be checked · the source was unavailable')).toBeInTheDocument();
    expect(screen.getByText('Old question · recorded before scoring began')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/not checked yet|has not been checked|did not happen|failed|no reading yet|Status history/);
    fireEvent.click(screen.getByRole('button', { name: 'Insurers raise war-risk premiums' }));
    expect(screen.getByRole('button', { name: 'event' })).not.toBeDisabled();
    expect(screen.getByRole('link', { name: 'BBC' })).toHaveAttribute('href', 'https://example.org/b');
    expect(screen.queryByText(/Branches killed/)).toBeNull();
  });
  it('a branch row shows label, p, status and its trigger on a second line', () => {
    const { container } = render(<StoryTree story={{ ...story, forks: [{ forkId: 'f', drawnAt: '2026-09-30T12:26:28.689Z', branches: [{ branchId: 'x', text: 'Most Likely', p: 25, trigger: 'Insurers announce a surcharge', due: '2026-11-30' }] }] }} />);
    expect(screen.getByText((_, el) => el.tagName === 'SUMMARY' && el.textContent === '30 Sep · 1 branches')).toBeInTheDocument();
    expect(screen.getByText('Most Likely · 25% · open · due 30 Nov')).toBeInTheDocument();
    expect(container.querySelector('summary .board-branch__text').textContent).toBe('Insurers announce a surcharge');
  });
  it('a recovered row is labelled in the trunk and its detail shows outlet and link, no empty summary', () => {
    render(<StoryTree story={story} />);
    expect(screen.getAllByText(/recovered from public records/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Strait traffic thins as insurers react' }));
    expect(screen.getByText(/recovered from public records · A headline recovered/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Example Wire' })).toHaveAttribute('href', 'https://example.org/c');
    expect(document.querySelectorAll('.board-line').length).toBe(2);
  });
  it('no entries and no forks give one line, not two empty sections', () => {
    render(<StoryTree story={{ ...story, entries: [], forks: [] }} />);
    expect(screen.getByText('No dated event or forecast branch has been recorded for this story.')).toBeInTheDocument();
    expect(screen.queryByText('Trunk')).toBeNull();
    expect(screen.queryByText('Forks')).toBeNull();
  });
  it('a read story shows its line, chapters (from – to · title, summary) and no branch status words from the reading', () => {
    render(<StoryTree story={storyB} />);
    expect(screen.getByText(/Shipping adapts around the strait/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'chapters' }));
    expect(screen.getByText(/Operators reroute/)).toBeInTheDocument();
    expect(screen.getByText('Tanker operators change course as premiums climb.')).toBeInTheDocument();
    expect(document.querySelectorAll('li time')).toHaveLength(2);
    expect(screen.queryByText(/Status history/)).toBeNull();
  });
});

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
