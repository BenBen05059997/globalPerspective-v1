// The board's reads of the record views (decision 0037), straight from the Worker's /data/* route: story, links and
// daily counts files. A 404 means "not generated yet" and answers null; any other failure throws for the caller to
// report. (Same shape as the map's worldData getJson; features do not import each other.)
const BASE = '/data/record/views';
const ID = /^[A-Za-z0-9_-]{1,200}$/;

async function getView(path) {
  if (import.meta.env.DEV) {
    const fake = await import('../dev/fakeRecordViews.js');
    if (fake.devRecordMode()) return fake.fakeView(path);
  }
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`record view ${res.status} for ${path}`);
  return res.json();
}

/** The story view, or null when not generated. A merged story's view is an alias: the survivor is fetched. */
export async function fetchStoryView(id) {
  if (!ID.test(id)) return null;
  const view = await getView(`stories/${id}.json`);
  return view?.aliasOf && ID.test(view.aliasOf) ? getView(`stories/${view.aliasOf}.json`) : view;
}

export function fetchLinksView(id) { return ID.test(id) ? getView(`links/${id}.json`) : Promise.resolve(null); }

export function fetchCounts(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) ? getView(`counts/${date}.json`) : Promise.resolve(null); }

/** UTC dates from `from` to `to` inclusive (YYYY-MM-DD). */
export function datesBetween(from, to) {
  const out = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Monday of the ISO week holding `date` (UTC, YYYY-MM-DD). */
export function isoWeekStart(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}
