// archiveRange: the 30-day archive from the record's weekly index, the `archive_range` action for the newest days and as the fallback.
// Fixtures are live captures of 2026-10-31 (days 2026-10-26 to 2026-10-31), cut to the fields the readers use:
//   archiveRangeAction.json  the action's answer (curl POST /proxy {"action":"archive_range","payload":{"days":6}}),
//   weeklyIndex.json         index/weekly.json built by newsStoryRecord from the synced record facts of the same day (not yet published).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import action from './fixtures/archiveRangeAction.json';
import weekly from './fixtures/weeklyIndex.json';

const api = vi.hoisted(() => ({ fetchArchiveRange: vi.fn() }));
const rv = vi.hoisted(() => ({ fetchWeeklyIndex: vi.fn(), fetchManifest: vi.fn() }));
const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/restProxy.js', () => api);
vi.mock('@/shared/api/recordViews.js', () => ({ makeRecordViews: () => ({ fetchWeeklyIndex: (...a) => rv.fetchWeeklyIndex(...a), fetchManifest: (...a) => rv.fetchManifest(...a) }) }));
vi.mock('@/shared/api/errorSink.js', () => sink);

import { clearViewsFreshCache, MAX_VIEW_AGE_MS } from '@/shared/api/viewsFresh.js';
import { loadArchiveDayMap, loadArchiveDayMapFromAction, dayMapFromIndex, weeklyIndexUsable, daysFrom } from '@/shared/api/archiveRange.js';

const NOW = new Date('2026-10-31T15:05:00Z');
const built = (ageMs) => ({ schemaVersion: 1, builtAt: new Date(Date.now() - ageMs).toISOString(), factsThrough: '2026-10-31' });
const actionDays = (days) => ({ success: true, data: Object.fromEntries(Object.entries(action.data).filter(([d]) => d >= days)) });

beforeEach(() => {
  api.fetchArchiveRange.mockReset(); api.fetchArchiveRange.mockResolvedValue(action);
  rv.fetchWeeklyIndex.mockReset(); rv.fetchWeeklyIndex.mockResolvedValue(weekly);
  sink.reportFetchError.mockReset();
  clearViewsFreshCache(); rv.fetchManifest.mockReset(); rv.fetchManifest.mockResolvedValue(built(0)); // fresh views unless a test says otherwise
});

describe('the index as the action\'s day map', () => {
  const rec = dayMapFromIndex(weekly, '2026-10-31');

  it('has the same days, each with entries and the day\'s time, in the action\'s entry shape', () => {
    expect(Object.keys(rec).sort()).toEqual(Object.keys(action.data).sort());
    const [e] = rec['2026-10-30'].entries;
    expect(Object.keys(e).sort()).toEqual(['category', 'iso3', 'regions', 'sources', 'threadId', 'title', 'topicId']);
    expect(rec['2026-10-30'].updatedAt).toMatch(/^2026-10-30T/);
    expect(e.sources[0]).toEqual({ source: expect.any(String), url: expect.stringMatching(/^https?:/) });
  });

  it('is the action\'s entry for every entry it has: same topic, title and category; places are the iso3 countries; same sources', () => {
    let matched = 0;
    for (const [day, d] of Object.entries(rec)) {
      const byTopic = new Map(action.data[day].entries.map((e) => [e.topicId, e]));
      for (const e of d.entries) {
        const a = byTopic.get(e.topicId);
        expect(a, `${day} ${e.topicId}`).toBeTruthy(); // the record has no entry the archive has not
        expect([e.title, e.category]).toEqual([a.title, a.category]);
        expect(e.sources.map((s) => s.url)).toEqual(a.sources.map((s) => s.url));
        matched++;
      }
    }
    expect(matched).toBe(Object.values(rec).reduce((n, d) => n + d.entries.length, 0));
  });

  it('shows an article listed again on a later day once (the record\'s rule): 2 fewer entries than the archive in these 6 days, one on 10-26 and one on 10-30', () => {
    const per = (m) => Object.fromEntries(Object.entries(m).map(([d, x]) => [d, x.entries.length]).sort());
    expect(per(action.data)).toEqual({ '2026-10-26': 39, '2026-10-27': 35, '2026-10-28': 27, '2026-10-29': 24, '2026-10-30': 27, '2026-10-31': 6 });
    expect(per(rec)).toEqual({ '2026-10-26': 38, '2026-10-27': 35, '2026-10-28': 27, '2026-10-29': 24, '2026-10-30': 26, '2026-10-31': 6 });
  });

  it('keeps the places of the entry\'s iso3 (the archive\'s regions where they are countries), and none for an unknown code', () => {
    const e = rec['2026-10-30'].entries.find((x) => x.iso3.includes('USA'));
    expect(e.regions).toContain('United States');
    expect(dayMapFromIndex({ days: { '2026-10-30': { entries: [{ title: 't', iso3: ['EUU', 'WLD', 'FRA'], sources: [] }] } } }, '2026-10-31')['2026-10-30'].entries[0].regions).toEqual(['European Union', 'France']);
  });

  it('names a source by its outlet, else by the host of its url, and drops days outside the 30-day window', () => {
    const day = { entries: [{ title: 't', iso3: [], sources: [{ outlet: 'France 24', url: 'https://www.france24.com/x' }, { outlet: null, url: 'https://www.dawn.com/news/1' }] }] };
    const out = dayMapFromIndex({ days: { '2026-10-30': day, '2026-09-30': day } }, '2026-10-31');
    expect(Object.keys(out)).toEqual(['2026-10-30']);
    expect(out['2026-10-30'].entries[0].sources.map((s) => s.source)).toEqual(['France 24', 'dawn.com']);
  });
});

