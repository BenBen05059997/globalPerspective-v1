// The breaking feature: the nav bell (feed, unread count, read marker, links), the Today strip (only a
// fresh alert, one links to its resolver, several to the map) and the single-alert hook behind /breaking/:id.
// restProxy is faked at its edge (fetchAlerts / fetchAlert); the hooks, components and links are real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const fetchAlerts = vi.fn();
const fetchAlert = vi.fn();
vi.mock('@/shared/api/restProxy', () => ({
  fetchAlerts: (...a) => fetchAlerts(...a),
  fetchAlert: (...a) => fetchAlert(...a),
}));

import { BreakingStrip, NotificationBell, useBreakingAlert } from '@/features/breaking';
import { useNotifications } from '@/features/breaking/hooks/useNotifications';

const NOW = new Date('2026-11-02T12:00:00Z');
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const alertsFixture = [
  { id: 'al-3', title: 'Quake strikes coastal city', at: ago(5 * MIN) },
  { id: 'al-2', title: 'Ceasefire collapses', at: ago(3 * HOUR) },
  { id: 'al-1', title: 'Old story from last week', at: ago(8 * 24 * HOUR) },
];

const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
  window.USER_PREFS_ENDPOINT = 'https://prefs.test/';
  localStorage.clear();
  fetchAlerts.mockReset();
  fetchAlert.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.USER_PREFS_ENDPOINT;
});

describe('useNotifications', () => {
  it('loads the feed and counts alerts newer than the stored read marker', async () => {
    fetchAlerts.mockResolvedValue({ ok: true, alerts: alertsFixture });
    localStorage.setItem('gp_notif_read_at', ago(4 * HOUR));
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(result.current.alerts).toHaveLength(3);
    expect(result.current.unread).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('with no read marker every dated alert is unread; markAllRead stores a marker and clears the count', async () => {
    fetchAlerts.mockResolvedValue({ alerts: alertsFixture });
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(result.current.unread).toBe(3);
    act(() => result.current.markAllRead());
    expect(result.current.unread).toBe(0);
    expect(localStorage.getItem('gp_notif_read_at')).toBe(NOW.toISOString());
  });

  it('an alert without a timestamp is never counted unread', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [{ id: 'x', title: 'No date' }] });
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.unread).toBe(0);
  });

  it('polls again every 5 minutes and replaces the feed; unmount stops the poll', async () => {
    fetchAlerts.mockResolvedValueOnce({ alerts: [alertsFixture[0]] });
    const { result, unmount } = renderHook(() => useNotifications());
    await settle();
    expect(fetchAlerts).toHaveBeenCalledTimes(1);
    expect(result.current.alerts).toHaveLength(1);

    fetchAlerts.mockResolvedValueOnce({ alerts: alertsFixture });
    await act(async () => { vi.advanceTimersByTime(5 * MIN); });
    await settle();
    expect(fetchAlerts).toHaveBeenCalledTimes(2);
    expect(result.current.alerts).toHaveLength(3);

    unmount();
    await act(async () => { vi.advanceTimersByTime(10 * MIN); });
    expect(fetchAlerts).toHaveBeenCalledTimes(2);
  });

  it('a failed fetch leaves an empty feed, no unread badge and no throw (the nav shows no error UI)', async () => {
    fetchAlerts.mockRejectedValue(new Error('Alerts HTTP 500'));
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(result.current.alerts).toEqual([]);
    expect(result.current.unread).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('a failed poll keeps the last good feed', async () => {
    fetchAlerts.mockResolvedValueOnce({ alerts: alertsFixture });
    const { result } = renderHook(() => useNotifications());
    await settle();
    fetchAlerts.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { vi.advanceTimersByTime(5 * MIN); });
    await settle();
    expect(result.current.alerts).toHaveLength(3);
  });

  it('a reply without an alerts array is ignored', async () => {
    fetchAlerts.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(result.current.alerts).toEqual([]);
  });

  it('without USER_PREFS_ENDPOINT it never fetches and reports endpointMissing', async () => {
    delete window.USER_PREFS_ENDPOINT;
    const { result } = renderHook(() => useNotifications());
    await settle();
    expect(fetchAlerts).not.toHaveBeenCalled();
    expect(result.current.endpointMissing).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});

describe('NotificationBell', () => {
  it('renders nothing when the endpoint is not configured', () => {
    delete window.USER_PREFS_ENDPOINT;
    const { container } = mount(<NotificationBell />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the unread count on the button and caps the badge at 9+', async () => {
    fetchAlerts.mockResolvedValue({ alerts: alertsFixture });
    mount(<NotificationBell />);
    await settle();
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(screen.getByText('3')).toHaveClass('gp-bell-badge');
  });

  it('caps a large unread count at 9+', async () => {
    fetchAlerts.mockResolvedValue({
      alerts: Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, title: `Alert ${i}`, at: ago(i * MIN) })),
    });
    mount(<NotificationBell />);
    await settle();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opening lists every alert as a /breaking/:id link with its age, then marks all read', async () => {
    fetchAlerts.mockResolvedValue({ alerts: alertsFixture });
    mount(<NotificationBell />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

    const quake = screen.getByRole('menuitem', { name: /Quake strikes coastal city/ });
    expect(quake).toHaveAttribute('href', '/breaking/al-3');
    expect(quake).toHaveTextContent('5m ago');
    expect(screen.getByRole('menuitem', { name: /Ceasefire collapses/ })).toHaveTextContent('3h ago');
    // a week or older falls back to a calendar date
    expect(screen.getByRole('menuitem', { name: /Old story/ })).toHaveTextContent(/Oct 25/);
    expect(screen.getByRole('menuitem', { name: /See the alerts on the map/ })).toHaveAttribute('href', '/');

    // opening cleared the badge
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(localStorage.getItem('gp_notif_read_at')).toBe(NOW.toISOString());
  });

  it('an alert keyed only by a legacy threadId still links through the resolver', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [{ threadId: 'legacy-9', title: 'Legacy row', at: ago(MIN) }] });
    mount(<NotificationBell />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(screen.getByRole('menuitem', { name: /Legacy row/ })).toHaveAttribute('href', '/breaking/legacy-9');
  });

  it('an empty feed shows the caught-up message and no map link, never a badge', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [] });
    mount(<NotificationBell />);
    await settle();
    expect(screen.queryByText(/^\d/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('a failed fetch looks like an empty feed with no error text', async () => {
    fetchAlerts.mockRejectedValue(new Error('Alerts HTTP 500'));
    mount(<NotificationBell />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/something went wrong|HTTP 500/i);
  });

  it('Escape and a click outside close the panel; clicking an alert closes it too', async () => {
    fetchAlerts.mockResolvedValue({ alerts: alertsFixture });
    mount(<NotificationBell />);
    await settle();
    const button = screen.getByRole('button', { name: /Notifications/ });

    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Quake/ }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('BreakingStrip', () => {
  it('renders nothing with no alerts', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [] });
    const { container } = mount(<BreakingStrip />);
    await settle();
    expect(container.querySelector('.bk-strip')).toBeNull();
  });

  it('renders nothing when every alert is older than 24 hours (never a stale banner)', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [alertsFixture[2], { id: 'edge', title: 'Just over a day', at: ago(24 * HOUR + MIN) }] });
    const { container } = mount(<BreakingStrip />);
    await settle();
    expect(container.querySelector('.bk-strip')).toBeNull();
  });

  it('ignores alerts without a time and alerts dated in the future', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [{ id: 'n', title: 'No time' }, { id: 'f', title: 'Future', at: ago(-HOUR) }] });
    const { container } = mount(<BreakingStrip />);
    await settle();
    expect(container.querySelector('.bk-strip')).toBeNull();
  });

  it('one fresh alert: shows its title and links to its /breaking/:id resolver', async () => {
    fetchAlerts.mockResolvedValue({ alerts: [alertsFixture[0], alertsFixture[2]] });
    mount(<BreakingStrip />);
    await settle();
    const link = screen.getByRole('link', { name: 'Breaking: Quake strikes coastal city' });
    expect(link).toHaveAttribute('href', '/breaking/al-3');
    expect(link).toHaveTextContent('BREAKING');
    expect(link).toHaveTextContent('Quake strikes coastal city');
    expect(link).not.toHaveTextContent('more today');
  });

  it('several fresh alerts: leads with the newest, says how many more, and links to the map', async () => {
    fetchAlerts.mockResolvedValue({ alerts: alertsFixture });
    mount(<BreakingStrip />);
    await settle();
    const link = screen.getByRole('link', { name: 'Breaking: Quake strikes coastal city — and 1 more today' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('+1 more today');
  });

  it('a fetch failure renders nothing', async () => {
    fetchAlerts.mockRejectedValue(new Error('down'));
    const { container } = mount(<BreakingStrip />);
    await settle();
    expect(container.querySelector('.bk-strip')).toBeNull();
  });
});

