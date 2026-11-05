import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { devHealth, devOpsData, devQuality } from '@/features/ops/dev/fixtures.js';
import { qualityItems } from '@/features/ops/lib/quality.js';

let opsReply;
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'op1', isAnonymous: false }, loading: false }) }));
vi.mock('@/shared/api/restProxy', () => ({ fetchOps: () => opsReply() }));
vi.mock('@/shared/api/recordViews', () => ({ fetchRecordView: () => Promise.resolve(devHealth()) }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import OpsPage from '@/features/ops/OpsPage.jsx';
import { resetOpsAccess } from '@/features/ops/hooks/useOpsAccess.js';

const renderPage = () => render(<MemoryRouter><OpsPage /></MemoryRouter>);
const panel = () => screen.findByRole('region', { name: 'Quality' });
const part = (root, title) => within(root).getByRole('heading', { name: title }).closest('.ops-part');

beforeEach(() => { opsReply = () => Promise.resolve({ status: 200, data: devOpsData() }); resetOpsAccess(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('OpsPage quality panel', () => {
  it('shows the six checks, each with its numbers, day and source', async () => {
    renderPage();
    const q = await panel();
    expect(within(q).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Situations', 'Summary wording', 'Pins', 'Forecasts', 'Source audit', 'Client errors']);

    const dup = part(q, 'Duplicate open situations');
    expect(within(dup).getByText(/1 group \(2 situations\) share a title and countries, among 21 open/)).toBeTruthy();
    expect(within(dup).getByText('Israeli opposition slams Netanyahu after US Democrats win')).toBeTruthy();
    expect(within(dup).getByText(/world\/latest\.json/)).toBeTruthy();

    const merged = part(q, 'Situations merged');
    expect(within(merged).getByText('3 merges on 3 Nov')).toBeTruthy();
    expect(within(merged).getByText('url 2 · title+country 1')).toBeTruthy();

    const words = part(q, 'Summaries that describe their sources');
    expect(within(words).getByText(/17 of 32 summaries refer to their snippets, sources or headline/)).toBeTruthy();
    const ex = within(words).getByRole('table', { name: /Examples \(3 of 17\)/ });
    expect(within(ex).getByText('according to the snippets')).toBeTruthy();
    expect(within(words).getByText(/record\/inbox\/entries\/2026-11-03\.jsonl/)).toBeTruthy();

    const voids = part(q, 'Forecast voids by reason');
    expect(within(voids).getByText('38 of 38 forecasts settled void on 3 Nov')).toBeTruthy();
    const rows = within(within(voids).getByRole('table')).getAllByRole('row');
    expect(rows[1].textContent).toContain('record gap');   // record gap first
    const cov = part(q, 'Coverage gaps per day');
    expect(within(cov).getByText('3 days of 14 cannot support a "no" verdict')).toBeTruthy();
    expect(within(cov).getByText('archive day thin:15')).toBeTruthy();

    const audit = part(q, 'Summary drift against source articles');
    expect(within(audit).getByText('Last run 4 Nov: 3 drifted, 0 errors, 2 single-source, of 6 checked')).toBeTruthy();

    const errs = part(q, 'Client errors by page');
    expect(within(errs).getByText(/92 errors on 3 Nov; median 5 a day over 20 Oct to 2 Nov/)).toBeTruthy();
    expect(within(within(errs).getByRole('table')).getByText('Map')).toBeTruthy();
  });

  it('a source that does not exist says so and names what is missing; no number is shown for it', async () => {
    renderPage();
    const q = await panel();
    const pins = part(q, 'Pins outside their country');
    expect(within(pins).getByText('Not available.')).toBeTruthy();
    expect(within(pins).getByText(/Missing: one counter for "centroid snapped to country centre"/)).toBeTruthy();
    expect(within(pins).queryByRole('table')).toBeNull();
    const dead = part(q, 'Dead outlets');
    expect(within(dead).getByText(/does not look for dead outlets/)).toBeTruthy();
  });

  it('every source failed: each check names its error, nothing is shown as a count', async () => {
    const ops = devOpsData();
    ops.quality = devQuality('errors');
    opsReply = () => Promise.resolve({ status: 200, data: ops });
    renderPage();
    const q = await panel();
    expect(within(q).getAllByText(/Could not be read on the last run: AccessDenied/).length).toBe(7);
    expect(within(q).queryByRole('table')).toBeNull();
  });

  it('a verdict day with no file says nothing was settled; an ops file from before the section existed gives one line', async () => {
    const ops = devOpsData();
    ops.quality.checks.forecast.voids = { status: 'ok', source: 'record/inbox/verdicts/2026-11-03.jsonl', day: '2026-11-03', fileAbsent: true, settled: 0, results: {}, corrections: 0, voids: 0, byReason: [], recordGapDays: [] };
    opsReply = () => Promise.resolve({ status: 200, data: ops });
    const { unmount } = renderPage();
    expect(await screen.findByText('No verdict file for 3 Nov: nothing was settled that day')).toBeTruthy();
    unmount();
    const old = devOpsData();
    delete old.quality;
    opsReply = () => Promise.resolve({ status: 200, data: old });
    renderPage();
    expect(await screen.findByText('The quality section has not been written yet.')).toBeTruthy();
  });
});

describe('quality lib', () => {
  it('a check missing from an older file is one "missing" part, not a zero', () => {
    const items = qualityItems({ checks: {} });
    expect(items.length).toBe(6);
    expect(items.flatMap((i) => i.parts).every((p) => p.state === 'missing' || p.id === 'pins')).toBe(true);
    expect(items[0].parts.map((p) => p.state)).toEqual(['missing', 'missing']);
  });

  it('no duplicates reads as none among the open count; no gaps reads as no gaps', () => {
    const q = devQuality();
    q.checks.situations.duplicates = { ...q.checks.situations.duplicates, groups: 0, situations: 0, examples: [] };
    q.checks.forecast.coverage = { ...q.checks.forecast.coverage, gaps: [] };
    const items = qualityItems(q);
    expect(items[0].parts[0].headline).toBe('None among 21 open situations');
    expect(items[0].parts[0].table).toBeNull();
    expect(items[3].parts[1].headline).toBe('No gaps in 14 days');
  });
});
