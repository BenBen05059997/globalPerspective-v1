// P7a (2026-10-02): the BOARD view (?view=board). (Header copied from storiesP6.) P6: Stories rows carry a one-line summary and a "Watching" line only when the data has
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
import { BOARD_RULE } from '@/features/threads/lib/storyGroups';

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><WeeklyPage /></MemoryRouter>);
beforeEach(() => { phone.on = false; localStorage.removeItem('gp_stories_visit_v1'); });

describe('Stories BOARD (?view=board)', () => {
  it('desktop: four status columns, the rule is printed, every card is a story link, view order List | Board | Timeline | Map | Web', () => {
    renderAt('/weekly?view=board');
    const cols = document.querySelectorAll('.sb-col');
    expect(cols).toHaveLength(4);
    expect([...cols].map((c) => c.querySelector('.sb-col__label').textContent)).toEqual(['Rising coverage', 'New', 'Steady', 'Quieter']);
    expect(screen.getByTestId('board-rule').textContent).toBe(BOARD_RULE);
    const cards = document.querySelectorAll('.sb-card');
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) expect(c.querySelector('a.sb-card__link').getAttribute('href')).toMatch(/^\/weekly\/thread\//);
    const seg = [...document.querySelectorAll('.sf-seg__btn')].map((b) => b.textContent);
    expect(seg).toEqual(['List', 'Board', 'Timeline', 'Map', 'Web']);
    expect(document.querySelector('.sf-seg__btn[aria-pressed="true"]').textContent).toBe('Board');
  });
  it('the board never says "escalating" (it measures coverage)', () => {
    renderAt('/weekly?view=board');
    expect(document.body.textContent.toLowerCase()).not.toContain('escalating');
  });
  it('sparkline bars are real per-day counts: 14 bars and an aria label with the counts', () => {
    renderAt('/weekly?view=board');
    const spark = document.querySelector('.sb-card .sb-spark');
    expect(spark.querySelectorAll('.sb-spark__bar')).toHaveLength(14);
    expect(spark.getAttribute('aria-label')).toMatch(/Articles per day, last 14 days/);
  });
  it('phone: tabs stay READ / MAP / TIMELINE, READ carries a List | Board toggle that reaches the board', () => {
    phone.on = true;
    renderAt('/weekly');
    expect([...document.querySelectorAll('.sf-tabs [role=tab]')].map((t) => t.textContent)).toEqual(['Read', 'Map', 'Timeline']);
    expect(document.querySelectorAll('.sb-card')).toHaveLength(0);
    fireEvent.click(within(document.querySelector('.sf-subtoggle')).getByText('Board'));
    expect(document.querySelectorAll('.sb-col')).toHaveLength(4);
    expect(document.querySelector('.sf-tabs [aria-selected="true"]').textContent).toBe('Read');
  });
});

describe('board card age wording (monitor, 2026-10-02)', () => {
  it('never renders "just now ago"', () => {
    render(<MemoryRouter initialEntries={['/weekly?view=board']}><WeeklyPage /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/just now ago/);
  });
});
