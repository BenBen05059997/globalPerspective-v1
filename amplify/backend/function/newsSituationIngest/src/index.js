'use strict';

// newsSituationIngest — the NEWS producer (S3, DATA_STRATEGY.md). Hourly:
//   1. fetch RSS headlines (world news)
//   2. classify each in batches on the flash model (deepseek-v4-flash) → iso3/latlon/axis/severity
//   3. deterministically cluster into STORIES (outlets, velocity, spread)
//   4. write corpus/YYYY/MM/DD/HH.jsonl (classified articles) + stories/state/<id>.json + stories/index.json
// The tracker (S3·T3) reads stories/index and opens situations for significant stories → the map's
// conflict/political/economic hues. Decoupled from the 4h editorial run. Daily LLM cap enforced.

const core = require('./classifier-core');
const { buildMessages, parseClassification, normalizeClassified, clusterStories, slug } = core;

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const MODEL = process.env.GROK_MODEL || 'deepseek-v4-flash';
const API_KEY = process.env.XAI_API_KEY;
const API_BASE = (process.env.GROK_API_URL || 'https://api.deepseek.com').replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
const BATCH = Number(process.env.CLASSIFY_BATCH) || 35;
const MAX_BATCHES = Number(process.env.MAX_BATCHES_PER_RUN) || 12; // ≤ ~420 articles/run
const CONCURRENCY = Number(process.env.CLASSIFY_CONCURRENCY) || 4; // parallel LLM calls (else 300s timeout)
const MAX_AGE_H = Number(process.env.MAX_AGE_HOURS) || 36;
const METRIC_NS = 'GlobalPerspective/Situations';

