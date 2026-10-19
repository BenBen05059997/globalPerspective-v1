'use strict';

// Brave Search (news, then web as a fallback) — the same calls the legacy resolver made. Uses the
// existing BRAVE_SEARCH_API_KEY env; no new dependency.
// Brave's plans rate-limit per second (the first replay run returned 0 results for 4 of 10
// questions with 3 parallel workers), so every request goes through one serialized gate with a
// minimum gap, and a 429 is retried after a pause. Every non-OK status is logged (never the key).
const NEWS = 'https://api.search.brave.com/res/v1/news/search';
const WEB = 'https://api.search.brave.com/res/v1/web/search';

function makeSearch(apiKey, { fetchImpl = fetch, gapMs = 1100, retryMs = 2200, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const headers = { Accept: 'application/json', 'X-Subscription-Token': apiKey };
  const host = (r) => r.meta_url?.hostname || (r.url || '').split('/')[2] || 'unknown';
  let gate = Promise.resolve();

  // one request at a time, at least gapMs between starts
  function limited(url) {
    const run = gate.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const started = Date.now();
        const resp = await fetchImpl(url, { headers });
        const wait = Math.max(0, gapMs - (Date.now() - started));
        if (resp.status === 429 && attempt < 2) { console.warn('brave 429, retrying'); await sleep(retryMs); continue; }
        if (!resp.ok) { console.warn(`brave status ${resp.status}`); await sleep(wait); return null; }
        const data = await resp.json();
        await sleep(wait);
        return data;
      }
      return null;
    });
    gate = run.catch(() => {});
    return run;
  }

  return async function search(query) {
    if (!apiKey) return [];
    const out = [];
    try {
      const data = await limited(`${NEWS}?q=${encodeURIComponent(query)}&count=6&search_lang=en`);
      for (const r of (data?.results || []).slice(0, 6)) out.push({ title: r.title || '', snippet: r.description || '', source: host(r), url: r.url || '', age: r.age || '' });
    } catch (e) { console.warn('brave news failed:', e.message); }
    if (out.length < 3) {
      try {
        const data = await limited(`${WEB}?q=${encodeURIComponent(query)}&count=5&search_lang=en&text_decorations=false`);
        for (const r of (data?.web?.results || []).slice(0, 5)) {
          if (out.some((x) => x.url === r.url)) continue;
          out.push({ title: r.title || '', snippet: r.description || (r.extra_snippets || [])[0] || '', source: host(r), url: r.url || '', age: r.age || '' });
        }
      } catch (e) { console.warn('brave web failed:', e.message); }
    }
    return out;
  };
}

module.exports = { makeSearch };
