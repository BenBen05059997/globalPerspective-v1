// /weekly?view=map thread panel (the real WeeklyMap, archive and analyses faked at their hooks): a thread row
// is a real button that selects the thread, and the region filter select has an accessible name.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const day = (date) => ({
  entries: [
    { topicId: `a-${date}`, threadId: 'th-iran', title: 'Iran talks resume', category: 'politics', regions: ['Iran'], date, sources: [] },
    { topicId: `b-${date}`, threadId: 'th-ukr', title: 'Ukraine front shifts', category: 'conflict', regions: ['Ukraine'], date, sources: [] },
  ],
});
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => ({ dayMap: { '2026-10-17': day('2026-10-17'), '2026-10-18': day('2026-10-18') }, sortedDates: ['2026-10-18', '2026-10-17'], loading: false }),
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({ useThreadAnalyses: () => ({ analyses: {} }) }));
vi.mock('@/shared/hooks/useIsMobile', () => ({ default: () => false }));

import WeeklyMap from '@/features/threads/components/WeeklyMap';

const mount = () => render(<MemoryRouter><WeeklyMap /></MemoryRouter>);

describe('WeeklyMap thread panel', () => {
  it('each thread row is a button named by its title; activating it opens the thread', () => {
    mount();
    const row = screen.getByRole('button', { name: /Iran talks resume/ });
    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('type', 'button');
    expect(row).not.toHaveAttribute('tabindex');
    row.focus();
    expect(row).toHaveFocus();

    fireEvent.click(row);
    // the panel switched from the list to the thread detail (the list's rows are gone, Back is offered)
    expect(screen.queryByRole('button', { name: /Ukraine front shifts/ })).toBeNull();
    expect(screen.getAllByText('Iran talks resume').length).toBeGreaterThan(0);
  });

  it('the multi-day play control stays a separate button beside the row', () => {
    mount();
    const row = screen.getByRole('button', { name: /Iran talks resume/ });
    const play = within(row.parentElement).getByRole('button', { name: 'Play story evolution' });
    expect(row).not.toContainElement(play);
  });

  it('the region filter select is named, offers All regions, with a region option per thread region', () => {
    mount();
    const select = screen.getByRole('combobox', { name: 'Filter threads by region' });
    expect(within(select).getByRole('option', { name: 'All regions' })).toBeInTheDocument();
    expect(select.options.length).toBeGreaterThan(2);
  });
});
