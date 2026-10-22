'use strict';

// Raw capture (foundation review rule 1, draft decision 0040): before any model call, every item the run fetched is
// appended to the inbox, so a model outage never loses the day. The selector is the only writer of
// record/inbox/articles/ (decision 0038 amendment, the "inbox" pattern); the facts writer later turns the lines into facts.
//   record/inbox/articles/YYYY-MM-DD.jsonl         (shadow: record/shadow/inbox/articles/YYYY-MM-DD.jsonl)
// Day = UTC day of publishedAt, else of fetchedAt. One line per rawId = sha1(canonical url); a later run that sees the
// same url skips it (appendLines keeps the stored line). Fenced: a failure is logged and never blocks the run.

const { canonicalUrl, sha1 } = require('./_shared/record');
const { getOutletMeta } = require('./_shared/outlets');

const INBOX_PREFIX = 'record/inbox/articles';
const SHADOW_PREFIX = 'record/shadow/inbox/articles';
const WRITE_TIMEOUT_MS = 30000;

/** The inbox line of one fetched article (null when it has no url). */
function rawLine(article, fetchedAt) {
  const url = String(article && article.url || '').trim();
  if (!url) return null;
  const canonical = canonicalUrl(url);
  const meta = getOutletMeta(article.source);
  return {
    schemaVersion: 1,
    rawId: sha1(canonical || url),
    url,
    canonicalUrl: canonical,
    title: String(article.title || ''),
    outlet: (meta && meta.outlet) || null,
    feed: article.feed || null,
    publishedAt: article.publishedAt || null,
    fetchedAt,
    snippet: article.description ? String(article.description) : null,
    lang: article.lang || null,
  };
}

/** Group lines by their day: UTC date of publishedAt, else of fetchedAt. -> Map day -> lines. */
function groupByDay(lines) {
  const days = new Map();
  for (const l of lines) {
    const day = (l.publishedAt || l.fetchedAt).slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(l);
  }
  return days;
}

/**
 * Append the run's articles to the inbox day files. `s3json` is makeS3Json(...) (injected: tests pass a fake client).
 * Never throws. -> { ok, lines, days, appended, error? }.
 */
async function captureRawArticles({ articles, s3json, now = new Date(), shadow = false, log = console }) {
  try {
    const fetchedAt = now.toISOString();
    const lines = (articles || []).map((a) => rawLine(a, fetchedAt)).filter(Boolean);
    if (!lines.length) return { ok: true, lines: 0, days: 0, appended: 0 };
    const prefix = shadow ? SHADOW_PREFIX : INBOX_PREFIX;
    const days = groupByDay(lines);
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`raw capture timed out after ${WRITE_TIMEOUT_MS} ms`)), WRITE_TIMEOUT_MS); });
    const write = (async () => {
      let appended = 0;
      for (const [day, dayLines] of [...days.entries()].sort()) {
        const res = await s3json.appendLines(`${prefix}/${day}.jsonl`, dayLines, { idKey: 'rawId' });
        appended += res.appended;
      }
      return appended;
    })();
    write.catch(() => {}); // a late failure after the timeout must not become an unhandled rejection
    let appended;
    try { appended = await Promise.race([write, timeout]); } finally { clearTimeout(timer); }
    log.log(`[raw-capture] ${lines.length} items, ${appended} new, ${days.size} day file(s) under ${prefix}/`);
    return { ok: true, lines: lines.length, days: days.size, appended };
  } catch (e) {
    log.warn(`[raw-capture] failed (non-fatal, the run continues): ${e && e.message}`);
    return { ok: false, error: e && e.message };
  }
}

module.exports = { captureRawArticles, rawLine, groupByDay, INBOX_PREFIX, SHADOW_PREFIX };
