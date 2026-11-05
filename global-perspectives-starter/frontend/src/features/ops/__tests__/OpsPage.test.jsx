import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { devHealth, devOpsData } from '@/features/ops/dev/fixtures.js';

let user;
let opsReply;
let healthReply;
const fetchOps = vi.fn();
const fetchRecordView = vi.fn();
const reportFetchError = vi.fn();

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock('@/shared/api/restProxy', () => ({ fetchOps: (...a) => fetchOps(...a) }));
vi.mock('@/shared/api/recordViews', () => ({ fetchRecordView: (...a) => fetchRecordView(...a) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: (...a) => reportFetchError(...a) }));

import OpsPage from '@/features/ops/OpsPage.jsx';
import { resetOpsAccess } from '@/features/ops/hooks/useOpsAccess.js';

const renderPage = () => render(<MemoryRouter><OpsPage /></MemoryRouter>);
const operator = { uid: 'op1', isAnonymous: false, email: 'op@example.com' };

beforeEach(() => {
  user = operator;
  opsReply = () => Promise.resolve({ status: 200, data: devOpsData() });
  healthReply = () => Promise.resolve(devHealth());
  fetchOps.mockImplementation(() => opsReply());
  fetchRecordView.mockImplementation((path) => (path === 'health.json' ? healthReply() : Promise.reject(new Error(`unexpected ${path}`))));
  resetOpsAccess();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('OpsPage access', () => {
  it('signed out: one sign-in line and no request', async () => {
    user = null;
    renderPage();
    expect(await screen.findByText(/signed-in operator/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/signin?returnTo=%2Fops');
    expect(fetchOps).not.toHaveBeenCalled();
    expect(fetchRecordView).not.toHaveBeenCalled();
  });

  it('a guest account is treated as signed out', async () => {
    user = { uid: 'g', isAnonymous: true };
    renderPage();
    expect(await screen.findByText(/signed-in operator/)).toBeTruthy();
    expect(fetchOps).not.toHaveBeenCalled();
  });

  it('signed in but not the operator (403): one honest line, no panels, the health view is never fetched', async () => {
    opsReply = () => Promise.resolve({ status: 403, data: null });
    renderPage();
    expect(await screen.findByText('The ops page is not available for this account.')).toBeTruthy();
    expect(screen.queryByText('Money')).toBeNull();
    expect(screen.queryByText('Pipeline')).toBeNull();
    expect(fetchRecordView).not.toHaveBeenCalled();
  });

  it('a failed ops call says so and goes to the error sink', async () => {
    opsReply = () => Promise.reject(new Error('Proxy HTTP 502'));
    renderPage();
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(reportFetchError).toHaveBeenCalledWith('ops-money', expect.any(Error));
  });
});

describe('OpsPage money panel', () => {
  it('shows yesterday, month to date, the by-Lambda table, the unit costs and the 14 bars', async () => {
    renderPage();
    const money = await screen.findByRole('region', { name: 'Money' });
    const stat = (label) => within(money).getByText(label).closest('.ops-stat').querySelector('.ops-stat__value').textContent;
    expect(stat('DeepSeek 3 Nov, estimate')).toBe('$0.37');
    expect(stat('DeepSeek 2026-11 to date, estimate')).toBe('$3.19');
    expect(stat('AWS 3 Nov')).toBe('$0.37');
    expect(stat('AWS 2026-11 to date')).toBe('$1.45');
    expect(within(money).getByText(/from 1 Nov, 4 days of data/)).toBeTruthy();
    const table = within(money).getByRole('table', { name: /DeepSeek by Lambda/ });
    expect(within(table).getByText('newsSituationIngest')).toBeTruthy();
    expect(within(table).getAllByText('unpriced').length).toBeGreaterThan(0); // the jev model has no price
    expect(within(money).getByRole('table', { name: /Unit costs/ })).toBeTruthy();
    expect(within(money).getByText(/Weekly review spend: 2026-W45/)).toBeTruthy();
    expect(within(money).getByRole('figure', { name: /Daily cost, last 14 days/ }).querySelectorAll('.ops-bars__day').length).toBe(14);
    expect(within(money).getByText(/No price for jev-1.14.0/)).toBeTruthy();
  });

  it('a day with no data has an empty bar named in its title, not a zero', async () => {
    renderPage();
    const money = await screen.findByRole('region', { name: 'Money' });
    const first = money.querySelector('.ops-bars__day');
    expect(first.getAttribute('title')).toBe('22 Oct: DeepSeek no data (estimate), AWS $0.75');
  });

  it('names a source that failed on the last run', async () => {
    const ops = devOpsData();
    ops.deepseek.error = 'Logs Insights query still Running after 60 s';
    ops.aws.error = 'AccessDeniedException';
    opsReply = () => Promise.resolve({ status: 200, data: ops });
    renderPage();
    expect(await screen.findByText(/DeepSeek estimate was not updated on the last run: Logs Insights/)).toBeTruthy();
    expect(screen.getByText(/AWS cost was not updated on the last run: AccessDeniedException/)).toBeTruthy();
  });

  it('no file yet: one line, no numbers', async () => {
    opsReply = () => Promise.resolve({ status: 200, data: null });
    renderPage();
    expect(await screen.findByText('The money file has not been written yet.')).toBeTruthy();
  });
});

describe('OpsPage pipeline panel', () => {
  it('one row per stage with a cell for each of the 14 days', async () => {
    renderPage();
    const grid = await screen.findByRole('region', { name: 'Pipeline by stage and day' });
    const groups = within(grid).getAllByRole('group');
    expect(groups.length).toBe(9);
    expect(within(groups[1]).getAllByRole('button').length).toBe(14);
    expect(within(grid).getByRole('button', { name: 'Agent wrote the archive, 23 Oct: missing' })).toBeTruthy();
    expect(within(grid).getByRole('button', { name: 'Agent wrote the archive, 3 Nov: ok' })).toBeTruthy();
    expect(within(grid).getByRole('button', { name: 'Record run, 22 Oct: failed' })).toBeTruthy();
  });

  it('hover or tap puts the day\'s numbers, source and time in the detail card', async () => {
    renderPage();
    const cell = await screen.findByRole('button', { name: 'Agent wrote the archive, 31 Oct: thin' });
    expect(screen.getByText(/Hover or tap a cell/)).toBeTruthy();
    fireEvent.click(cell);
    const detail = screen.getByText(/Agent wrote the archive/, { selector: 'strong' }).closest('.ops-detail__body');
    expect(within(detail).getByText('thin')).toBeTruthy();
    expect(within(detail).getByText('entries')).toBeTruthy();
    expect(within(detail).getByText('17')).toBeTruthy();
    expect(within(detail).getByText(/Source: record\/inbox\/entries\/2026-10-31\.jsonl/)).toBeTruthy();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Record run, 22 Oct: failed' }));
    expect(screen.getByText(/facts: no archive entries for the day/)).toBeTruthy();
  });

  it('a day rebuilt from public records is its own status, in the key and in the detail card, never "ok"', async () => {
    renderPage();
    const grid = await screen.findByRole('region', { name: 'Pipeline by stage and day' });
    expect(screen.getByLabelText('Cell key').textContent).toContain('recovered');
    const cell = within(grid).getByRole('button', { name: 'Agent wrote the archive, 1 Nov: recovered' });
    fireEvent.click(cell);
    const detail = screen.getByText(/Agent wrote the archive/, { selector: 'strong' }).closest('.ops-detail__body');
    expect(within(detail).getByText('recovered')).toBeTruthy();
    expect(within(detail).getByText(/Recovered from public records: 1624 raw articles/)).toBeTruthy();
    expect(within(detail).getByText(/no story entries and no forecasts/)).toBeTruthy();
    expect(within(detail).getByText('heal')).toBeTruthy();
  });

  it('a cell that could not be read shows its error text', async () => {
    const health = devHealth();
    const row = health.days[5].rows[2];
    Object.assign(row, { status: 'nodata', facts: {}, error: 'AccessDenied', note: null });
    healthReply = () => Promise.resolve(health);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Record run, 27 Oct: no data/ }));
    expect(screen.getByText('Could not be read: AccessDenied')).toBeTruthy();
  });

  it('a stage with no data on any day says "no run" instead of a strip of cells', async () => {
    const health = devHealth();
    for (const d of health.days) {
      const r = d.rows.find((x) => x.stage === 'resolver');
      Object.assign(r, { status: 'nodata', facts: {}, note: 'no snapshot was kept for this day' });
    }
    healthReply = () => Promise.resolve(health);
    renderPage();
    const group = await screen.findByRole('group', { name: 'Resolver' });
    expect(within(group).getByText('no run')).toBeTruthy();
    expect(within(group).queryAllByRole('button').length).toBe(0);
  });

  it('health.json not generated: one line; a failed read says so', async () => {
    healthReply = () => Promise.resolve(null);
    const { unmount } = renderPage();
    expect(await screen.findByText('The pipeline view has not been generated yet.')).toBeTruthy();
    unmount();
    healthReply = () => Promise.reject(new Error('record view 502 for health.json'));
    renderPage();
    expect(await screen.findByText('The pipeline view could not be loaded.')).toBeTruthy();
    await waitFor(() => expect(reportFetchError).toHaveBeenCalledWith('ops-health', expect.any(Error)));
  });

  it('reads the public health view without sign-in data and shows the resolver line', async () => {
    renderPage();
    expect(await screen.findByText(/Resolver now: 88 questions sampled, 11 due/)).toBeTruthy();
    expect(fetchRecordView).toHaveBeenCalledWith('health.json');
  });
});
