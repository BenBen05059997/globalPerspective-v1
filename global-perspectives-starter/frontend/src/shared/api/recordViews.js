// The record views (decisions 0037, 0042), read straight from the Worker's /data/* route: story, links and daily counts
// files. A 404 means "not generated yet" and answers null; any other failure throws for the caller to report.
// makeRecordViews(getView) lets a feature swap the fetch (the board's dev fixtures); every reader shares these rules.
const BASE = '/data/record/views';
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One view file by its path under record/views/, or null when it is not generated. */
export async function fetchRecordView(path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`record view ${res.status} for ${path}`);
  return res.json();
}

export function makeRecordViews(getView = fetchRecordView) {
  return {
    /** The story view, or null when not generated. A merged story's view is an alias: the survivor is fetched. */
    async fetchStoryView(id) {
      if (!ID.test(id || '')) return null;
      const view = await getView(`stories/${id}.json`);
      return view?.aliasOf && ID.test(view.aliasOf) ? getView(`stories/${view.aliasOf}.json`) : view;
    },
    fetchLinksView(id) { return ID.test(id || '') ? getView(`links/${id}.json`) : Promise.resolve(null); },
    fetchCounts(date) { return DAY.test(date || '') ? getView(`counts/${date}.json`) : Promise.resolve(null); },
  };
}
