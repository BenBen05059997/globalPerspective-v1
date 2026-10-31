// The record views (decisions 0037, 0042), read straight from the Worker's /data/* route: story, links, country and daily counts
// files, and the index/ files that serve a page needing many stories or countries at once. A 404 means "not generated yet" and answers null; any other failure throws for the caller to report.
// makeRecordViews(getView) lets a feature swap the fetch (the board's dev fixtures); every reader shares these rules.
const BASE = '/data/record/views';
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO3 = /^[A-Z]{3}$/;

/** One view file by its path under record/views/, or null when it is not generated. */
export async function fetchRecordView(path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`record view ${res.status} for ${path}`);
  return res.json();
}

/** The track record view (decision 0044): the weekly question scheme and the frozen pilot stats; null when not generated. */
export function fetchTrackRecordView() { return fetchRecordView('track-record.json'); }

export function makeRecordViews(getView = fetchRecordView) {
  return {
    /** The story view, or null when not generated. A merged story's view is an alias: the survivor is fetched. */
    async fetchStoryView(id) {
      if (!ID.test(id || '')) return null;
      const view = await getView(`stories/${id}.json`);
      return view?.aliasOf && ID.test(view.aliasOf) ? getView(`stories/${view.aliasOf}.json`) : view;
    },
    fetchLinksView(id) { return ID.test(id || '') ? getView(`links/${id}.json`) : Promise.resolve(null); },
    fetchCountryView(iso3) { return ISO3.test(iso3 || '') ? getView(`countries/${iso3}.json`) : Promise.resolve(null); },
    fetchCounts(date) { return DAY.test(date || '') ? getView(`counts/${date}.json`) : Promise.resolve(null); },
    // The many-at-once indexes (one file each, built from the same notes as the per-story and per-country views):
    // the analysis fields of every story, the whole story web in `web_index` shape, the briefing fields of every country.
    fetchAnalysesIndex() { return getView('index/analyses.json'); },
    fetchWebIndexView() { return getView('index/web.json'); },
    fetchCountriesIndex() { return getView('index/countries.json'); },
    // The last 30 archive days (the `archive_range` action's days: topic, story, category, countries, sources).
    fetchWeeklyIndex() { return getView('index/weekly.json'); },
    // The daily and weekly briefs (decision 0048): which exist, and one brief each by its date (a weekly by its weekOf).
    fetchBriefsIndex() { return getView('index/briefs.json'); },
    fetchDailyBriefView(dateKey) { return DAY.test(dateKey || '') ? getView(`briefs/daily/${dateKey}.json`) : Promise.resolve(null); },
    fetchWeeklyBriefView(weekOf) { return DAY.test(weekOf || '') ? getView(`briefs/weekly/${weekOf}.json`) : Promise.resolve(null); },
  };
}
