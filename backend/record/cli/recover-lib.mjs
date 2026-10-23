// Pure helpers of the recovery script (no network, no AWS): feed list, URL builders, parsers, line shape, dedupe.
// Decision 0040 rule 2. The network and S3 parts live in recover-day.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { canonicalUrl, sha1 } = require('../../shared/src/record.js');
const { getOutletMeta, registrableDomain } = require('../../shared/src/outlets.js');
export const { parseRssXml } = require('../../shared/src/rss.js');

export const SELECTOR_INDEX = path.join(HERE, '../../pipeline/newsInvokeGemini/src/index.js');
export const GDELT_MAX = 250;

/** The selector's RSS_FEEDS ([{name,url,source}]), read from its source text: requiring index.js would pull in the AWS SDK. */
export function readFeeds(file = SELECTOR_INDEX) {
  const text = fs.readFileSync(file, 'utf8');
  const feeds = [];
  for (const m of text.matchAll(/\{\s*name:\s*'([^']+)',\s*url:\s*'([^']+)',\s*source:\s*'([^']+)'\s*\}/g)) feeds.push({ name: m[1], url: m[2], source: m[3] });
  return feeds;
}

/** Extra hosts GDELT files an outlet under (BBC articles live on bbc.com and bbc.co.uk). */
const DOMAIN_ALIASES = { 'bbc.com': ['bbc.co.uk'] };

/** The domains to query: every feed's source, once. -> [{ domain, outlet, domains: [domain, ...aliases] }]. */
export function gdeltTargets(feeds) {
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
export function gdeltUrl(domains, day, { from, to, englishOnly = true } = {}) {
  const list = [].concat(domains);
  const dom = list.map((d) => `domainis:${d}`).join(' OR ');
  const q = `${list.length > 1 ? `(${dom})` : dom}${englishOnly ? ' sourcelang:english' : ''}`;
  const p = new URLSearchParams({ query: q, mode: 'artlist', format: 'json', maxrecords: String(GDELT_MAX), startdatetime: from || `${compact(day)}000000`, enddatetime: to || `${compact(day)}235959` });
  return `https://api.gdeltproject.org/api/v2/doc/doc?${p.toString().replace(/\+/g, '%20')}`;
}

/** GDELT's `seendate` ('20260920T063000Z') -> ISO, or null. */
export function seendateIso(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(s || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
}

/** The DOC API answers a rate limit or an error with plain text and an empty window with `{}`. -> articles[]; throws on non-JSON. */
export function parseGdeltDoc(text) {
  const t = String(text || '').trim();
  if (!t) return [];
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
export function gdeltLine(a, now) {
  const url = String(a && a.url || '').trim();
  const title = String(a && a.title || '').replace(/\s+/g, ' ').trim();
  if (!url || !title) return null;
  const lang = a.language ? (LANG[String(a.language).toLowerCase()] || String(a.language).toLowerCase()) : null;
  return { ...baseLine({ url, title, publishedAt: seendateIso(a.seendate), lang, feed: 'gdelt-doc', now, recoveredFrom: 'gdelt-doc', host: a.domain || url }), precision: 'day' };
}

/** CDX search URL for one feed and day (JSON output, status 200 only). */
export function cdxUrl(feedUrl, day) {
  const d = compact(day);
  return `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(feedUrl)}&from=${d}&to=${d}&output=json&filter=statuscode:200`;
}
export const snapshotUrl = (timestamp, feedUrl) => `https://web.archive.org/web/${timestamp}id_/${feedUrl}`;

/** CDX JSON (first row is the header) -> [{ timestamp, original, digest }], identical digests collapsed (same bytes, nothing new to parse). */
export function parseCdx(text) {
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
export function waybackLines(xml, feed, day, now) {
  const out = [];
  for (const a of parseRssXml(xml, feed.source, Date.parse(now))) {
    if (!a.publishedAt || a.publishedAt.slice(0, 10) !== day) continue;
    out.push(baseLine({ url: a.url, title: a.title, publishedAt: a.publishedAt, lang: a.lang || null, feed: feed.name, now, recoveredFrom: 'wayback-rss', host: feed.source }));
  }
  return out;
}

/** Merge line groups in priority order, first rawId wins. `existing` is the day's current inbox (kept untouched, never rewritten).
 *  -> { lines (new ones only), dupes: { source: n } }. */
export function dedupeLines(groups, existing = []) {
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
export function tally(lines) {
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
export function dayRange(from, to = from) {
  for (const d of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || new Date(d).toISOString().slice(0, 10) !== d) throw new Error(`bad day ${d}, use YYYY-MM-DD`);
  if (from > to) throw new Error('--to is before --day');
  const days = [];
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 86400000) days.push(new Date(ms).toISOString().slice(0, 10));
  return days;
}

/** Halve a GDELT window ('YYYYMMDDHHMMSS' pair) for a query that hit the 250 cap. null when it is already 15 minutes or less. */
export function splitWindow(from, to) {
  const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
  const fmt = (t) => new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const a = ms(from), b = ms(to);
  if (b - a <= 15 * 60000) return null;
  const mid = Math.floor((a + b) / 2);
  return [[from, fmt(mid)], [fmt(mid + 1000), to]];
}