describe('loadArchiveDayMap', () => {
  it('fresh views answer for every day, today included: no action call (decision 0050)', async () => {
    const out = await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).not.toHaveBeenCalled();
    expect(out).toEqual(dayMapFromIndex(weekly, '2026-10-31'));
    expect(out['2026-10-31'].source).toBe('record');
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('views older than 9 hours are reported and the action supplies the newest days again', async () => {
    rv.fetchManifest.mockResolvedValue(built(MAX_VIEW_AGE_MS + 60000));
    await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-views-stale', expect.any(Error));
  });

  it('a missing or unreadable manifest is not fresh: the action is asked and the reason reported', async () => {
    rv.fetchManifest.mockResolvedValue(null);
    await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-views-stale', expect.any(Error));
    clearViewsFreshCache(); api.fetchArchiveRange.mockClear(); sink.reportFetchError.mockClear();
    rv.fetchManifest.mockRejectedValue(new Error('record view 500 for manifest.json'));
    await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(1);
    expect(sink.reportFetchError).toHaveBeenCalledWith('record-manifest', expect.any(Error));
  });

  it('reads the record for the recorded days and the action for the newest recorded day and after when the views are stale', async () => {
    rv.fetchManifest.mockResolvedValue(built(10 * 3600000));
    const out = await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(1); // newest recorded day 2026-10-31 is today: that day only
    expect(Object.keys(out).sort()).toEqual(Object.keys(action.data).sort());
    expect(out['2026-10-31']).toEqual(action.data['2026-10-31']); // the action's day, as it is
    expect(out['2026-10-30'].source).toBe('record');
  });

  it('asks the action for every day since the newest recorded day when the record is behind (stale views)', async () => {
    rv.fetchManifest.mockResolvedValue(built(10 * 3600000));
    api.fetchArchiveRange.mockResolvedValue(actionDays('2026-10-29'));
    const behind = { ...weekly, days: Object.fromEntries(Object.entries(weekly.days).filter(([d]) => d <= '2026-10-29')) };
    rv.fetchWeeklyIndex.mockResolvedValue(behind);
    const out = await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(3); // 29th, 30th, 31st
    expect(out['2026-10-29'].source).toBe('archive'); // the newest recorded day comes from the action once it answers
    expect(Object.keys(out)).toContain('2026-10-31');
  });

  it('keeps the recorded days when the action fails for the newest days, and reports it', async () => {
    rv.fetchManifest.mockResolvedValue(built(10 * 3600000));
    api.fetchArchiveRange.mockRejectedValue(new Error('Proxy HTTP 502'));
    const out = await loadArchiveDayMap(NOW);
    expect(Object.keys(out).sort()).toEqual(Object.keys(weekly.days).sort());
    expect(sink.reportFetchError).toHaveBeenCalledWith('archive-range-recent', expect.any(Error));
  });

  it('falls back to the action for all 30 days when the index is missing (404), without a report', async () => {
    rv.fetchWeeklyIndex.mockResolvedValue(null);
    const out = await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(30);
    expect(out).toBe(action.data);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('falls back to the action when the index cannot be read, and reports it', async () => {
    rv.fetchWeeklyIndex.mockRejectedValue(new Error('record view 500 for index/weekly.json'));
    const out = await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(30);
    expect(out).toBe(action.data);
    expect(sink.reportFetchError).toHaveBeenCalledWith('weekly-index', expect.any(Error));
  });

  it('an empty or malformed index is not usable, and the action answers', async () => {
    for (const bad of [{ days: {} }, { days: [] }, {}, 'x']) {
      expect(weeklyIndexUsable(bad)).toBe(false);
    }
    rv.fetchWeeklyIndex.mockResolvedValue({ schemaVersion: 1, days: {} });
    await loadArchiveDayMap(NOW);
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(30);
  });

  it('with no index and a failing action, the error reaches the caller (the hooks report or show it as before)', async () => {
    rv.fetchWeeklyIndex.mockResolvedValue(null);
    api.fetchArchiveRange.mockRejectedValue(new Error('Proxy HTTP 502'));
    await expect(loadArchiveDayMap(NOW)).rejects.toThrow('Proxy HTTP 502');
  });

  it('counts whole UTC days', () => {
    expect([daysFrom('2026-10-29', '2026-10-31'), daysFrom('2026-10-31', '2026-10-31'), daysFrom('2026-11-02', '2026-10-31')]).toEqual([2, 0, 0]);
  });
});

describe('a reader kept on the action (the countries list, decision 0046)', () => {
  it('reads the 30 days from archive_range only, never the index', async () => {
    const out = await loadArchiveDayMapFromAction();
    expect(api.fetchArchiveRange).toHaveBeenCalledWith(30);
    expect(rv.fetchWeeklyIndex).not.toHaveBeenCalled();
    expect(out).toEqual(action.data);
  });
});
