'use strict';

// Recovery of a missed day's raw articles from public records, no model (decision 0040 rule 2). Pure helpers, the GDELT / Wayback
// fetchers and the line shapes. Used by the newsRecover Lambda (src/index.js) and by the operator CLI (backend/record/cli/recover-day.mjs,
// which re-exports these names through cli/recover-lib.mjs). Moved here from the CLI so both run one copy.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { canonicalUrl, sha1 } = require('./_shared/record.js');
const { getOutletMeta, registrableDomain } = require('./_shared/outlets.js');
const { parseRssXml, decodeEntities } = require('./_shared/rss.js');

// selector-source.js is a symlink to the ingest Lambda's index.js (scripts/lambda.sh follows symlinks, so the zip carries the text):
// the feed list has one copy.
const SELECTOR_INDEX = path.join(__dirname, 'selector-source.js');
const GDELT_MAX = 250;

/** The selector's RSS_FEEDS ([{name,url,source}]), read from its source text: requiring index.js would pull in the AWS SDK. */
function readFeeds(file = SELECTOR_INDEX) {
  const text = fs.readFileSync(file, 'utf8');
  const feeds = [];
  for (const m of text.matchAll(/\{\s*name:\s*'([^']+)',\s*url:\s*'([^']+)',\s*source:\s*'([^']+)'\s*\}/g)) feeds.push({ name: m[1], url: m[2], source: m[3] });
  return feeds;
}

/** Extra hosts GDELT files an outlet under (BBC articles live on bbc.com and bbc.co.uk). */
const DOMAIN_ALIASES = { 'bbc.com': ['bbc.co.uk'] };

/** The domains to query: every feed's source, once. -> [{ domain, outlet, domains: [domain, ...aliases] }]. */
function gdeltTargets(feeds) {
  const seen = new Set();
  const out = [];
  for (const f of feeds) {
    if (seen.has(f.source)) continue;
    seen.add(f.source);
    out.push({ domain: f.source, outlet: (getOutletMeta(f.source) || {}).outlet || null, domains: [f.source, ...(DOMAIN_ALIASES[f.source] || [])] });
  }
  return out;
}

const compact = (d) => d.replace(/-/g, '');
/** GDELT DOC 2.0 article-list URL. `from`/`to` are 'YYYYMMDDHHMMSS' (default: the whole UTC day). Parameters per
 *  https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ (STARTDATETIME/ENDDATETIME, MAXRECORDS, MODE, FORMAT; domainis: and sourcelang: operators). */
function gdeltUrl(domains, day, { from, to, englishOnly = true } = {}) {
  const list = [].concat(domains);
  const dom = list.map((d) => `domainis:${d}`).join(' OR ');
  const q = `${list.length > 1 ? `(${dom})` : dom}${englishOnly ? ' sourcelang:english' : ''}`;
  const p = new URLSearchParams({ query: q, mode: 'artlist', format: 'json', maxrecords: String(GDELT_MAX), startdatetime: from || `${compact(day)}000000`, enddatetime: to || `${compact(day)}235959` });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${p.toString().replace(/\+/g, '%20')}`;
}

/** GDELT's `seendate` ('20260920T063000Z') -> ISO, or null. */
function seendateIso(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(s || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
}

/** The DOC API answers a rate limit or an error with plain text and an empty window with `{}`. -> articles[]; throws on non-JSON. */
function parseGdeltDoc(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('GDELT answered an empty body (rate limit or outage; not treated as an empty day)');
  let j;
  try { j = JSON.parse(t); } catch (e) { throw new Error(`GDELT answered non-JSON: ${t.slice(0, 120)}`); }
  return Array.isArray(j && j.articles) ? j.articles : [];
}

const LANG = { english: 'en', french: 'fr', german: 'de', spanish: 'es', portuguese: 'pt', arabic: 'ar', russian: 'ru', chinese: 'zh', japanese: 'ja', korean: 'ko' };

function outletFor(host) {
  const meta = getOutletMeta(host) || getOutletMeta(registrableDomain(host));
  return (meta && meta.outlet) || null;
}

function baseLine({ url, title, publishedAt, lang, feed, now, recoveredFrom, host }) {
  const canonical = canonicalUrl(url);
  return {
    schemaVersion: 1,
    rawId: sha1(canonical || url),
    url,
    canonicalUrl: canonical,
    title,
    outlet: outletFor(host || url),
    feed,
    publishedAt,
    fetchedAt: now,
    snippet: null,
    lang,
    recoveredAt: now,
    recoveredFrom,
  };
}

/** One GDELT DOC article -> inbox line (null without url or title). publishedAt is GDELT's seendate, day precision (rule 1). */
function gdeltLine(a, now) {
  const url = String(a && a.url || '').trim();
  const title = String(a && a.title || '').replace(/\s+/g, ' ').trim();
  if (!url || !title) return null;
  const lang = a.language ? (LANG[String(a.language).toLowerCase()] || String(a.language).toLowerCase()) : null;
  return { ...baseLine({ url, title, publishedAt: seendateIso(a.seendate), lang, feed: 'gdelt-doc', now, recoveredFrom: 'gdelt-doc', host: a.domain || url }), precision: 'day' };
}

/** CDX search URL for one feed and day (JSON output, status 200 only). */
function cdxUrl(feedUrl, day) {
  const d = compact(day);
  return `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(feedUrl)}&from=${d}&to=${d}&output=json&filter=statuscode:200`;
}
const snapshotUrl = (timestamp, feedUrl) => `https://web.archive.org/web/${timestamp}id_/${feedUrl}`;

/** CDX JSON (first row is the header) -> [{ timestamp, original, digest }], identical digests collapsed (same bytes, nothing new to parse). */
function parseCdx(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  let rows;
  try { rows = JSON.parse(t); } catch (e) { throw new Error(`CDX answered non-JSON: ${t.slice(0, 120)}`); }
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const head = rows[0];
  const ix = (k) => head.indexOf(k);
  const seen = new Set();
  const out = [];
  for (const r of rows.slice(1)) {
    const digest = r[ix('digest')];
    if (digest && seen.has(digest)) continue;
    seen.add(digest);
    out.push({ timestamp: r[ix('timestamp')], original: r[ix('original')], digest });
  }
  return out;
}

/** A feed snapshot's items published on `day` (UTC) -> inbox lines. Items outside the day or without a date are dropped:
 *  the day file holds the day's articles, and a snapshot also lists the days around it. */
function waybackLines(xml, feed, day, now) {
  const out = [];
  for (const a of parseRssXml(xml, feed.source, Date.parse(now))) {
    if (!a.publishedAt || a.publishedAt.slice(0, 10) !== day) continue;
    out.push(baseLine({ url: a.url, title: a.title, publishedAt: a.publishedAt, lang: a.lang || null, feed: feed.name, now, recoveredFrom: 'wayback-rss', host: feed.source }));
  }
  return out;
}

/** Merge line groups in priority order, first rawId wins. `existing` is the day's current inbox (kept untouched, never rewritten).
 *  -> { lines (new ones only), dupes: { source: n } }. */
function dedupeLines(groups, existing = []) {
  const seen = new Set(existing.map((l) => l.rawId));
  const lines = [];
  const dupes = {};
  for (const g of groups) {
    for (const l of g) {
      const src = l.recoveredFrom;
      if (seen.has(l.rawId)) { dupes[src] = (dupes[src] || 0) + 1; continue; }
      seen.add(l.rawId);
      lines.push(l);
    }
  }
  return { lines, dupes };
}

/** Counts per source and per outlet (outlet null -> 'unknown'). */
function tally(lines) {
  const bySource = {};
  const byOutlet = {};
  for (const l of lines) {
    bySource[l.recoveredFrom] = (bySource[l.recoveredFrom] || 0) + 1;
    const o = l.outlet || 'unknown';
    byOutlet[o] = byOutlet[o] || {};
    byOutlet[o][l.recoveredFrom] = (byOutlet[o][l.recoveredFrom] || 0) + 1;
  }
  return { bySource, byOutlet };
}

/** Days from..to inclusive, 'YYYY-MM-DD'. */
function dayRange(from, to = from) {
  for (const d of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || new Date(d).toISOString().slice(0, 10) !== d) throw new Error(`bad day ${d}, use YYYY-MM-DD`);
  if (from > to) throw new Error('--to is before --day');
  const days = [];
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 86400000) days.push(new Date(ms).toISOString().slice(0, 10));
  return days;
}

