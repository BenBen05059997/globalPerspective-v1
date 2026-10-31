// viewsFresh: the rule that lets the pages stop asking the DynamoDB-backed actions for the newest days (decision 0050).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/errorSink.js', () => sink);

import { manifestFresh, loadViewsFresh, clearViewsFreshCache, MAX_VIEW_AGE_MS } from '@/shared/api/viewsFresh.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const at = (ageMs) => ({ builtAt: new Date(NOW - ageMs).toISOString() });

beforeEach(() => { clearViewsFreshCache(); sink.reportFetchError.mockReset(); });

describe('manifestFresh', () => {
  it('is fresh up to 9 hours after builtAt and stale after', () => {
    expect(MAX_VIEW_AGE_MS).toBe(9 * 3600000);
    expect(manifestFresh(at(0), NOW)).toBe(true);
    expect(manifestFresh(at(MAX_VIEW_AGE_MS), NOW)).toBe(true);
    expect(manifestFresh(at(MAX_VIEW_AGE_MS + 1000), NOW)).toBe(false);
  });
  it('a manifest without a usable builtAt, or none, is not fresh', () => {
    for (const bad of [null, undefined, {}, { builtAt: 'yesterday' }, { builtAt: null }]) expect(manifestFresh(bad, NOW)).toBe(false);
  });
  it('the longest gap between two builds (04:35 to 12:35, 8 h) stays fresh', () => {
    expect(manifestFresh(at(8 * 3600000), NOW)).toBe(true);
  });
});

describe('loadViewsFresh', () => {
  it('fresh: answers once for every caller in the next 5 minutes, and reports nothing', async () => {
    const views = { fetchManifest: vi.fn(async () => at(3600000)) };
    const [a, b] = await Promise.all([loadViewsFresh(views, () => NOW), loadViewsFresh(views, () => NOW)]);
    expect([a.fresh, b.fresh]).toEqual([true, true]);
    await loadViewsFresh(views, () => NOW + 4 * 60000);
    expect(views.fetchManifest).toHaveBeenCalledTimes(1);
    await loadViewsFresh(views, () => NOW + 6 * 60000);
    expect(views.fetchManifest).toHaveBeenCalledTimes(2);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('stale and missing manifests are reported as record-views-stale and answer not fresh', async () => {
    expect((await loadViewsFresh({ fetchManifest: async () => at(10 * 3600000) }, () => NOW)).fresh).toBe(false);
    clearViewsFreshCache();
    expect((await loadViewsFresh({ fetchManifest: async () => null }, () => NOW)).fresh).toBe(false);
    expect(sink.reportFetchError).toHaveBeenCalledTimes(2);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-views-stale', expect.any(Error));
  });

  it('an unreadable manifest is reported as record-manifest, not fresh, and not remembered', async () => {
    const views = { fetchManifest: vi.fn().mockRejectedValueOnce(new Error('record view 502 for manifest.json')).mockResolvedValue(at(0)) };
    expect((await loadViewsFresh(views, () => NOW)).fresh).toBe(false);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-manifest', expect.any(Error));
    expect((await loadViewsFresh(views, () => NOW)).fresh).toBe(true); // the next caller asks again
  });
});
