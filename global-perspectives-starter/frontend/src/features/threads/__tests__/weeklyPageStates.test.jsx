// /weekly states: no sign-in wait (S5), header and strip follow the filters (S10), ?category= handling and the
// empty state's way back (S13), honest failure states (S16).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const NOW = Date.now();
const today = new Date(NOW).toISOString().slice(0, 10);
const old = new Date(NOW - 10 * 86400000).toISOString().slice(0, 10);
const e = (threadId, title, category, extra = {}) => ({ threadId, title, category, regions: ['Iran'], sources: [{ source: 'a.com' }], ...extra });

const state = vi.hoisted(() => ({ archive: null, analysesFailed: false, refetch: vi.fn() }));
vi.mock('@/shared/hooks/useIsPhone', () => ({ useIsPhone: () => false }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({ useWeeklyArchive: () => state.archive }));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({ useThreadAnalyses: () => ({ analyses: {}, loading: false, failed: state.analysesFailed }) }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => <div data-testid="weekly-map" /> }));
// the page must not need an AuthProvider at all
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => { throw new Error('WeeklyPage must not read the sign-in state'); } }));

import WeeklyPage from '@/features/threads/WeeklyPage';

function archive(over = {}) {
  const dayMap = {
    [today]: { updatedAt: new Date(NOW - 3600000).toISOString(), entries: [e('t1', 'War story', 'conflict'), e('t1', 'War story 2', 'conflict'), e('t3', 'Army story', 'military'), e('t3', 'Army story 2', 'military')] },
    [old]: { updatedAt: new Date(NOW - 10 * 86400000).toISOString(), entries: [e('t2', 'Vote story', 'politics', { regions: ['Kenya'] }), e('t2', 'Vote story 2', 'politics', { regions: ['Kenya'] })] },
  };
  return { dayMap, sortedDates: Object.keys(dayMap).sort().reverse(), loading: false, error: null, dataUpdatedAt: NOW, refetch: state.refetch, ...over };
}
const renderAt = (path = '/weekly') => render(<MemoryRouter initialEntries={[path]}><WeeklyPage /></MemoryRouter>);
// the list only (the "gaining coverage" rail ignores filters)
const feedText = () => document.querySelector('.sf-feed')?.textContent || '';
const headerText = () => screen.getByLabelText('Open stories by tier').textContent;

beforeEach(() => {
  localStorage.clear(); state.archive = archive(); state.analysesFailed = false; state.refetch.mockReset();
});

describe('/weekly', () => {
  it('renders without any sign-in state', () => {
    renderAt();
    expect(screen.getAllByText(/War story/).length).toBeGreaterThan(0);
  });

  it('the header and strip count what the filters leave, and the wording follows the window', () => {
    renderAt();
    expect(headerText()).toMatch(/3\s*open stories.*last 30 days/);
    fireEvent.click(screen.getByLabelText('24 h'));
    expect(headerText()).toMatch(/2\s*open stories.*last 24 hours/);
    expect(document.querySelector('.ss-strip').textContent).toMatch(/2arcs/);
    expect(document.querySelector('.ss-strip').textContent).toMatch(/4articles/);
    expect(document.querySelector('.ss-strip').textContent).toMatch(/2days with stories/);
  });

  it('?category= is case-insensitive', () => {
    renderAt('/weekly?category=Politics');
    expect(screen.getAllByText(/Vote story/).length).toBeGreaterThan(0);
    expect(feedText()).not.toMatch(/War story/);
    expect(screen.getByLabelText('Clear topic filter politics')).toBeTruthy();
  });

  it('an unknown ?category= says so and offers the way back', () => {
    renderAt('/weekly?category=zzz');
    expect(screen.getByTestId('unknown-category').textContent).toMatch(/no topic called “zzz”/);
    expect(feedText()).not.toMatch(/War story/);
    fireEvent.click(screen.getByText('Show all stories'));
    expect(screen.getAllByText(/War story/).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('unknown-category')).toBeNull();
  });

  it('a search with no result offers Clear filters', () => {
    renderAt();
    fireEvent.change(screen.getAllByLabelText('Search stories')[0], { target: { value: 'nothing matches this' } });
    expect(screen.getByTestId('no-match').textContent).toMatch(/No stories match/);
    fireEvent.click(screen.getByText('Clear filters'));
    expect(screen.getAllByText(/War story/).length).toBeGreaterThan(0);
  });

  it('a failed archive load says it is unavailable, with a retry, and no pipeline claim or raw error', () => {
    state.archive = { dayMap: {}, sortedDates: [], loading: false, error: new Error('Proxy HTTP 500: {"raw":true}'), dataUpdatedAt: null, refetch: state.refetch };
    renderAt();
    expect(screen.getByRole('alert').textContent).toMatch(/Stories are unavailable right now/);
    expect(document.body.textContent).not.toMatch(/Proxy HTTP|accumulating/);
    fireEvent.click(screen.getByText('Try again'));
    expect(state.refetch).toHaveBeenCalled();
  });

  it('an archive that answered with no stories says that', () => {
    state.archive = { dayMap: {}, sortedDates: [], loading: false, error: null, dataUpdatedAt: null, refetch: state.refetch };
    renderAt();
    expect(document.body.textContent).toMatch(/no stories for the last 30 days/);
    expect(screen.queryByText('Try again')).toBeNull();
    expect(document.body.textContent).not.toMatch(/accumulating/);
  });

  it('when the scores could not be read, the header says so instead of "N not yet scored"', () => {
    state.analysesFailed = true;
    renderAt();
    expect(headerText()).toMatch(/scores unavailable/);
    expect(headerText()).not.toMatch(/not yet scored/);
  });

  it('scores read but none for a story: "not yet scored"', () => {
    renderAt();
    expect(headerText()).toMatch(/3 not yet scored/);
  });
});
