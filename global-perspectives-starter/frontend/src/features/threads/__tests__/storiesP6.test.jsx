// P6 (2026-10-01): Stories rows carry a one-line summary and a "Watching" line only when the data has
// them; the right rail / phone READ hide "Changed since your last visit" until a baseline exists;
// header counts put scored tiers first with a dim "N not yet scored"; phone tabs are READ / MAP / TIMELINE.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import archiveFixture from '@fixtures/archive.json';
import threadAnalysesFixture from '@fixtures/thread_analyses.json';

const rawDayMap = archiveFixture.data;
const rawDates = Object.keys(rawDayMap).sort();
const dayMap = {};
{
  const today = new Date();
  rawDates.forEach((d, i) => {
    const shifted = new Date(today);
    shifted.setDate(today.getDate() - (rawDates.length - 1 - i));
    const stamp = new Date(shifted); stamp.setHours(shifted.getHours() - 1);
    dayMap[shifted.toISOString().slice(0, 10)] = { ...rawDayMap[d], updatedAt: stamp.toISOString() };
  });
}
const sortedDates = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));

const phone = { on: false };
vi.mock('@/shared/hooks/useIsPhone', () => ({ useIsPhone: () => phone.on }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap, sortedDates, loading: false, error: null, dataUpdatedAt: Date.now(), refetch: vi.fn() }),
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({
  useThreadAnalyses: () => ({ analyses: threadAnalysesFixture.data, loading: false, error: null }),
}));
vi.mock('@/shared/contexts/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));
vi.mock('@/features/countries/components/CountryOverviewMap', () => ({ default: () => <div /> }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => <div data-testid="weekly-map" /> }));

import WeeklyPage from '@/features/threads/WeeklyPage';
import StoryLine from '@/features/threads/components/StoryLine.jsx';
import { storySummary, watchingOf } from '@/features/threads/lib/storyGroups';

const VISIT_KEY = 'gp_stories_visit_v1';
const renderAt = (path = '/weekly') => render(<MemoryRouter initialEntries={[path]}><WeeklyPage /></MemoryRouter>);

beforeEach(() => {
  phone.on = false;
  localStorage.removeItem(VISIT_KEY);
});

describe('storySummary / watchingOf (pure)', () => {
  const thread = { entries: [{ ai: { summary: 'Entry summary one. Second sentence.' } }] };
  it('summary: the analysis story arc first sentence, else the newest entry summary, else null', () => {
    expect(storySummary(thread, { storyArc: 'Arc line here. More.' })).toBe('Arc line here.');
    expect(storySummary(thread, null)).toBe('Entry summary one.');
    expect(storySummary({ entries: [{}] }, {})).toBeNull();
    expect(storySummary({ entries: [{ ai: { summary: '   ' } }] }, {})).toBeNull();
  });
  it('summary is clipped to 160 chars', () => {
    expect(storySummary({ entries: [] }, { storyArc: 'x'.repeat(300) }).length).toBeLessThanOrEqual(160);
  });
  it('watching: the first watch question, else null', () => {
    expect(watchingOf({ watchQuestions: ['Will X happen by June?', 'Y?'] })).toBe('Will X happen by June?');
    expect(watchingOf({ watchQuestions: [] })).toBeNull();
    expect(watchingOf({})).toBeNull();
    expect(watchingOf(null)).toBeNull();
  });
});

describe('StoryLine renders the summary / Watching lines only with data', () => {
  const base = { threadId: 't1', latestTitle: 'A story', entries: [{}], regions: [], articleCount: 2, dayCount: 1, category: 'politics', changedAt: null };
  const renderLine = (thread, analysis) => render(<MemoryRouter><ul><StoryLine thread={thread} analysis={analysis} now={Date.now()} /></ul></MemoryRouter>);

  it('no data -> neither line', () => {
    const { container } = renderLine(base, null);
    expect(container.querySelector('.gp-row__sum')).toBeNull();
    expect(container.querySelector('.gp-row__watch')).toBeNull();
  });
  it('with an analysis -> a dim summary line and "Watching: <question>"', () => {
    const { container } = renderLine(base, { storyArc: 'The arc in one line. Then more.', watchQuestions: ['Will the ceasefire hold?'] });
    expect(container.querySelector('.gp-row__sum').textContent).toBe('The arc in one line.');
    expect(container.querySelector('.gp-row__watch').textContent).toBe('Watching: Will the ceasefire hold?');
  });
  it('summary only (no watch question) -> no Watching line', () => {
    const { container } = renderLine(base, { storyArc: 'Only an arc.' });
    expect(container.querySelector('.gp-row__sum')).not.toBeNull();
    expect(container.querySelector('.gp-row__watch')).toBeNull();
  });
});

