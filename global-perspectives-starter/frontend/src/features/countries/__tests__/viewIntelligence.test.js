import { describe, it, expect, vi } from 'vitest';
import { intelligenceFromCountryView } from '@/features/countries/lib/viewIntelligence.js';
import { fetchCountryBriefing } from '@/features/countries/hooks/useCountryIntelligence.js';
// Captured live 2026-10-31 (read-only, anonymous): for 8 countries the `country_intelligence` action response and the
// country view's `intelligence`, unmodified. Every one of the 48 countries with a view was equal when checked.
import live from './fixtures/countryIntelligenceLive.json';

vi.mock('@/shared/api/restProxy.js', () => ({ fetchCountryIntelligence: vi.fn() }));
vi.mock('@/shared/api/errorSink.js', () => ({ reportFetchError: vi.fn() }));

const READ_FIELDS = ['countryName', 'headline', 'bluf', 'keyDevelopments', 'whyItMatters', 'situationSummary', 'backgroundTimeline',
  'crossThreadInsight', 'trajectory', 'trajectoryDetail', 'riskSignals', 'riskLevel', 'riskScore', 'dimensions', 'lead', 'keyActors',
  'dominantCategory', 'categories', 'totalArticles', 'activeArcCount', 'threadIds', 'dateRange', 'dayCount', 'generatedAt'];

describe('intelligenceFromCountryView', () => {
  for (const [iso3, c] of Object.entries(live.countries)) {
    it(`${iso3}: equals the action's briefing, whole and field by field`, () => {
      const action = c.action[c.name];
      const mapped = intelligenceFromCountryView(c.view);
      expect(mapped).toEqual(action);
      for (const f of READ_FIELDS) expect(mapped[f], f).toEqual(action[f]);
      expect(Object.keys(mapped).sort()).toEqual(Object.keys(action).sort());
    });
  }

  it('answers null for no view, no briefing, or a briefing without a time', () => {
    expect(intelligenceFromCountryView(null)).toBeNull();
    expect(intelligenceFromCountryView({ intelligence: null })).toBeNull();
    expect(intelligenceFromCountryView({ intelligence: {} })).toBeNull();
    expect(intelligenceFromCountryView({ intelligence: [] })).toBeNull();
  });
});

describe('fetchCountryBriefing', () => {
  const iran = live.countries.IRN;
  const viewsOf = (getView) => ({ fetchCountryView: getView });

  it('reads the view and does not call the action', async () => {
    const fetchAction = vi.fn();
    const out = await fetchCountryBriefing('Iran', { getViews: viewsOf(async () => iran.view), fetchAction });
    expect(out).toEqual(iran.action.Iran);
    expect(fetchAction).not.toHaveBeenCalled();
  });

  it('falls back to the action when the view is missing or has no briefing', async () => {
    const fetchAction = vi.fn(async () => ({ data: iran.action }));
    expect(await fetchCountryBriefing('Iran', { getViews: viewsOf(async () => null), fetchAction })).toEqual(iran.action.Iran);
    expect(await fetchCountryBriefing('Iran', { getViews: viewsOf(async () => ({ intelligence: null })), fetchAction })).toEqual(iran.action.Iran);
    expect(fetchAction).toHaveBeenCalledWith(['Iran']);
  });

  it('reports a failed view fetch and falls back to the action', async () => {
    const { reportFetchError } = await import('@/shared/api/errorSink.js');
    const fetchAction = vi.fn(async () => ({ data: iran.action }));
    const out = await fetchCountryBriefing('Iran', { getViews: viewsOf(async () => { throw new Error('boom'); }), fetchAction });
    expect(out).toEqual(iran.action.Iran);
    expect(reportFetchError).toHaveBeenCalled();
  });

  it('answers null when neither source has the country', async () => {
    const out = await fetchCountryBriefing('Taiwan', { getViews: viewsOf(async () => null), fetchAction: async () => ({ data: {} }) });
    expect(out).toBeNull();
  });
});