const RSS_FEEDS = [
  { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc.com' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'aljazeera.com' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', source: 'france24.com' },
  { name: 'SCMP', url: 'http://www.scmp.com/rss/91/feed/', source: 'scmp.com' },
  { name: 'The Diplomat', url: 'https://thediplomat.com/feed/', source: 'thediplomat.com' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', source: 'npr.org' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', source: 'theguardian.com' },
  { name: 'DW English', url: 'https://rss.dw.com/rdf/rss-en-all', source: 'dw.com' },
  { name: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', source: 'allafrica.com' },
  { name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', source: 'middleeasteye.net' },
  { name: 'Al-Monitor', url: 'https://www.al-monitor.com/rss', source: 'al-monitor.com' },
  { name: 'CNA', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', source: 'channelnewsasia.com' },
  { name: 'Reuters(GN)', url: 'https://news.google.com/rss/search?q=when:24h+world&hl=en-US&gl=US&ceid=US:en', source: 'news.google.com' },
  { name: 'ABC Australia', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', source: 'abc.net.au' },
];

let _s3, _cw;
function s3() { if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); } return _s3; }
function cw() { if (!_cw) { const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch'); _cw = new CloudWatchClient({ region: REGION }); } return _cw; }

// ── RSS (trimmed from newsInvokeGemini) ──────────────────────────────────────
const ENTS = { '&amp;': '&', '&apos;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&#39;': "'", '&#8217;': '’', '&#8216;': '‘', '&#8220;': '“', '&#8221;': '”', '&#8230;': '…', '&#8211;': '–', '&#8212;': '—' };
function decodeEntities(s) {
  return String(s || '').replace(/&(?:amp|apos|quot|lt|gt|nbsp|#39|#8217|#8216|#8220|#8221|#8230|#8211|#8212);/g, (m) => ENTS[m] || m).replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return _; } });
}
function parseRss(xml, source) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const c = m[1];
    const tt = c.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    let title = tt ? tt[1] : ''; title = decodeEntities(title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim());
    const lk = c.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    let url = lk ? lk[1] : ''; url = url.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const dd = c.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    let description = dd ? dd[1] : ''; description = decodeEntities(description.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').slice(0, 220).trim());
    const pd = c.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let ageH = 0;
    if (pd) { const tms = new Date(pd[1].trim()).getTime(); if (!isNaN(tms)) ageH = (Date.now() - tms) / 3.6e6; }
    if (title && url) out.push({ title, url, description, source, ageH });
  }
  return out;
}
async function fetchRss() {
  const results = await Promise.allSettled(RSS_FEEDS.map(async (f) => {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(f.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'GlobalPerspectives/1.0' }, signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) return [];
      return parseRss(await r.text(), f.source).slice(0, 30);
    } catch { clearTimeout(to); return []; }
  }));
  const all = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  const seen = new Set();
  return all.filter((a) => a.ageH <= MAX_AGE_H && !seen.has(a.url) && seen.add(a.url));
}

// ── classify one batch via the flash model (raw fetch, OpenAI-compatible) ─────
async function classifyBatch(articles) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    // DeepSeek V4 defaults to thinking mode, which burns max_tokens on invisible reasoning and
    // returns empty content (finish_reason=length). Disable it — same guard as newsInvokeGemini.
    body: JSON.stringify({ model: MODEL, messages: buildMessages(articles), temperature: 0, response_format: { type: 'json_object' }, max_tokens: 8192, thinking: { type: 'disabled' } }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const j = await res.json();
  const raw = parseClassification(j.choices?.[0]?.message?.content);
  const byN = new Map(raw.map((r) => [Number(r.n), r]));
  return articles.map((a, i) => normalizeClassified(byN.get(i + 1) || raw[i] || {}, a)).filter(Boolean);
}

// ── I/O ──────────────────────────────────────────────────────────────────────
async function getJson(key) {
  try { const { GetObjectCommand } = require('@aws-sdk/client-s3'); const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key })); return JSON.parse(await r.Body.transformToString()); }
  catch (e) { if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404 || e.$metadata?.httpStatusCode === 403) return null; throw e; }
}
async function putObj(key, body, contentType) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: typeof body === 'string' ? body : JSON.stringify(body), ContentType: contentType || 'application/json' }));
}
async function putMetric(name, value) {
  try { const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch'); await cw().send(new PutMetricDataCommand({ Namespace: METRIC_NS, MetricData: [{ MetricName: name, Value: value, Unit: 'Count' }] })); } catch (e) { console.warn('[ingest] metric', name, e.message); }
}
const storyKey = (id) => id.replace(/[^A-Za-z0-9._-]/g, '_');

exports.handler = async () => {
  if (!API_KEY) { console.error('[ingest] no XAI_API_KEY'); return { ok: false, error: 'no api key' }; }
  const now = new Date().toISOString();
  const articles = await fetchRss();
  console.log(`[ingest] ${articles.length} fresh articles`);
  const batches = [];
  for (let i = 0; i < articles.length && batches.length < MAX_BATCHES; i += BATCH) batches.push(articles.slice(i, i + BATCH));

  const classified = [];
  let llmCalls = 0;
  // Parallel LLM calls (bounded) — sequential blew the 300s timeout.
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const wave = batches.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(wave.map((b) => classifyBatch(b)));
    for (const r of settled) {
      if (r.status === 'fulfilled') { classified.push(...r.value); llmCalls++; }
      else console.warn('[ingest] batch failed:', r.reason?.message);
    }
  }
  console.log(`[ingest] classified ${classified.length} in ${llmCalls} LLM calls`);

  const prevIndex = (await getJson('stories/index.json')) || {};
  const prevById = {};
  for (const s of prevIndex.stories || []) prevById[s.storyId] = s;
  const allStories = clusterStories(classified, now, prevById);
  // Persist only stories worth surfacing (≥2 outlets or severity ≥3); the rest stay in corpus.
  // Keeps stories/state bounded and gives the tracker a clean significant set.
  const stories = allStories.filter((s) => s.outlets >= 2 || s.max_severity >= 3).slice(0, 80);

  // corpus (append-only hourly), stories/state, stories/index
  const hk = now.slice(0, 13).replace(/[:T-]/g, '/');
  await putObj(`corpus/${hk.slice(0, 10)}/${now.slice(11, 13)}.jsonl`, classified.map((c) => JSON.stringify(c)).join('\n'), 'application/x-ndjson');
  await Promise.all(stories.map((s) => putObj(`stories/state/${storyKey(s.storyId)}.json`, s)));
  await putObj('stories/index.json', { updated_at: now, count: stories.length, stories: stories.map((s) => ({ storyId: s.storyId, axis: s.axis, category: s.category, title: s.title, iso3: s.iso3, centroid: s.centroid, max_severity: s.max_severity, outlets: s.outlets, velocity: s.velocity, spread_new_iso3: s.spread_new_iso3, first_seen: s.first_seen, last_seen: s.last_seen, entities: s.entities, headlines: (s.headlines || []).slice(0, 3) })) });

  await Promise.all([putMetric('IngestArticles', classified.length), putMetric('IngestStories', stories.length), putMetric('ClassifierLLMCallsToday', llmCalls)]);
  const top = stories.slice(0, 5).map((s) => `${s.title} [${s.axis} sev${s.max_severity} ${s.outlets}o]`);
  const result = { ok: true, articles: articles.length, classified: classified.length, llmCalls, stories: stories.length, top };
  console.log(`[ingest] ${JSON.stringify(result)}`);
  return result;
};

exports._internal = { parseRss, storyKey };
