// The "today" view in the record (decision 0051): record/views/index/today.json holds the entries of the last 24 hours as the agent archived them,
// the latest run's selection with the fields only `latest` had (urgency, x_trending, primaryCountry), and the full model text of the latest run's
// entries. The pages that asked the DynamoDB-backed actions `topics`, `today`, `summary`, `prediction` and `trace_cause` for "today" read it first
// while the views are fresh (0050); each action stays the fallback. The three mappers below are pure: view in, the action's answer out, or null
// when the view cannot answer that call (then the caller asks the action). Public data only: the five actions have no membership gate.
import { makeRecordViews } from '@/shared/api/recordViews.js';
import { reportFetchError } from '@/shared/api/errorSink.js';
import { loadViewsFresh } from '@/shared/api/viewsFresh.js';

// newsSensitiveData marks `topics` stale when the latest run is older than TOPICS_CACHE_MAX_AGE_SECONDS (live value 32400 = 9 h).
export const TOPICS_MAX_AGE_MS = 32400 * 1000;
const DAY_MS = 86400000;
const TODAY_SOURCES = 3; // the today-archive item keeps the first 3 sources of an entry; the view keeps up to 10
const KIND = { summary: 'SUMMARY', prediction: 'PREDICTION', trace_cause: 'TRACE_CAUSE' };
const LATEST_ONLY = ['urgency', 'urgencyReason', 'significance', 'x_trending', 'primaryCountry', 'mentionedCountries'];
const VIEW_ONLY = ['eventId', 'latest', 'notes'];
const TTL_MS = 5 * 60 * 1000;
let memo = null; // { ts, promise }

const usable = (view) => Boolean(view && view.schemaVersion === 1 && Array.isArray(view.entries));
const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

/** The `topics` action's answer: the latest run's topics in its order, or null when the view has no complete latest run. */
export function topicsPayload(view, now = Date.now()) {
  if (!usable(view) || !view.latest || !Array.isArray(view.latest.topicIds)) return null;
  const byId = new Map(view.entries.map((e) => [e.topicId, e]));
  const entries = view.latest.topicIds.map((id) => byId.get(id));
  if (!entries.length || entries.some((e) => !e)) return null;
  const topics = entries.map((e) => ({
    ...without(e, [...VIEW_ONLY, 'archivedAt', 'generationId', 'ai']),
    id: e.topicId,
    ...Object.fromEntries(Object.entries(e.latest || {}).filter(([k]) => LATEST_ONLY.includes(k))),
  }));
  const { latest } = view;
  const updated = Date.parse(latest.updatedAt);
  return {
    success: true, cached: true, stale: !(now - updated <= TOPICS_MAX_AGE_MS), asOf: latest.updatedAt,
    data: {
      model: latest.model, limit: latest.limit, id: 'latest', topics, updatedAt: latest.updatedAt, generationId: latest.generationId, status: 'active',
      generatedYear: latest.generatedYear, generatedDate: latest.generatedDate,
    },
  };
}

/** The `today` action's answer: the entries archived in the last 24 hours (cut at read time, as the action does), three sources each. */
export function todayPayload(view, now = Date.now()) {
  if (!usable(view)) return null;
  const entries = view.entries
    .filter((e) => Date.parse(e.archivedAt) > now - DAY_MS)
    .map((e) => ({ ...without(e, VIEW_ONLY), sources: (e.sources || []).slice(0, TODAY_SOURCES) }));
  return { success: true, data: { entries, updatedAt: entries.length ? view.updatedAt : null } };
}

/** The `summary` | `prediction` | `trace_cause` action's answer for a topic of the latest run, or null (older topics keep asking the action). */
export function notePayload(view, topicId, kind) {
  if (!usable(view) || !KIND[kind] || !view.latest) return null;
  const entry = view.entries.find((e) => e.topicId === topicId);
  const note = entry && entry.notes && entry.notes[kind];
  if (!note) return null;
  const json = note.format === 'json';
  return {
    success: true, cached: true, stale: false,
    data: {
      model: note.model, content: json ? JSON.stringify(note.content) : String(note.content ?? '').trim(), generationId: entry.generationId, action: kind,
      generatedAt: note.at, topicId, threadId: entry.threadId ?? null, title: entry.title, contentFormat: json ? 'json' : 'markdown', kind: KIND[kind],
    },
  };
}

/** The view for the next ~5 minutes (one request for every caller), or null when it is not generated or could not be read (a failed read is reported). `views` is for tests. */
export function loadTodayView(views = makeRecordViews()) {
  if (memo && Date.now() - memo.ts < TTL_MS) return memo.promise;
  const promise = Promise.resolve().then(() => views.fetchTodayView()).then((v) => (usable(v) ? v : null)).catch((err) => { reportFetchError('today-view', err); return null; });
  memo = { ts: Date.now(), promise };
  promise.then((v) => { if (!v && memo && memo.promise === promise) memo = null; }); // never keep a miss
  return promise;
}

/** Tests: forget the shared view. */
export function clearTodayViewCache() { memo = null; }

/**
 * The answer for one call: from the view while the record's views are fresh and the view can answer, else from the action.
 * `fromView(view)` -> payload | null; `fromAction()` -> payload. A view that cannot be read has been reported by loadTodayView.
 */
export async function viewFirst(fromView, fromAction, { fresh = loadViewsFresh, load = loadTodayView } = {}) {
  const { fresh: ok } = await fresh();
  if (ok) {
    const view = await load();
    const payload = view ? fromView(view) : null;
    if (payload) return payload;
  }
  return fromAction();
}
