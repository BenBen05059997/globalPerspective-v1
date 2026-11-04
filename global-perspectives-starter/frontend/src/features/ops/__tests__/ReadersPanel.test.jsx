import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { devHealth, devOpsData } from '@/features/ops/dev/fixtures.js';
import { familyBars, recent, count } from '@/features/ops/lib/readers.js';

let opsReply;
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'op1', isAnonymous: false }, loading: false }) }));
vi.mock('@/shared/api/restProxy', () => ({ fetchOps: () => opsReply() }));
vi.mock('@/shared/api/recordViews', () => ({ fetchRecordView: () => Promise.resolve(devHealth()) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import OpsPage from '@/features/ops/OpsPage.jsx';
import { resetOpsAccess } from '@/features/ops/hooks/useOpsAccess.js';

const renderPage = () => render(<MemoryRouter><OpsPage /></MemoryRouter>);
const panel = () => screen.findByRole('region', { name: 'Readers' });

beforeEach(() => { opsReply = () => Promise.resolve({ status: 200, data: devOpsData() }); resetOpsAccess(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('OpsPage readers panel', () => {
  it('connected: totals, 14-day bars per family, top stories with titles, countries, referrers, own counts, attention table', async () => {
    renderPage();
    const readers = await panel();
    const stat = (label) => within(readers).getByText(label).closest('.ops-stat').querySelector('.ops-stat__value').textContent;
    expect(stat('Page views, 14 days')).toBe('1,122');
    expect(stat('Views of /ops, left out')).toBe('61');
    const bars = within(readers).getByRole('region', { name: 'Views per page family' });
    expect(within(bars).getAllByRole('img').length).toBe(7); // map, stories, countries, briefings, track record, board, other (ops is apart)
    expect(within(bars).getByRole('img', { name: /^Map, 14 days: 22, 31/ })).toBeTruthy();
    expect(bars.querySelectorAll('tbody tr:first-child .ops-spark__day').length).toBe(14);
    const stories = within(readers).getByRole('table', { name: /Top stories/ });
    expect(within(stories).getByText("Delhi Air Quality Worsens to 'Very Poor' Ahead of Diwali")).toBeTruthy();
    expect(within(stories).getByText('thread-untitled-0001')).toBeTruthy(); // no title: the id, not a made-up one
    expect(within(readers).getByRole('table', { name: /Top country pages/ })).toBeTruthy();
    expect(within(within(readers).getByRole('table', { name: /Top referrers/ })).getByText('news.ycombinator.com')).toBeTruthy();
    const own = within(readers).getByLabelText('Our own data');
    expect(within(own).getByText('Accounts').closest('.ops-stat').querySelector('.ops-stat__value').textContent).toBe('13');
    expect(within(own).getByText(/thread 14 · country 5 · daily 2/)).toBeTruthy();
    const att = within(readers).getByRole('table', { name: /Attention vs effort/ });
    expect(within(att).getByText('newsCountryIntelligence $0.18')).toBeTruthy();
    expect(within(att).getByText('no data')).toBeTruthy(); // Board: no spend data
    expect(within(readers).getByText(/no way to exclude it in this source/)).toBeTruthy();
    expect(within(readers).queryByText(/Not connected/)).toBeNull();
  });

  it('not connected: the steps, no invented numbers, our own counts and spend still shown', async () => {
    opsReply = () => Promise.resolve({ status: 200, data: devOpsData('not_connected') });
    renderPage();
    const readers = await panel();
    expect(within(readers).getByText('Not connected.')).toBeTruthy();
    expect(within(readers).getByText(/Account Analytics, Read/)).toBeTruthy();
    expect(within(readers).queryByRole('table', { name: /Top stories/ })).toBeNull();
    expect(within(readers).queryByText('Page views, 14 days')).toBeNull();
    expect(within(readers).getByLabelText('Our own data')).toBeTruthy();
    const att = within(readers).getByRole('table', { name: /Attention vs effort/ });
    expect(within(att).getAllByText('not connected').length).toBe(6);
  });

  it('Cloudflare error: named, with the error text', async () => {
    opsReply = () => Promise.resolve({ status: 200, data: devOpsData('error') });
    renderPage();
    expect(await screen.findByText('Cloudflare could not be read on the last run: Cloudflare GraphQL HTTP 403')).toBeTruthy();
  });

  it('own tables failed: named; an ops file written before the readers section existed: one line', async () => {
    const ops = devOpsData();
    ops.readers.own = { status: 'error', error: 'AccessDenied' };
    opsReply = () => Promise.resolve({ status: 200, data: ops });
    const { unmount } = renderPage();
    expect(await screen.findByText('Our own tables could not be counted on the last run: AccessDenied')).toBeTruthy();
    unmount();
    const old = devOpsData();
    delete old.readers;
    opsReply = () => Promise.resolve({ status: 200, data: old });
    renderPage();
    expect(await screen.findByText('The readers section has not been written yet.')).toBeTruthy();
  });
});

describe('readers lib', () => {
  it('family bars leave ops out and sort by views; recent sums a count series; count formats', () => {
    const cf = devOpsData().readers.cloudflare;
    const bars = familyBars(cf);
    expect(bars.map((b) => b.id)).not.toContain('ops');
    expect(bars[0].id).toBe('map');
    expect(bars[0].days.length).toBe(14);
    expect(recent({ days: [{ count: 1 }, { count: 2 }] })).toBe(3);
    expect(recent(undefined)).toBeNull();
    expect(count(1234)).toBe('1,234');
    expect(count(null)).toBeNull();
  });
});