/** Halve a GDELT window ('YYYYMMDDHHMMSS' pair) for a query that hit the 250 cap. null when it is already 15 minutes or less. */
function splitWindow(from, to) {
  const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
  const fmt = (t) => new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const a = ms(from), b = ms(to);
  if (b - a <= 15 * 60000) return null;
  const mid = Math.floor((a + b) / 2);
  return [[from, fmt(mid)], [fmt(mid + 1000), to]];
}


// ---- GDELT GKG 2.1 raw files (the primary GDELT source: static downloads, no rate limit) ----

/** The day's 96 quarter-hour GKG file URLs (https://data.gdeltproject.org/gdeltv2/YYYYMMDDHHMMSS.gkg.csv.zip). */
function gkgFileUrls(day) {
  const d = compact(day);
  const out = [];
  for (let h = 0; h < 24; h += 1) for (let m = 0; m < 60; m += 15) out.push(`https://data.gdeltproject.org/gdeltv2/${d}${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00.gkg.csv.zip`);
  return out;
}

/** The content of the first entry of a zip buffer (stored or deflate), read through the central directory (the local header's
 *  sizes can be 0 when a data descriptor follows). No dependency: node:zlib only. Throws on a malformed zip. */
function unzipFirst(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a zip: no end-of-central-directory record');
  let cd = buf.readUInt32LE(e + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip: bad central directory');
  const method = buf.readUInt16LE(cd + 10);
  const csize = buf.readUInt32LE(cd + 20);
  const lho = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('zip: bad local header');
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error(`zip: unsupported method ${method}`);
}

const gkgIso = (s) => (/^\d{14}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}.000Z` : null);

/** One GKG 2.1 file (text) -> { rows, rowsOurs, lines }. Keeps rows whose source domain is a target domain (exact or subdomain),
 *  whose V2.1DATE falls on `day` (UTC) and that have a PAGE_TITLE. Fields (0-based): 1 V2.1DATE, 3 V2SOURCECOMMONNAME, 4 V2DOCUMENTIDENTIFIER, 26 V2EXTRASXML. */
function parseGkg(text, targets, day, now) {
  const doms = [];
  for (const t of targets) for (const d of t.domains || [t.domain]) doms.push(d);
  const ours = (host) => doms.some((d) => host === d || host.endsWith(`.${d}`));
  const dayCompact = compact(day);
  let rows = 0;
  let rowsOurs = 0;
  const lines = [];
  for (const row of String(text).split('\n')) {
    if (!row) continue;
    rows += 1;
    const f = row.split('\t');
    const host = String(f[3] || '').trim().toLowerCase();
    if (!host || !ours(host)) continue;
    const date = String(f[1] || '');
    if (date.slice(0, 8) !== dayCompact) continue;
    rowsOurs += 1;
    const url = String(f[4] || '').trim();
    const m = /<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/.exec(f[26] || '');
    const title = m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
    if (!url || !title) continue;
    lines.push({ ...baseLine({ url, title, publishedAt: gkgIso(date), lang: null, feed: 'gdelt-gkg', now, recoveredFrom: 'gdelt-gkg', host }), precision: 'day' });
  }
  return { rows, rowsOurs, lines };
}


// ---- network: polite fetcher and the per-source recoveries ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const THROTTLED = /429|limit requests/i;
const COOLDOWN_AFTER = 3;
const COOLDOWN_MS = 600000;

/** Polite fetch: at least `gapMs` between two requests to one host, retry 429/5xx/network errors with backoff.
 *  429 backoff is 60 s doubling to a 10 min cap (GDELT's limiter lasts minutes); after 3 consecutive 429s (any URL)
 *  it sleeps a 10 min cool-down instead of burning the remaining retries. A thrown error carries `.status`.
 *  `fetchText(url, { binary: true })` returns a Buffer (the GKG zips). */
function makeFetcher({ gapMs = {}, defaultGapMs = 1000, retries = 6, fetchImpl = fetch, log = console, sleepImpl = sleep, cooldownMs = COOLDOWN_MS } = {}) {
  const last = new Map();
  let streak = 0;
  return async function fetchText(url, { binary = false } = {}) {
    const host = new URL(url).host;
    const gap = gapMs[host] ?? defaultGapMs;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const wait = (last.get(host) || 0) + gap - Date.now();
      if (wait > 0) await sleepImpl(wait);
      last.set(host, Date.now());
      try {
        const res = await fetchImpl(url, { headers: { 'user-agent': 'globalperspective-recovery/1 (operator script)' }, signal: AbortSignal.timeout(60000) });
        if (res.status === 429 || res.status >= 500) { lastErr = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }); }
        else if (!res.ok) { throw Object.assign(new Error(`HTTP ${res.status}`), { final: true, status: res.status }); }
        else { streak = 0; return binary ? Buffer.from(await res.arrayBuffer()) : await res.text(); }
      } catch (e) {
        if (e.final) throw e;
        lastErr = e;
      }
      const is429 = lastErr.status === 429;
      streak = is429 ? streak + 1 : 0;
      if (attempt < retries) {
        let back;
        if (is429 && streak >= COOLDOWN_AFTER) { back = cooldownMs; streak = 0; log.warn(`  ${COOLDOWN_AFTER} consecutive 429s: cool-down ${back / 1000}s`); }
        else back = is429 ? Math.min(COOLDOWN_MS, 60000 * 2 ** attempt) : Math.min(60000, 5000 * 2 ** attempt);
        log.warn(`  retry ${attempt + 1}/${retries} in ${back / 1000}s: ${host} ${lastErr.message}`);
        await sleepImpl(back);
      }
    }
    throw lastErr;
  };
}

/** GDELT GKG 2.1 raw files (primary GDELT source): the day's 96 quarter-hour zips, `concurrency` at a time. A 404 is a missing
 *  quarter (recorded, not fatal); any other failure after the fetcher's retries is a failed file. status: ok (all 96 read),
 *  partial (some missing/failed), failed (no file read). */
async function recoverGkg({ targets, day, fetchBuf, now, concurrency = 4, log = console }) {
  const urls = gkgFileUrls(day);
  const results = new Array(urls.length);
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      const file = urls[i].split('/').pop();
      try {
        const r = parseGkg(unzipFirst(await fetchBuf(urls[i], { binary: true })).toString('utf8'), targets, day, now);
        results[i] = { state: 'ok', ...r };
      } catch (e) {
        if (e.status === 404) results[i] = { state: 'missing' };
        else { results[i] = { state: 'failed' }; failures.push({ source: 'gdelt-gkg', file, error: e.message }); }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  const lines = [];
  const g = { status: 'ok', filesOk: 0, filesMissing: 0, filesFailed: 0, rows: 0, rowsOurs: 0 };
  for (const r of results) {
    if (r.state === 'ok') { g.filesOk += 1; g.rows += r.rows; g.rowsOurs += r.rowsOurs; lines.push(...r.lines); }
    else if (r.state === 'missing') g.filesMissing += 1;
    else g.filesFailed += 1;
  }
  g.status = g.filesOk === 0 ? 'failed' : (g.filesMissing || g.filesFailed ? 'partial' : 'ok');
  log.log(`  gkg ${g.status}: ${g.filesOk}/${urls.length} files, ${g.filesMissing} missing, ${g.filesFailed} failed, ${g.rows} rows, ${g.rowsOurs} ours, ${lines.length} with a title`);
  return { lines, failures, gkg: g };
}

/** GDELT DOC API: every target domain for the day. Windows that return the 250 cap are halved (down to 15 minutes).
 *  Per domain: ok (articles), zero (every window answered a parsed JSON body, none had articles), failed (a window
 *  failed and was not recovered; a domain that failed once and then answered 0 on the retry pass is still failed). */
async function recoverGdelt({ targets, day, fetchText, now, englishOnly = true, split = true, log = console, retryPassWaitMs = 60000, sleepImpl = sleep }) {
  const lines = [];
  const perDomain = {};
  const runTarget = async (t) => {
    const failures = [];
    const queue = [[`${day.replace(/-/g, '')}000000`, `${day.replace(/-/g, '')}235959`]];
    let n = 0;
    while (queue.length) {
      const [from, to] = queue.shift();
      let arts;
      try { arts = parseGdeltDoc(await fetchText(gdeltUrl(t.domains, day, { from, to, englishOnly }))); } catch (e) { failures.push({ source: 'gdelt-doc', domain: t.domain, window: `${from}-${to}`, error: e.message }); continue; }
      const halves = split && arts.length >= 250 ? splitWindow(from, to) : null;
      if (halves) { queue.push(...halves); continue; }
      for (const a of arts) { const l = gdeltLine(a, now); if (l) { lines.push(l); n += 1; } }
    }
    perDomain[t.domain] = (perDomain[t.domain] || 0) + n;
    return failures;
  };
  const domainStatus = {};
  const failedOnce = [];
  for (const t of targets) {
    const f = await runTarget(t);
    log.log(`  gdelt ${t.domain}: ${perDomain[t.domain]}${f.length ? ` (${f.length} window(s) failed)` : ''}`);
    if (f.length) failedOnce.push({ t, f }); else domainStatus[t.domain] = perDomain[t.domain] > 0 ? 'ok' : 'zero';
  }
  // One more pass over the domains that failed (GDELT's rate limiter often clears after a pause); what still fails is reported.
  const failures = [];
  if (failedOnce.length) {
    log.log(`  retrying ${failedOnce.length} failed domain(s) once after ${retryPassWaitMs / 1000}s`);
    await sleepImpl(retryPassWaitMs);
    for (const { t, f: first } of failedOnce) {
      const before = perDomain[t.domain];
      const f = await runTarget(t);
      const got = perDomain[t.domain] - before;
      if (f.length) { domainStatus[t.domain] = 'failed'; failures.push(...f); log.log(`  gdelt ${t.domain} (retry): still failing`); }
      else if (got > 0) { domainStatus[t.domain] = 'ok'; log.log(`  gdelt ${t.domain} (retry): ${perDomain[t.domain]}`); }
      else { domainStatus[t.domain] = 'failed'; failures.push(...first.map((x) => ({ ...x, error: `${x.error} (retry answered 0, not trusted)` }))); log.log(`  gdelt ${t.domain} (retry): 0 after a failure, counted as failed`); }
    }
  }
  return { lines, failures, perDomain, domainStatus, gdelt: gdeltSummary(targets, domainStatus, failures) };
}

/** The manifest's gdelt block. throttled: no domain returned a body and every failure looks like the rate limiter;
 *  failed: no domain returned a body for another reason; partial: some domains failed. */
function gdeltSummary(targets, domainStatus, failures) {
  const vals = targets.map((t) => domainStatus[t.domain]);
  const domainsOk = vals.filter((x) => x === 'ok').length;
  const domainsZero = vals.filter((x) => x === 'zero').length;
  const domainsFailed = vals.filter((x) => x === 'failed').length;
  let status = 'ok';
  if (domainsFailed) {
    if (domainsOk + domainsZero > 0) status = 'partial';
    else status = failures.every((f) => THROTTLED.test(f.error)) ? 'throttled' : 'failed';
  }
  return { status, domainsOk, domainsZero, domainsFailed };
}

/** Wayback: the day's snapshots of each feed, parsed with the selector's parser. `deadline` (epoch ms, optional): a feed not started by
 *  then is not read and is listed in `failures` (the Lambda has a time limit; the operator CLI passes none). */
async function recoverWayback({ feeds, day, fetchText, now, log = console, deadline = null }) {
  const lines = [];
  const failures = [];
  const perFeed = {};
  for (const f of feeds) {
    if (deadline && Date.now() > deadline) { failures.push({ source: 'wayback-rss', target: f.name, error: 'time budget used before this feed' }); continue; }
    let snaps;
    try { snaps = parseCdx(await fetchText(cdxUrl(f.url, day))); } catch (e) { failures.push({ source: 'wayback-rss', target: `${f.name} cdx`, error: e.message }); perFeed[f.name] = { snapshots: 0, lines: 0 }; continue; }
    let n = 0;
    for (const s of snaps) {
      try { const got = waybackLines(await fetchText(snapshotUrl(s.timestamp, s.original)), f, day, now); lines.push(...got); n += got.length; } catch (e) { failures.push({ source: 'wayback-rss', target: `${f.name} ${s.timestamp}`, error: e.message }); }
    }
    perFeed[f.name] = { snapshots: snaps.length, lines: n };
    log.log(`  wayback ${f.name}: ${snaps.length} snapshot(s), ${n} item(s) on the day`);
  }
  return { lines, failures, perFeed };
}


module.exports = {
  SELECTOR_INDEX,
  parseRssXml,
  GDELT_MAX,
  readFeeds,
  gdeltTargets,
  gdeltUrl,
  seendateIso,
  parseGdeltDoc,
  gdeltLine,
  cdxUrl,
  snapshotUrl,
  parseCdx,
  waybackLines,
  dedupeLines,
  tally,
  dayRange,
  splitWindow,
  gkgFileUrls,
  unzipFirst,
  parseGkg,
  makeFetcher,
  recoverGkg,
  recoverGdelt,
  gdeltSummary,
  recoverWayback,
};
