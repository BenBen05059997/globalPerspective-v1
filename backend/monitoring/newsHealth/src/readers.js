'use strict';

// The readers panel (monitoring/ops.json `readers`). Pure: the Cloudflare rows and the own-table counts come in as arguments.
// Facts only: no token -> { status: 'not_connected' }, a failed pull -> { status: 'error', error }, no number is ever filled in.
const { READERS } = require('./config');
const { lastDays, dayOf } = require('./days');
const { round } = require('./pricing');
const { KEYS } = require('./config');
const { pullCloudflare } = require('./cloudflare');

const errText = (e) => String((e && e.message) || e).slice(0, 200);

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const byViews = (a, b) => b.views - a.views;

/** '/weekly/thread/abc?x=1/' -> '/weekly/thread/abc'. */
function normalizePath(p) {
  let s = String(p || '/').split(/[?#]/)[0];
  if (!s.startsWith('/')) s = `/${s}`;
  return s.length > 1 ? s.replace(/\/+$/, '') || '/' : s;
}

/** Page family id of a request path (the table is READERS.families). */
function familyOf(path) {
  const p = normalizePath(path);
  for (const f of READERS.families) {
    if (f.exact.includes(p) || f.prefix.some((x) => p === x || p.startsWith(`${x}/`))) return f.id;
  }
  return READERS.otherFamily.id;
}

const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** rows from pullCloudflare, days = the 14 UTC days, titles = { threadId: title } -> the `cloudflare` section with status 'ok'. */
function summarize({ pages, referrers, countries }, days, titles, pulledAt) {
  const fam = [...READERS.families, READERS.otherFamily].map((f) => ({ id: f.id, label: f.label, excluded: Boolean(f.excludedFromTotals), views: 0, days: days.map(() => 0) }));
  const famById = Object.fromEntries(fam.map((f) => [f.id, f]));
  const stories = new Map(); const countryPages = new Map();
  for (const r of pages) {
    const i = days.indexOf(String(r.date).slice(0, 10));
    if (i < 0) continue;
    const path = normalizePath(r.path);
    const f = famById[familyOf(path)];
    f.views += r.views; f.days[i] += r.views;
    if (f.id === 'stories' && path.startsWith(READERS.storyPrefix)) { const id = decode(path.slice(READERS.storyPrefix.length)); stories.set(id, (stories.get(id) || 0) + r.views); }
    if (f.id === 'countries' && path.startsWith(READERS.countryPrefix)) { const c = decode(path.slice(READERS.countryPrefix.length)); countryPages.set(c, (countryPages.get(c) || 0) + r.views); }
  }
  const counted = fam.filter((f) => !f.excluded);
  const top = (m, key) => [...m].map(([k, views]) => ({ [key]: k, views })).sort(byViews).slice(0, READERS.topN);
  // Referrers and visitor countries come from their own queries (all paths, ops included); they are not split by family.
  const merge = (rows, key) => { const m = new Map(); for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + r.views); return m; };
  return {
    status: 'ok', pulledAt, from: days[0], to: days[days.length - 1], days,
    totals: { views: sum(counted.map((f) => f.views)), opsViews: famById.ops.views },
    families: fam,
    topStories: top(stories, 'threadId').map((s) => ({ ...s, title: titles[s.threadId] || null })),
    topCountryPages: top(countryPages, 'country'),
    visitorCountries: top(merge(countries.filter((c) => c.country), 'country'), 'country'),
    referrers: top(merge(referrers.filter((r) => r.host), 'host'), 'host'),
    directViews: sum(referrers.filter((r) => !r.host).map((r) => r.views)),
  };
}

/** Counts of ISO timestamps per UTC day in `days`, the total of all rows, and how many rows carry no date. */
function countByDay(stamps, days) {
  const perDay = Object.fromEntries(days.map((d) => [d, 0]));
  let undated = 0;
  for (const s of stamps) {
    if (!s) { undated += 1; continue; }
    const d = String(s).slice(0, 10);
    if (d in perDay) perDay[d] += 1;
  }
  return { total: stamps.length, undated, days: days.map((date) => ({ date, count: perDay[date] })) };
}

/** Raw projections from the three tables -> counts only. userCreated/shareCreated: createdAt strings (or null); savedKeys: savedKey strings. */
function ownCounts({ userCreated, savedKeys, shareCreated }, days) {
  const byType = {};
  for (const k of savedKeys) { const t = String(k || '').split('#')[0] || 'unknown'; byType[t] = (byType[t] || 0) + 1; }
  const boards = byType.board || 0;
  delete byType.board;
  return {
    status: 'ok',
    users: countByDay(userCreated, days),
    boards: { total: boards },
    saved: { total: sum(Object.values(byType)), byType },
    shares: countByDay(shareCreated, days),
  };
}

/**
 * Attention vs effort. A Lambda's model spend over the window is split evenly across its features; a feature belongs to at most one
 * family, so a family's effort is the sum of those shares. dsDays = ops.deepseek.days. Lambdas with no feature (or only `ops`) cost nothing here.
 * -> [{ id, label, views, usd, lambdas:[{fn, usd}] }] in family order; views null when Cloudflare is not connected; usd null when no spend data.
 */
function attention(cfFamilies, dsDays, window) {
  const spend = new Map(); let any = false;
  for (const d of dsDays) {
    if (!window.includes(d.date) || d.usd == null) continue;
    any = true;
    for (const l of d.lines || []) if (l.usd != null) spend.set(l.fn, (spend.get(l.fn) || 0) + l.usd);
  }
  return READERS.families.filter((f) => !f.excludedFromTotals).map((f) => {
    const lambdas = [];
    for (const [fn, feats] of Object.entries(READERS.lambdaFeatures)) {
      const share = feats.filter((x) => f.features.includes(x)).length / feats.length;
      const usd = (spend.get(fn) || 0) * share;
      if (share > 0 && usd > 0) lambdas.push({ fn, usd: round(usd, 4) });
    }
    lambdas.sort((a, b) => b.usd - a.usd);
    const cf = cfFamilies ? cfFamilies.find((x) => x.id === f.id) : null;
    return { id: f.id, label: f.label, views: cf ? cf.views : null, usd: any ? round(sum(lambdas.map((l) => l.usd)), 4) : null, lambdas };
  });
}

/** True when a pull is due: nothing pulled today yet, or the last Cloudflare answer was not 'ok' (retry hourly; not_connected costs no call). */
function readersPullDue(prev, now) {
  const r = prev && prev.readers;
  if (!r || !r.pulledAt || r.pulledAt.slice(0, 10) < dayOf(now)) return true;
  return !r.cloudflare || r.cloudflare.status !== 'ok';
}

const NOTE = 'Cloudflare Web Analytics counts page loads in browsers that run its beacon. It has no user identity, so the counts include our own testing, and there is no way to exclude it in this source. Attention vs effort: a Lambda\'s DeepSeek spend over the 14 days is split evenly across the features it serves (scripts/functions.json); AWS cost is not included.';

/**
 * pull: null when not due this run (the earlier sections stay), else
 *   { cloudflare: summary | {status:'not_connected'} | {status:'error', error}, own: ownCounts | {status:'error', error}, pulledAt }.
 */
function buildReaders({ pull, prev, dsDays, now }) {
  const p = (prev && prev.readers) || {};
  const cloudflare = pull ? pull.cloudflare : p.cloudflare || { status: 'not_connected' };
  const own = pull ? pull.own : p.own || { status: 'error', error: 'not pulled yet' };
  return {
    asOf: new Date(now).toISOString(),
    pulledAt: pull ? pull.pulledAt : p.pulledAt || null,
    note: NOTE,
    cloudflare,
    own,
    attention: attention(cloudflare.status === 'ok' ? cloudflare.families : null, dsDays || [], lastDays(now, 14)),
  };
}

/** thread id -> title from record/views/index/all.json; {} when the index cannot be read (the panel then shows ids). */
async function storyTitles(aws) {
  try {
    const r = await aws.readText(KEYS.storyIndex);
    const stories = r ? JSON.parse(r.text).stories || [] : [];
    return Object.fromEntries(stories.filter((s) => s.threadId && s.title).map((s) => [s.threadId, s.title]));
  } catch { return {}; }
}

/**
 * The daily pull. env.CF_ANALYTICS_TOKEN missing -> cloudflare not_connected (no call). Own tables are read either way.
 * aws.ownRows() -> { userCreated, savedKeys, shareCreated } (projections only). Never throws: each part reports its own error.
 */
async function pullReaders({ aws, now, days, env = process.env, fetchFn = fetch }) {
  const pulledAt = new Date(now).toISOString();
  const token = env.CF_ANALYTICS_TOKEN;
  const cfPart = async () => {
    if (!token) return { status: 'not_connected' };
    try { return summarize(await pullCloudflare({ token, days, now, fetchFn }), days, await storyTitles(aws), pulledAt); } catch (e) { return { status: 'error', error: errText(e) }; }
  };
  const ownPart = async () => {
    try { return ownCounts(await aws.ownRows(), days); } catch (e) { return { status: 'error', error: errText(e) }; }
  };
  const [cloudflare, own] = await Promise.all([cfPart(), ownPart()]);
  return { cloudflare, own, pulledAt };
}

module.exports = { pullReaders, storyTitles, familyOf, normalizePath, summarize, ownCounts, countByDay, attention, buildReaders, readersPullDue };
