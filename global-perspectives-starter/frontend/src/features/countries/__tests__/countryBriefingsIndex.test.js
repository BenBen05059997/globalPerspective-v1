// The countries index gives the countries list and the map's risk layer what `country_intelligence` gave. Fixture captured
// live on 2026-10-31 (curl, outside the tests): the action's briefings for 12 countries (long text the readers never touch
// dropped) and the record's index/countries.json built from a copy of the live record. Compared through the functions the
// readers run: countryTier, compareByRisk, trajectoryOf, buildCountryRiskLayer and the list's own field reads.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { briefingsFromIndex, countriesIndexUsable, loadCountriesIndex, clearCountriesIndexCache } from '@/shared/api/countryBriefingsIndex.js';
import { countryTier, compareByRisk } from '@/features/countries/lib/countryTier.js';
import { trajectoryOf } from '@/shared/lib/trajectory.js';
import { buildCountryRiskLayer } from '@/shared/map/countryRiskLayer.js';
import data from './fixtures/countryBriefingsIndex.json';

const sink = vi.hoisted(() => ({ reportFetchError: vi.fn() }));
vi.mock('@/shared/api/errorSink.js', () => sink);

const NOW = Date.parse('2026-10-31T06:00:00Z');
const listReads = (i) => ({ tier: countryTier(i), score: i?.riskScore, headline: i?.headline, trajectory: trajectoryOf(i?.trajectory), signal: i?.riskSignals?.[0], generatedAt: i?.generatedAt, riskLevel: i?.riskLevel });

beforeEach(() => { clearCountriesIndexCache(); sink.reportFetchError.mockReset(); });

describe('briefingsFromIndex against live captures', () => {
  const fromIndex = briefingsFromIndex(data.index, data.names);

  it('one briefing per requested country, keyed by the requested name (the action\'s keys)', () => {
    expect(Object.keys(fromIndex).sort()).toEqual(Object.keys(data.action).sort());
    expect(Object.keys(data.action).length).toBe(12);
  });

  for (const name of data.names) {
    it(`equal: every field the list and the risk layer read, ${name}`, () => {
      expect(listReads(fromIndex[name])).toEqual(listReads(data.action[name]));
      expect(fromIndex[name].dimensions).toEqual(data.action[name].dimensions);
    });
  }

  it('the list\'s riskiest-first order and the map layer are the same', () => {
    const order = (m) => data.names.filter((n) => m[n]).sort((a, b) => compareByRisk(m[a], m[b]) || a.localeCompare(b));
    expect(order(fromIndex)).toEqual(order(data.action));
    expect(buildCountryRiskLayer(fromIndex, NOW)).toEqual(buildCountryRiskLayer(data.action, NOW));
    expect(buildCountryRiskLayer(fromIndex, NOW).drawn.length).toBeGreaterThan(5);
  });

  it('what the readers never use is not in the index: no drift, systems or long briefing text', () => {
    for (const name of data.names) for (const k of ['drift', 'driftCount', 'systems', 'keyDevelopments', 'backgroundTimeline', 'bluf', 'keyActors', 'trajectoryDetail']) expect(fromIndex[name]).not.toHaveProperty(k);
  });

  it('only the first risk signal rides along', () => {
    for (const name of data.names) expect(fromIndex[name].riskSignals?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('a country without a briefing, an alias spelling and an unusable index', () => {
    expect(briefingsFromIndex(data.index, ['Atlantis'])).toEqual({});
    expect(briefingsFromIndex(data.index, ['USA'])).toEqual({ USA: data.index.countries.USA });
    for (const bad of [null, {}, { countries: [] }]) { expect(countriesIndexUsable(bad)).toBe(false); expect(briefingsFromIndex(bad, data.names)).toEqual({}); }
  });
});

describe('loadCountriesIndex', () => {
  const views = (fn) => ({ fetchCountriesIndex: fn });

  it('one request is shared by every caller for the next minutes', async () => {
    const fn = vi.fn().mockResolvedValue(data.index);
    const [a, b] = await Promise.all([loadCountriesIndex(views(fn)), loadCountriesIndex(views(fn))]);
    expect(a).toBe(data.index); expect(b).toBe(data.index);
    await loadCountriesIndex(views(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a missing index (404) answers null unreported, and is asked again next time', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    expect(await loadCountriesIndex(views(fn))).toBeNull();
    await Promise.resolve();
    expect(await loadCountriesIndex(views(fn))).toBeNull();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sink.reportFetchError).not.toHaveBeenCalled();
  });

  it('a failed read is reported and answers null so the caller asks the action', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('record view 500 for index/countries.json'));
    expect(await loadCountriesIndex(views(fn))).toBeNull();
    expect(sink.reportFetchError).toHaveBeenCalledWith('countries-index', expect.any(Error));
  });
});