describe('/weekly list rows from the fixtures', () => {
  it('rows with an analysis show summary + Watching; rows without one show neither', () => {
    renderAt();
    const sums = document.querySelectorAll('.es-center .gp-row__sum');
    const watches = document.querySelectorAll('.es-center .gp-row__watch');
    expect(sums.length).toBeGreaterThan(0);
    expect(sums.length).toBeLessThanOrEqual(Object.keys(threadAnalysesFixture.data).length);
    expect(watches.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.es-center .gp-row').length).toBeGreaterThan(sums.length);
  });
});

describe('header counts: scored tiers first, then a dim "N not yet scored"', () => {
  it('lists the scored tiers, then the not-yet-scored count last; no "Not scored" tier word in the counts', () => {
    renderAt();
    const counts = screen.getByLabelText('Open stories by tier');
    const kids = [...counts.querySelectorAll('.sf-counts__t, .sf-counts__unscored')];
    expect(kids.length).toBeGreaterThan(0);
    const unscoredIdx = kids.findIndex((k) => k.classList.contains('sf-counts__unscored'));
    expect(unscoredIdx).toBe(kids.length - 1);
    expect(kids[unscoredIdx].textContent).toMatch(/^\d+ not yet scored$/);
    expect(counts.textContent).not.toMatch(/Not scored/);
  });
});

describe('Changed since your last visit needs a baseline', () => {
  const baseline = () => localStorage.setItem(VISIT_KEY, JSON.stringify({ prev: null, last: Date.now() - 5 * 3600 * 1000 }));

  it('desktop first visit: no section in the rail', () => {
    renderAt();
    expect(screen.queryByText('Changed since your last visit')).toBeNull();
  });
  it('desktop with a baseline: the rail section is there', () => {
    baseline();
    renderAt();
    expect(within(document.querySelector('.es-right')).getByText('Changed since your last visit')).toBeInTheDocument();
  });
  it('phone first visit: no changed section anywhere', () => {
    phone.on = true;
    renderAt();
    expect(screen.queryByText('Changed since your last visit')).toBeNull();
    expect(document.getElementById('sf-changed')).toBeNull();
  });
  it('phone with a baseline: the section is inside READ', () => {
    phone.on = true;
    baseline();
    renderAt();
    expect(document.getElementById('sf-changed')).not.toBeNull();
  });
});

describe('phone tabs: READ / MAP / TIMELINE (READ default)', () => {
  it('shows exactly the three tabs, READ selected, the list visible', () => {
    phone.on = true;
    renderAt();
    const tabs = screen.getAllByRole('tab').filter((t) => ['Read', 'Map', 'Timeline'].includes(t.textContent));
    expect(tabs.map((t) => t.textContent)).toEqual(['Read', 'Map', 'Timeline']);
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Changes' })).toBeNull();
    expect(document.querySelectorAll('.gp-row').length).toBeGreaterThan(0);
  });
  it('TIMELINE tab draws the timeline, MAP tab the map, READ goes back to the list', async () => {
    phone.on = true;
    renderAt();
    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(document.querySelectorAll('.tl-row').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Map' }));
    expect(await screen.findByTestId('weekly-map')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Read' }));
    expect(document.querySelectorAll('.gp-row').length).toBeGreaterThan(0);
  });
  it('?view=changes keeps working: READ selected (with a baseline it carries the section), no CHANGES tab', () => {
    phone.on = true;
    localStorage.setItem(VISIT_KEY, JSON.stringify({ prev: null, last: Date.now() - 5 * 3600 * 1000 }));
    renderAt('/weekly?view=changes');
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('sf-changed')).not.toBeNull();
  });
  it('?view=changes without a baseline is plain READ', () => {
    phone.on = true;
    renderAt('/weekly?view=changes');
    expect(screen.getByRole('tab', { name: 'Read' })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('sf-changed')).toBeNull();
    expect(document.querySelectorAll('.gp-row').length).toBeGreaterThan(0);
  });
});
