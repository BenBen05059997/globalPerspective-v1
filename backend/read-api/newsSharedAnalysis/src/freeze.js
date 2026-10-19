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

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);

/** Plain HTTP client for the public proxy, same request shape as the browser's restProxy. */
export function makeProxyFetchers({ proxyUrl, token = null, fetchImpl = fetch, timeoutMs = 8000 }) {
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

  const sources = built.sources.map((s) => ({
    n: s.n, kind: s.kind, date: s.date ? clip(s.date, 40) : null, label: s.label ? clip(s.label, 80) : null,
    storyTitle: s.storyTitle ? clip(s.storyTitle, 160) : null, url: safeHttpUrl(s.url), text: clip(s.text, 900),
  }));
  return {
    ok: true,
    frozen: {
      context: built.context, citations: built.citations, sources, thin: built.thin,
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
