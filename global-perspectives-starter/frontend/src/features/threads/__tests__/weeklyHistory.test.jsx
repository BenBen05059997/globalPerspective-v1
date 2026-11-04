// /weekly history: a view change pushes an entry (Back/Forward step between views, the page follows the URL);
// filters, sort and search replace the entry (no history per click or keystroke).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

const NOW = Date.now();
const today = new Date(NOW).toISOString().slice(0, 10);
const e = (threadId, title, category) => ({ threadId, title, category, regions: ['Iran'], sources: [{ source: 'a.com' }] });

vi.mock('@/shared/hooks/useIsPhone', () => ({ useIsPhone: () => false }));
vi.mock('@/features/threads/hooks/useWeeklyArchive', () => ({
  useWeeklyArchive: () => {
    const dayMap = { [today]: { updatedAt: new Date(NOW - 3600000).toISOString(), entries: [e('t1', 'War story', 'conflict'), e('t1', 'War story 2', 'conflict')] } };
    return { dayMap, sortedDates: [today], loading: false, error: null, dataUpdatedAt: NOW, refetch: () => {} };
  },
}));
vi.mock('@/features/threads/hooks/useThreadAnalyses', () => ({ useThreadAnalyses: () => ({ analyses: {}, loading: false, failed: false }) }));
vi.mock('@/shared/ui/boot/BootLoader.jsx', () => ({ default: () => <div data-testid="loader" /> }));
vi.mock('@/features/threads/components/WeeklyMap', () => ({ default: () => <div data-testid="weekly-map" /> }));

import WeeklyPage from '@/features/threads/WeeklyPage';

let nav;
function Probe() {
  const loc = useLocation();
  nav = useNavigate();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}
const loc = () => screen.getByTestId('loc').textContent;
const renderAt = (path = '/weekly') => render(<MemoryRouter initialEntries={[path]}><Probe /><WeeklyPage /></MemoryRouter>);
const view = (name) => fireEvent.click(screen.getByRole('radio', { name }));

beforeEach(() => localStorage.clear());

describe('/weekly history', () => {
  it('Back puts the URL search text back in the box', () => {
    renderAt('/weekly?q=war');
    act(() => nav('/weekly?q=vote'));
    act(() => nav(-1));
    expect(screen.getAllByLabelText('Search stories')[0].value).toBe('war');
  });

  it('a view change pushes an entry; Back and Forward follow it', () => {
    renderAt();
    view(/board/i);
    expect(loc()).toBe('/weekly?view=board');
    view(/timeline/i);
    expect(loc()).toBe('/weekly?view=timeline');
    act(() => nav(-1));
    expect(loc()).toBe('/weekly?view=board');
    expect(screen.getByRole('radio', { name: /board/i }).getAttribute('aria-checked')).toBe('true');
    act(() => nav(-1));
    expect(loc()).toBe('/weekly');
    act(() => nav(1));
    expect(loc()).toBe('/weekly?view=board');
  });

  it('filters, sort and search replace the entry: one Back leaves them', () => {
    renderAt();
    view(/board/i);
    fireEvent.click(screen.getByLabelText('7 d'));
    fireEvent.click(screen.getByLabelText('Most recent'));
    const search = screen.getAllByLabelText('Search stories')[0];
    fireEvent.change(search, { target: { value: 'w' } });
    fireEvent.change(search, { target: { value: 'wa' } });
    expect(loc()).toBe('/weekly?view=board&window=7d&sort=recent&q=wa');
    act(() => nav(-1));
    expect(loc()).toBe('/weekly');
  });

  it('defaults are left out of the URL and the controls follow it', () => {
    renderAt('/weekly?window=7d&q=war');
    expect(screen.getAllByLabelText('Search stories')[0].value).toBe('war');
    fireEvent.click(screen.getByLabelText('30 d'));
    expect(loc()).toBe('/weekly?q=war');
  });
});
