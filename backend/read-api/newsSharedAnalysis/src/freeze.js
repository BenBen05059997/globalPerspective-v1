// Freezing the sources of a shared run. The client says WHICH stories (topicId, optional threadId); everything
// else — titles, regions, the archive snippets, the stored analysis, the forecast log — is fetched HERE from our
// public proxy (with the reader's own bearer token, so the depth matches what their run saw) and put through
// the same builder the browser uses (analysisContext.js). Then the server's numbered sources must equal the
// numbers the reader's run cited (409 sources_changed otherwise). No client-supplied source text is stored.
import { createContextBuilder } from './analysisContext.js';
import * as promptLib from './analysisPrompt.js';
import { safeWhy, safeTriggerEvent } from './driftNote.js';
import { dropRedatedRepeats } from './dropRedatedRepeats.js';
import { safeHttpUrl } from './urls.js';
import { viewForecast, forecastOfThread } from './forecastFromView.js';

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);

const VIEWS_MAX_AGE_MS = 9 * 60 * 60 * 1000; // the record's views are rebuilt at least every 8 hours (decision 0050); older is stale
const THREAD_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * A story's forecast from the record's forecasts view (decision 0052), the browser's rule (shared/api/forecastViews.js): answered while the manifest is under 9 hours old,
 * a story with no file has drawn no question; not answered (stale, unreadable) and the caller asks the prediction_snapshot action. `viewsUrl` = <site>/data/record/views.
 */
function makeRecordForecast({ viewsUrl, fetchImpl, timeoutMs, now = Date.now }) {
  async function getView(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${viewsUrl}/${path}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`record view HTTP ${res.status} for ${path}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }
  return async function forecastFromRecord(threadId, topicIds) {
    if (!THREAD_ID.test(threadId || '')) return { answered: false, snapshot: null };
    const manifest = await getView('manifest.json');
    const built = Date.parse(manifest && manifest.builtAt);
    if (!Number.isFinite(built) || now() - built > VIEWS_MAX_AGE_MS) return { answered: false, snapshot: null };
    const view = await getView(`forecasts/${threadId}.json`);
    if (!view) return { answered: true, snapshot: null };
    return { answered: true, snapshot: topicIds ? viewForecast(view, { topicIds }) : forecastOfThread(view) };
  };
}

/** Plain HTTP client for the public proxy, same request shape as the browser's restProxy. `recordViewsUrl` (optional) lets the forecast come from the record first. */
export function makeProxyFetchers({ proxyUrl, token = null, fetchImpl = fetch, timeoutMs = 8000, recordViewsUrl = null, now = Date.now }) {
  async function call(action, payload, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(proxyUrl, { method: 'POST', headers, body: JSON.stringify({ action, payload }), signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    let body;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    if (body && typeof body === 'object' && 'statusCode' in body && 'body' in body) {
      try { return typeof body.body === 'string' ? JSON.parse(body.body) : body.body; } catch { return body.body; }
    }
    return body;
  }
  return {
    topics: () => call('topics', {}, false),
    summary: (topicId) => call('summary', { topicId }, false),
    prediction: (topicId) => call('prediction', { topicId }, false),
    traceCause: (topicId) => call('trace_cause', { topicId }, false),
    narrativeThread: (threadId) => call('narrative_thread', { threadId }, true),
    threadAnalyses: (threadIds) => call('thread_analysis', { threadIds }, true),
    predictionSnapshot: (topicIds) => call('prediction_snapshot', { topicIds }, false),
    ...(recordViewsUrl ? { forecastFromRecord: makeRecordForecast({ viewsUrl: recordViewsUrl.replace(/\/+$/, ''), fetchImpl, timeoutMs, now }) } : {}),
  };
}

/**
 * @returns {Promise<{ok:true, frozen:object}|{ok:false, status:number, code:string, message:string}>}
 */
export async function freezeSources({ stories, fetchers, onError = () => {} }) {
  let todays = [];
  try {
    const r = await fetchers.topics();
    todays = (r && r.data && Array.isArray(r.data.topics)) ? r.data.topics : [];
  } catch (e) { onError('topics', e); }
  const byId = new Map(todays.map((t) => [t.topicId || t.id, t]));

  const selected = [];
  for (const s of stories) {
    const topic = byId.get(s.topicId) || null;
    const threadId = (topic && topic.threadId) || s.threadId || null;
    let title = topic && topic.title ? topic.title : null;
    if (!title && threadId) {
      try {
        const r = await fetchers.narrativeThread(threadId);
        const entries = (r && Array.isArray(r.data)) ? r.data : [];
        const newest = entries.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
        title = newest && newest.title ? newest.title : null;
      } catch (e) { onError('narrative_thread', e); }
    }
    if (!title) return { ok: false, status: 422, code: 'unknown_story', message: 'One of the stories could not be found in our archive.' };
    selected.push({
      topicId: s.topicId, threadId, title: clip(title, 160),
      regions: topic && Array.isArray(topic.regions) ? topic.regions.map((r) => clip(r, 60)).slice(0, 8) : [],
      category: topic && topic.category ? clip(topic.category, 40) : 'other',
      sources: topic && Array.isArray(topic.sources) ? topic.sources.map((x) => ({ url: x && x.url })) : [],
    });
  }

  let built;
  try {
    const build = createContextBuilder({
      fetchers,
      assembly: {
        assembleContext: promptLib.assembleContext, buildStorySources: promptLib.buildStorySources,
        pickText: promptLib.pickText, clip: promptLib.clip, MAX_NEWS_PER_STORY: promptLib.MAX_NEWS_PER_STORY,
      },
      helpers: { safeWhy, safeTriggerEvent, dropRedatedRepeats },
      onError,
    });
    built = await build(selected);
  } catch (e) {
    onError('build', e);
    return { ok: false, status: 502, code: 'upstream_failed', message: 'Our archive could not be read just now. Please try again.' };
  }

  // Each source / citation names its story's thread (the shared context modules key them by story title).
  const threadOf = new Map();
  for (const s of selected) if (!threadOf.has(s.title)) threadOf.set(s.title, s.threadId);
  const threadIdFor = (storyTitle) => threadOf.get(storyTitle) || null;
  const citations = built.citations.map((c) => ({ ...c, threadId: threadIdFor(c.storyTitle) }));
  const sources = built.sources.map((s) => ({
    n: s.n, kind: s.kind, date: s.date ? clip(s.date, 40) : null, label: s.label ? clip(s.label, 80) : null,
    storyTitle: s.storyTitle ? clip(s.storyTitle, 160) : null, threadId: threadIdFor(s.storyTitle), url: safeHttpUrl(s.url), text: clip(s.text, 900),
  }));
  return {
    ok: true,
    frozen: {
      context: built.context, citations, sources, thin: built.thin,
      stories: selected.map((s) => ({ topicId: s.topicId, threadId: s.threadId, title: s.title })),
    },
  };
}

// The reader's run cited [n] against ITS numbering; ours must be the same list (n, kind, date, label, url).
export function sameNumbering(serverCitations, clientCitations) {
  if (!Array.isArray(serverCitations) || !Array.isArray(clientCitations)) return false;
  if (serverCitations.length !== clientCitations.length) return false;
  return serverCitations.every((c, i) => {
    const k = clientCitations[i] || {};
    return c.n === k.n && c.kind === k.kind && (c.date || null) === (k.date || null) && (c.label || null) === (k.label || null) && (c.url || null) === (k.url || null);
  });
}