describe('useBreakingAlert', () => {
  // waitFor polls on real timers; this hook has no timers of its own.
  beforeEach(() => { vi.useRealTimers(); });

  it('resolves the alert for an id', async () => {
    fetchAlert.mockResolvedValue({ ok: true, alert: { id: 'al-3', title: 'Quake' } });
    const { result } = renderHook(() => useBreakingAlert('al-3'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAlert).toHaveBeenCalledWith('al-3');
    expect(result.current.alert).toEqual({ id: 'al-3', title: 'Quake' });
  });

  it('stays null when the id is not a confirmed alert, when the fetch fails, and when there is no id', async () => {
    fetchAlert.mockResolvedValueOnce({ ok: true, alert: null });
    const a = renderHook(() => useBreakingAlert('nope'));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    expect(a.result.current.alert).toBeNull();

    fetchAlert.mockRejectedValueOnce(new Error('Alert HTTP 500'));
    const b = renderHook(() => useBreakingAlert('boom'));
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    expect(b.result.current.alert).toBeNull();

    fetchAlert.mockClear();
    const c = renderHook(() => useBreakingAlert(undefined));
    await waitFor(() => expect(c.result.current.loading).toBe(false));
    expect(fetchAlert).not.toHaveBeenCalled();
  });

  it('without the endpoint it skips the fetch and reports endpointMissing', async () => {
    delete window.USER_PREFS_ENDPOINT;
    const { result } = renderHook(() => useBreakingAlert('al-3'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAlert).not.toHaveBeenCalled();
    expect(result.current.endpointMissing).toBe(true);
    expect(result.current.alert).toBeNull();
  });

  it('a reply for a previous id does not overwrite the current one', async () => {
    let resolveFirst;
    fetchAlert.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    fetchAlert.mockResolvedValueOnce({ alert: { id: 'b', title: 'B' } });
    const { result, rerender } = renderHook(({ id }) => useBreakingAlert(id), { initialProps: { id: 'a' } });
    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.alert).toEqual({ id: 'b', title: 'B' }));
    await act(async () => { resolveFirst({ alert: { id: 'a', title: 'A' } }); });
    expect(result.current.alert).toEqual({ id: 'b', title: 'B' });
  });
});
