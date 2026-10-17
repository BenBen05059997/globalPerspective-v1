#!/usr/bin/env node
// P6 Jev story-selection backtest, v2 (plan: project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md).
// Read-only on AWS (S3 corpus + DynamoDB archive via the AWS CLI). Spends Jev tokens (operator-approved 2026-10-17).
//
//   node predictions/jev-backtest/run.mjs --dry     # build candidates + matching only, no Jev calls
//   node predictions/jev-backtest/run.mjs           # call Jev (cached in results.json), write REPORT / REVIEW files
//
// Secret: the Jev key is read in-process from ~/.config/globalperspective/jev.key and never printed or written.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const { clusterStories, normalizeEntity } = createRequire(import.meta.url)(path.join(REPO, 'amplify/backend/function/newsSituationIngest/src/classifier-core.js'));

const BUCKET = 's3://globalperspective-world-280362093938';
const AWS_ENV = { ...process.env, AWS_REGION: 'ap-northeast-1', AWS_DEFAULT_REGION: 'ap-northeast-1' };
const CORPUS_CACHE = path.join(os.tmpdir(), 'jev-backtest-corpus');
const RESULTS = path.join(HERE, 'results.json'); // per-candidate Jev answers, keyed by sha1(state) + run summaries
const DRY = process.argv.includes('--dry');
const FIRST_DAY = '2026-09-30', LAST_DAY = '2026-10-17';
const SKIP_DAYS = new Set(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']); // DeepSeek outage: no selections
const WINDOW_H = 8, LATER_H = 72, JACCARD = 0.3, MAX_PER_COUNTRY = 2, EARLY_OUTLETS = 4, CONCURRENCY = 4, BUDGET_USD = 0.95, USD_PER_M = 0.042, SEED = 20261017;
const MUST_HAVE = ['climate', 'science', 'society', 'energy', 'business']; // selection prompt rule 7
// classifier category (classifier-core.js) -> the selection prompt's 12 categories; 'other' falls back to the axis
const CATEGORY = { war: 'conflict', unrest: 'society', diplomacy: 'politics', election: 'politics', policy: 'politics', economy: 'economy', markets: 'economy', disaster: 'disaster', health: 'health', tech: 'technology' };
const AXIS_CATEGORY = { conflict: 'conflict', political: 'politics', economic: 'economy', humanitarian: 'society' };

// ---------- small helpers ----------
const aws = (...args) => execFileSync('aws', args, { env: AWS_ENV, maxBuffer: 1 << 28, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const unmarshall = (v) => { const [k, x] = Object.entries(v)[0]; return k === 'S' ? x : k === 'N' ? +x : k === 'BOOL' ? x : k === 'NULL' ? null : k === 'L' ? x.map(unmarshall) : k === 'M' ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, unmarshall(b)])) : x; };
const rng = (() => { let s = SEED; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
const sum = (a) => a.reduce((s, x) => s + x, 0);
const days = () => { const out = []; for (let t = Date.parse(FIRST_DAY); t <= Date.parse(LAST_DAY); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out.filter((d) => !SKIP_DAYS.has(d)); };

const TRACKING = /^(utm_|at_|ocid|cmpid|ref$|src$|taid|fbclid|ito$|xtor|cid$)/i;
function urlKey(u) {
  try {
    const x = new URL(String(u).replace(/&amp;/g, '&')); x.hash = '';
    for (const k of [...x.searchParams.keys()]) if (TRACKING.test(k)) x.searchParams.delete(k);
    return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search).toLowerCase();
  } catch { return String(u).toLowerCase(); }
}
const tokens = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const containment = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.min(a.size, b.size); };

// ---------- data: archive (what we published) and corpus (candidates) ----------
function loadRuns() {
  const runs = new Map();
  for (const d of days()) {
    const out = aws('dynamodb', 'get-item', '--table-name', 'NewsCache', '--key', JSON.stringify({ id: { S: `archive#${d}` } }), '--output', 'json');
    const item = JSON.parse(out).Item;
    if (!item) continue;
    for (const e of unmarshall(item.entries)) {
      if (!runs.has(e.generationId)) runs.set(e.generationId, { gen: e.generationId, time: new Date(Number(e.generationId.split('-')[1])), topics: [] });
      runs.get(e.generationId).topics.push({ title: e.title, category: e.category, regions: e.regions || [], iso3: e.iso3 || [], threadId: e.threadId, urls: (e.sources || []).map((s) => s.url) });
    }
  }
  return [...runs.values()].sort((a, b) => a.time - b.time);
}

function syncCorpus() { // one parallel sync of the needed days into CORPUS_CACHE (same layout as S3)

  const inc = ['09', '10'].flatMap((m) => [`${m}/*`]);
  aws('s3', 'sync', `${BUCKET}/corpus/2026/`, path.join(CORPUS_CACHE, '2026'), '--only-show-errors', '--exclude', '*', ...inc.flatMap((i) => ['--include', i]), '--exclude', '09/0*', '--exclude', '09/1*', '--exclude', '09/2[0-8]/*');

}
function corpusFile(t) { // t: Date at the hour; returns articles or [] when the hour file is missing
  const f = path.join(CORPUS_CACHE, t.toISOString().slice(0, 13).replace(/-/g, '/').replace('T', '/') + '.jsonl');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

// ---------- candidates: clusterStories groups, merged into stories ----------
const storyId = (a) => clusterStories([a], '')[0]?.storyId || null; // the clusterer's own key for one article (null = it drops the article)
const eligible = (a) => a.kind === 'event' && storyId(a); // code pre-filter: events only, plus clusterStories' own axis / severity>=2 / iso3 / latlon rules
const jaccard = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n || 1); };

function mkCand(items, ids) { // one story from classified articles
  const bySev = items.slice().sort((a, b) => b.severity - a.severity);
  const top = bySev[0], seen = new Set(), headlines = [];
  for (const i of bySev) if (!seen.has(i.domain) && headlines.length < 3) { seen.add(i.domain); headlines.push(`${i.en_title || i.title} (${i.domain})`); }
  return {
    ids, items, title: top.en_title || top.title, primary: top.iso3[0], iso3: [...new Set(items.flatMap((i) => i.iso3))], outlets: new Set(items.map((i) => i.domain)).size, articles: items.length,
    severity: top.severity, axis: top.axis, category: CATEGORY[top.category] || AXIS_CATEGORY[top.axis], headlines, urls: new Set(items.map((i) => urlKey(i.url))),
    toks: items.map((i) => tokens(i.en_title || i.title)), ents: new Set(items.map((i) => normalizeEntity(i.entities[0])).filter(Boolean)),
  };
}
// Same story: same primary country AND (a shared lead entity OR title-token Jaccard >= 0.3). Used to merge fragments and to match later coverage.
const same = (a, b) => a.primary === b.primary && ([...a.ents].some((e) => b.ents.has(e)) || a.toks.some((x) => b.toks.some((y) => jaccard(x, y) >= JACCARD)));
function mergeCands(cands) { // union-find over `same`; returns merged candidates
  const parent = cands.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  cands.forEach((a, i) => { for (let j = i + 1; j < cands.length; j++) if (same(a, cands[j])) parent[find(j)] = find(i); });
  const groups = new Map();
  cands.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  return [...groups.values()].map((g) => (g.length === 1 ? g[0] : mkCand(g.flatMap((c) => c.items), g.flatMap((c) => c.ids))));
}
{ // unit-style asserts for the merge
  const art = (t, iso, ent, dom) => ({ en_title: t, title: t, domain: dom, iso3: [iso], severity: 3, entities: ent ? [ent] : [], url: `https://${dom}/${t}`, axis: 'conflict', category: 'war' });
  const m = mergeCands([
    mkCand([art('Floods hit northern province hard', 'IND', '', 'a.com')], ['1']), mkCand([art('Floods hit northern province again', 'IND', '', 'b.com')], ['2']),
    mkCand([art('Parliament passes budget', 'IND', 'Narendra Modi', 'c.com')], ['3']), mkCand([art('Modi visits plant', 'IND', 'Narendra Modi', 'd.com')], ['4']),
    mkCand([art('Floods hit northern province hard', 'FRA', '', 'e.com')], ['5']), mkCand([art('Central bank cuts rates', 'IND', 'RBI', 'f.com')], ['6']),
  ]);
  assert.deepEqual(m.map((c) => c.ids.slice().sort().join('+')).sort(), ['1+2', '3+4', '5', '6']);
  assert.equal(m.find((c) => c.ids.includes('1')).outlets, 2);
}

function buildCandidates(run) {
  const hourStart = new Date(Math.floor(run.time / 36e5) * 36e5);
  const hour = (h) => corpusFile(new Date(+hourStart + h * 36e5));
  const byUrl = new Map();
  for (let h = 1; h <= WINDOW_H; h++) for (const a of hour(-h)) byUrl.set(a.url, a);
  const articles = [...byUrl.values()], events = articles.filter(eligible);
  const groups = new Map();
  for (const a of events) { const id = storyId(a); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(a); }
  const clusters = [...groups].map(([id, items]) => mkCand(items, [id]));
  const cands = mergeCands(clusters);
  const articleUrls = new Set(articles.map((a) => urlKey(a.url)));
  const hasLater = hour(LATER_H).length > 0; // hindsight needs the corpus 72h after the run
  if (hasLater) { // later coverage: distinct outlets of NEW articles (not in the pre-run window) that are the same story
    const later = new Map();
    for (let h = 1; h <= LATER_H; h++) for (const a of hour(h)) if (!articleUrls.has(urlKey(a.url)) && !later.has(a.url) && eligible(a)) later.set(a.url, mkCand([a], []));
    for (const c of cands) c.later = new Set([...later.values()].filter((x) => same(c, x)).map((x) => x.items[0].domain)).size;
  }
  return { cands, articleUrls, nArticles: articles.length, nEvents: events.length, nClusters: clusters.length, hasLater };
}

// ---------- GDACS: the situations tracker's history[] gives each event's alert level over time ----------
function loadGdacs() {
  const dir = path.join(CORPUS_CACHE, 'sit');
  for (const d of ['archive', 'state']) aws('s3', 'sync', `${BUCKET}/situations/${d}/`, path.join(dir, d), '--only-show-errors', '--exclude', '*', '--include', 'gdacs_*');
  return ['archive', 'state'].flatMap((d) => fs.readdirSync(path.join(dir, d)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, d, f), 'utf8'))));
}
function gdacsCands(sits, t) { // events whose alert level at time t is Red or Orange (the feed has no population field)
  return sits.flatMap((s) => {
    const level = s.history.filter((h) => Date.parse(h.at) <= t).pop()?.level;
    if (!['Red', 'Orange'].includes(level) || (s.closed_at && Date.parse(s.closed_at) <= t)) return [];
    return [{ ids: [s.situationId], items: [], title: s.title, primary: s.iso3_origin[0] || s.iso3_affected[0], iso3: s.iso3_affected, outlets: 0, articles: 0, severity: 0, category: 'disaster', gdacs: level,
      headlines: [s.verb_label, s.evidence.gdacs_description], urls: new Set(), toks: [tokens(s.title)], ents: new Set() }];
  });
}

// published topic -> candidates it overlaps (by source URL; fallback title containment >= 0.5)
function matchTopics(topics, cands) {
  for (const t of topics) {
    const keys = t.urls.map(urlKey);
    t.overlap = cands.filter((c) => keys.some((k) => c.urls.has(k)));
    if (!t.overlap.length) {
      const tt = tokens(t.title);
      const best = cands.map((c) => ({ c, s: Math.max(...c.toks.map((x) => containment(tt, x))) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s)[0];
      if (best) t.overlap = [best.c];
    }
    t.best = t.overlap.slice().sort((a, b) => keys.filter((k) => b.urls.has(k)).length - keys.filter((k) => a.urls.has(k)).length || b.outlets - a.outlets)[0] || null;
  }
}

// ---------- Jev: only what the story scan cannot know ----------
const QUESTIONS = {
  impact: { type: 'score', instructions: 'How far do the consequences of this story reach beyond the country where it happens (lives, markets, security, policy, how people live, work, eat, move or breathe)?', criteria: ['Local only: no consequence beyond the country of origin', 'Neighbouring countries or one sector are affected', 'Several countries or an industry are affected', 'Wide regional or cross-border consequences for people, markets or security', 'Global: worldwide consequences'] },
  new_since_last_brief: { type: 'noul', instructions: 'The state lists headlines already covered in the previous 24 hours. Is this story a materially new development, rather than a repeat of one of them?', criteria: { true: 'Yes: a materially new development, or not covered before', false: 'No: the same development already covered, or a rewording of it' } },
};
const store = { model: null, answers: {}, usage: { input_tokens: 0, calls: 0 }, latencyMs: [], ...(fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : {}) };
const spent = () => (store.usage.input_tokens * USD_PER_M) / 1e6;
const key = fs.existsSync(path.join(os.homedir(), '.config/globalperspective/jev.key')) ? fs.readFileSync(path.join(os.homedir(), '.config/globalperspective/jev.key'), 'utf8').trim() : null;
const stateOf = (c, covered) => [`Story: ${c.title}`, `Coverage: ${c.gdacs ? 'GDACS disaster alert feed (outlets n/a)' : `${c.outlets} distinct outlet(s), ${c.articles} article(s)`}`, `Countries: ${c.iso3.join(', ') || 'unspecified'}`,
  `Severity: ${c.gdacs ? `GDACS ${c.gdacs} alert` : `${c.severity} of 5`}`, 'Headlines:', ...c.headlines.map((h) => `- ${h}`), 'Already covered in the previous 24h:', ...(covered.length ? covered.map((t) => `- ${t}`) : ['- (nothing)'])].join('\n');
const hashOf = (state) => crypto.createHash('sha1').update(state + JSON.stringify(QUESTIONS)).digest('hex');

async function jev(state) {
  const h = hashOf(state);
  if (store.answers[h]) return;
  if (spent() > BUDGET_USD) throw new Error(`Jev budget guard hit ($${spent().toFixed(3)})`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const t0 = Date.now();
    const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state, questions: QUESTIONS }), signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 599 }));
    if (r.status === 429 || r.status === 529 || r.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    if (!r.ok) throw new Error(`Jev ${r.status}`);
    const j = await r.json();
    store.model = j.model; store.usage.input_tokens += j.usage.input_tokens; store.usage.calls++; store.latencyMs.push(Date.now() - t0);
    store.answers[h] = { impact: j.answers.impact.score + 1, nw: j.answers.new_since_last_brief.noul };
    return;
  }
  throw new Error('Jev retries exhausted');
}
async function pool(items, fn) { let i = 0, done = 0; await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) { await fn(items[i++]); if (++done % 200 === 0) { fs.writeFileSync(RESULTS, JSON.stringify(store)); console.log(`  ${done}/${items.length} spent $${spent().toFixed(3)}`); } } })); }

// ---------- selection (one function) ----------
// Drops: new_since_last_brief < 0.4, already picked in the previous 24h (soft dedup), < 2 outlets unless severity 5 or GDACS. Rank: impact, tie outlets.
// One reserved slot for the best GDACS Red event (outside the quotas). Selector rule 7: no category above 25% (rounded up), >= 1 each of MUST_HAVE when
// a candidate with impact >= 3 exists. Our interpretation of the prompt's "regional diversity": at most 2 picks per primary country (not a stated rule).
function select(scored, n, seen) {
  const cap = Math.ceil(0.25 * n), cat = {}, cty = {}, picks = [];
  const pool_ = scored.filter((s) => s.nw >= 0.4 && !seen(s.c) && (s.c.gdacs || s.c.outlets >= 2 || s.c.severity === 5)).sort((a, b) => b.impact - a.impact || b.c.outlets - a.c.outlets);
  const slot = pool_.find((s) => s.c.gdacs === 'Red');
  if (slot) picks.push(slot);
  const ok = (s) => picks.length < n && !picks.includes(s) && (cat[s.c.category] || 0) < cap && (cty[s.c.primary] || 0) < MAX_PER_COUNTRY;
  const add = (s) => { picks.push(s); cat[s.c.category] = (cat[s.c.category] || 0) + 1; cty[s.c.primary] = (cty[s.c.primary] || 0) + 1; };
  for (const k of MUST_HAVE) { const s = pool_.find((x) => x.c.category === k && x.impact >= 3 && ok(x)); if (s) add(s); }
  for (const s of pool_) if (ok(s)) add(s);
  return picks;
}

// ---------- main ----------
syncCorpus();
const sits = loadGdacs();
let runs = loadRuns().filter((r) => r.topics.length);
console.log(`${runs.length} archive runs over ${new Set(runs.map((r) => r.time.toISOString().slice(0, 10))).size} days; ${sits.length} GDACS situations`);
const v1 = JSON.parse(fs.readFileSync(path.join(HERE, 'v1_picks.json'), 'utf8')); // v1 picks (from the v1 script's cached Jev answers), re-matched into this run's merged candidates
const prepared = runs.map((run) => ({ run, ...buildCandidates(run) })).filter((p) => p.cands.length); // drops a run whose corpus hours do not exist (2026-09-30 02:15)
const droppedRuns = runs.length - prepared.length;
runs = prepared.map((p) => p.run);
for (const p of prepared) {
  p.gdacs = gdacsCands(sits, +p.run.time);
  p.cands.push(...p.gdacs);
  matchTopics(p.run.topics, p.cands);
  const v1topics = (v1.find((x) => x.gen === p.run.gen)?.picks || []).map((x) => ({ title: x.title, urls: x.urls }));
  matchTopics(v1topics, p.cands);
  p.picks = { ours: [...new Set(p.run.topics.map((t) => t.best).filter(Boolean))], v1: [...new Set(v1topics.map((t) => t.best).filter(Boolean))] };
  p.covered = runs.filter((r) => r.time < p.run.time && p.run.time - r.time < 864e5).flatMap((r) => r.topics.map((t) => t.title)); // what we published in the previous 24h
  p.toScore = p.cands.filter((c) => c.gdacs || c.outlets >= 2 || c.severity === 5); // the outlet rule is applied in code, so Jev is not asked about stories it would drop anyway
}
const nTopics = sum(runs.map((r) => r.topics.length)), nMatched = sum(prepared.map((p) => p.run.topics.filter((t) => t.best).length));
console.log(`articles/run ${Math.round(sum(prepared.map((p) => p.nArticles)) / prepared.length)} -> events ${Math.round(sum(prepared.map((p) => p.nEvents)) / prepared.length)} -> clusters ${Math.round(sum(prepared.map((p) => p.nClusters)) / prepared.length)} -> merged stories ${Math.round(sum(prepared.map((p) => p.cands.length - p.gdacs.length)) / prepared.length)} -> to score ${Math.round(sum(prepared.map((p) => p.toScore.length)) / prepared.length)}; topics matched ${nMatched}/${nTopics}; max merged size ${Math.max(...prepared.flatMap((p) => p.cands.map((c) => c.ids.length)))}`);
console.log(`hindsight runs ${prepared.filter((p) => p.hasLater).length}; runs with GDACS Red ${prepared.filter((p) => p.gdacs.some((c) => c.gdacs === 'Red')).length}, Orange ${prepared.filter((p) => p.gdacs.some((c) => c.gdacs === 'Orange')).length}`);

// sanity check: latest run vs the selector's real captured input
let capture = null;
try {
  const cap = JSON.parse(aws('s3', 'cp', `${BUCKET}/audit/ingest-capture/latest.json`, '-', '--only-show-errors'));
  const p = prepared.find((x) => x.run.gen === cap.generationId);
  if (p) { const ck = cap.input.map((a) => urlKey(a.url)); capture = { gen: cap.generationId, inputCount: cap.input.length, inCorpusWindow: ck.filter((k) => p.articleUrls.has(k)).length, candidates: p.cands.length, articles: p.nArticles }; }
} catch { /* capture is optional */ }

const todo = [...new Map(prepared.flatMap((p) => p.toScore.map((c) => stateOf(c, p.covered))).map((s) => [hashOf(s), s]))].filter(([h]) => !store.answers[h]).map(([, s]) => s);
console.log(`to score ${todo.length} states, average ${todo.length ? Math.round(sum(todo.map((s) => s.length)) / todo.length / 4) : 0} tokens (est.)`);
if (DRY) process.exit(0);
console.log('scoring with Jev...');
await pool(todo, jev);
fs.writeFileSync(RESULTS, JSON.stringify(store));
console.log(`Jev model ${store.model}, input tokens ${store.usage.input_tokens}, $${spent().toFixed(3)}`);

// ---------- per-run selection ----------
const got = (side, p, S, hours = 72, maxOutlets = Infinity) => prepared.some((q) => +p.run.time - +q.run.time >= 0 && +p.run.time - +q.run.time < hours * 36e5 && (q.picks[side] || []).some((P) => !P.gdacs && P.outlets < maxOutlets && (P === S || same(S, P))));
for (const p of prepared) {
  p.scored = p.toScore.map((c) => ({ c, ...store.answers[hashOf(stateOf(c, p.covered))] }));
  p.picks.jev = select(p.scored, p.run.topics.length, (c) => got('jev', p, c, 24)).map((s) => s.c);
  p.picks.base = p.cands.filter((c) => !c.gdacs && !got('base', p, c, 24)).sort((a, b) => b.outlets - a.outlets || b.articles - a.articles).slice(0, p.run.topics.length);
}

// ---------- metrics ----------
const SIDES = { ours: 'Ours (published)', v1: 'Jev v1', jev: 'Jev v2', base: 'Baseline: top N by outlets' };
const real = (p, side) => p.picks[side].filter((c) => !c.gdacs);
const hind = prepared.filter((p) => p.hasLater);
const hindsight = (side, thr) => {
  const big = hind.flatMap((p) => p.cands.filter((c) => !c.gdacs && c.later >= thr).map((c) => [p, c]));
  const picks = hind.flatMap((p) => real(p, side));
  return { big: big.length, recall: sum(big.map(([p, c]) => got(side, p, c))), early: sum(big.map(([p, c]) => got(side, p, c, 72, EARLY_OUTLETS))), picks: picks.length, dead: picks.filter((c) => c.later <= 2).length };
};
const hs = Object.fromEntries(Object.keys(SIDES).map((s) => [s, { 8: hindsight(s, 8), 5: hindsight(s, 5) }]));
const bigMisses = (side) => sum(prepared.map((p) => p.cands.filter((c) => !c.gdacs && (c.outlets >= 8 || c.severity === 5) && !got(side, p, c, 24)).length));
const oursCovered = (side) => sum(prepared.map((p) => p.run.topics.filter((t) => t.overlap.some((c) => p.picks[side].includes(c))).length));
const dist = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const fmtDist = (d) => d.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
const cats = (side) => dist(prepared.flatMap((p) => (side === 'ours' ? p.run.topics.map((t) => t.category) : p.picks[side].map((c) => c.category))));
const ctys = (side) => dist(prepared.flatMap((p) => (side === 'ours' ? p.run.topics.map((t) => t.iso3[0]) : p.picks[side].map((c) => c.primary))).filter(Boolean));
const scoredAll = prepared.flatMap((p) => p.scored);
const lat = store.latencyMs.slice().sort((a, b) => a - b);
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sideRows = (f) => Object.entries(SIDES).map(([s, name]) => [name, ...f(s)]);
const runLabel = (p) => p.run.time.toISOString().slice(0, 16).replace('T', ' ');

// review sheet: one Jev-only pick vs one ours-only topic from the same run, 20 runs sampled, order randomized
const jevOnly = (p) => p.picks.jev.filter((c) => !p.run.topics.some((t) => t.overlap.includes(c)));
const oursOnly = (p) => p.run.topics.filter((t) => t.best && !p.picks.jev.includes(t.best) && !t.overlap.some((c) => p.picks.jev.includes(c)));
const rank = new Map(prepared.flatMap((p) => p.scored.map((s) => [s.c, s.impact])));
const sample = shuffle(prepared.filter((p) => jevOnly(p).length && oursOnly(p).length)).slice(0, 20);
const show = (c) => [`**${c.title}**`, `- Outlets: ${c.gdacs ? 'n/a (GDACS alert feed)' : `${c.outlets} (${c.articles} articles)`}; severity: ${c.gdacs ? `GDACS ${c.gdacs} alert` : `${c.severity} of 5`}; countries: ${c.iso3.join(', ') || 'n/a'}`, ...c.headlines.map((h) => `- ${h}`)].join('\n');
const key_ = []; const sheet = ['# Review sheet: which story belongs in the brief?', '', 'For each pair, both stories were available in the same selection window. Pick the one an analyst would rather see in the brief (or "equal"). Sides are not labelled.', ''];
sample.forEach((p, i) => {
  const jv = jevOnly(p).sort((a, b) => (rank.get(b) || 0) - (rank.get(a) || 0))[0];
  const ou = shuffle(oursOnly(p))[0];
  const flip = rng() < 0.5;
  sheet.push(`## Pair ${i + 1}`, '', '### Option 1', show(flip ? jv : ou.best), '', '### Option 2', show(flip ? ou.best : jv), '', 'Your pick: ____', '');
  key_.push({ pair: i + 1, run: p.run.gen, option1: flip ? 'jev' : 'ours', option2: flip ? 'ours' : 'jev', ourTitle: ou.title, jevScore: +(rank.get(jv) || 0).toFixed(2) });
});
fs.writeFileSync(path.join(HERE, 'REVIEW_SHEET.md'), sheet.join('\n'));
fs.writeFileSync(path.join(HERE, 'REVIEW_KEY.json'), JSON.stringify(key_, null, 2));

const examples = prepared.flatMap((p) => jevOnly(p).map((c) => ({ p, c, impact: rank.get(c) || 0 }))).sort((a, b) => b.impact - a.impact).slice(0, 5);
const days_ = [...new Set(runs.map((r) => r.time.toISOString().slice(0, 10)))];
const avg = (f) => Math.round(sum(prepared.map(f)) / prepared.length);
const gd = (lvl) => prepared.filter((p) => p.gdacs.some((c) => c.gdacs === lvl)).length;
const slotPicks = sum(prepared.map((p) => p.picks.jev.filter((c) => c.gdacs === 'Red').length)), orangePicks = sum(prepared.map((p) => p.picks.jev.filter((c) => c.gdacs === 'Orange').length));
const nwLow = scoredAll.filter((s) => s.nw < 0.4).length;
fs.writeFileSync(path.join(HERE, 'REPORT.md'), [
  '# Jev story-selection backtest (P6), v2', '',
  `Generated by predictions/jev-backtest/run.mjs. Jev model: **${store.model}**. v1 (single "publish" question on raw clusters) is kept as a column; its picks are in v1_picks.json.`, '',
  `## Hindsight: did the story become big? (${hind.length} runs whose following 72h is in the corpus)`,
  'A story "became big" if distinct outlets publishing the same story (same primary country and a shared lead entity or title-token Jaccard >= 0.3) in NEW articles over the 72h after the run reach the threshold. Recall = share of became-big stories the side picked in that run or the previous 72h. Early recall counts only picks made while the story had < 4 outlets. Dead picks = picks that never got more than 2 outlets in the next 72h. Units are (run, story) pairs, so a story that stays big is counted in each run where it is a candidate; GDACS picks are excluded (no outlet count).', '',
  tbl(['Selector', 'Picks scored', 'Dead picks', 'Recall (>=8)', 'Early recall (>=8)', 'Recall (>=5)', 'Early recall (>=5)'], sideRows((s) => [hs[s][8].picks, pct(hs[s][8].dead, hs[s][8].picks), pct(hs[s][8].recall, hs[s][8].big), pct(hs[s][8].early, hs[s][8].big), pct(hs[s][5].recall, hs[s][5].big), pct(hs[s][5].early, hs[s][5].big)])),
  `Became-big units: ${hs.ours[8].big} at >= 8 outlets, ${hs.ours[5].big} at >= 5.`, '',
  '## v1 vs v2 vs baseline (all runs)',
  tbl(['Selector', 'Overlap with ours (topics covered)', 'Big-event misses', 'Category spread', 'Primary country spread'], sideRows((s) => [s === 'ours' ? 'n/a' : `${oursCovered(s)}/${nMatched} (${pct(oursCovered(s), nMatched)})`, bigMisses(s), fmtDist(cats(s)), `${new Set(ctys(s).map((x) => x[0])).size} countries: ${fmtDist(ctys(s))}`])),
  'Big-event miss = a candidate story with >= 8 outlets or severity 5 that the side did not pick in the run or the previous 24h, computed after merging. v1 picks are matched into the v2 merged candidates by source URL (a v1 pick made only of non-event articles has no match and is not counted). Category: ours is the LLM selector\'s category, the others use the classifier category mapped to the selector\'s list (the classifier cannot output climate, science, energy, business or military, so those quotas can only be met by what the mapping yields).', '',
  '## Method',
  '- Runs: every newsInvokeGemini run (04:15, 12:15, 20:15 UTC) that left entries in DynamoDB NewsCache archive#YYYY-MM-DD, grouped by generationId. N = topics we published.',
  `- Candidates: corpus hour files for the ${WINDOW_H} hours before the run, deduped by url. Code pre-filter: kind = event, and clusterStories' own axis / severity >= 2 / iso3 / latlon rules. Remaining articles are grouped with clusterStories, then MERGED: clusters of one run are one story when they share a primary country and (a shared lead entity or title-token Jaccard >= ${JACCARD}). Covered by asserts in run.mjs.`,
  '- Jev state: headline, distinct outlets and articles, countries, severity, up to 3 headlines from different outlets, and the titles we published in the previous 24h. Two questions per call: `impact` (5 levels, consequences beyond the country of origin) and `new_since_last_brief`. Category comes from the classifier (table in run.mjs), not from Jev. Stories that the code outlet rule would drop (< 2 outlets, not severity 5, not GDACS) are not sent to Jev.',
  `- Picking (code): drop new_since_last_brief < 0.4, drop stories picked in the previous 24h, require >= 2 outlets unless severity 5 or GDACS, rank by impact (tie: outlets), one pick per merged story, category cap 25% (rounded up), >= 1 each of ${MUST_HAVE.join('/')} when impact >= 3, at most ${MAX_PER_COUNTRY} per primary country (our interpretation of the prompt's "regional diversity", not a stated rule), one reserved slot for the best GDACS Red event outside the quotas.`,
  '- GDACS: the feed has no history. Alert level per run is reconstructed from the situations tracker (S3 situations/archive and situations/state, history[] of levels over time); Red = reserved slot candidate, Orange = ordinary candidate (category disaster, outlets n/a, exempt from the 2-outlet rule). The feed has no affected-population field, so no population rule is applied. Both are scored by Jev like the rest.',
  '- Baseline: top N merged stories by current distinct-outlet count, with the same 24h dedup and no quotas.',
  '- Matching published topics to candidates: shared source URL (tracking params stripped); fallback title-token containment >= 0.5. Unmatched topics are excluded from overlap and hindsight.', '',
  '## Data coverage and filter effect',
  `- ${runs.length} runs over ${days_.length} days (${days_[0]} to ${days_[days_.length - 1]}; 2026-10-12 to 10-15 skipped, DeepSeek outage; ${droppedRuns} further run(s) dropped for lack of corpus hours). Published topics ${nTopics}, matched ${nMatched} (${pct(nMatched, nTopics)}).`,
  `- Per run, on average: ${avg((p) => p.nArticles)} articles -> ${avg((p) => p.nEvents)} eligible events (the code pre-filter removes ${pct(avg((p) => p.nArticles - p.nEvents), avg((p) => p.nArticles))} of articles) -> ${avg((p) => p.nClusters)} clusters -> ${avg((p) => p.cands.length - p.gdacs.length)} merged stories (merge removes ${pct(avg((p) => p.nClusters - p.cands.length + p.gdacs.length), avg((p) => p.nClusters))}) -> ${avg((p) => p.toScore.length)} sent to Jev. v1 scored 403 candidates per run.`,
  `- GDACS: ${sits.length} tracked situations reach back to about 2026-09-21 only. Runs with a Red candidate ${gd('Red')}, with an Orange candidate ${gd('Orange')}, of ${prepared.length}. Jev v2 picks from the reserved Red slot ${slotPicks}; Orange picks ${orangePicks}.`,
  capture ? `- Selector-input sanity check (${capture.gen}): the selector saw ${capture.inputCount} articles; ${capture.inCorpusWindow} (${pct(capture.inCorpusWindow, capture.inputCount)}) are in our ${capture.articles}-article corpus window.` : '- Capture sanity check not available.', '',
  '## Detector distributions (Jev v2, scored stories)',
  `- Scored stories ${scoredAll.length}. new_since_last_brief < 0.4 (dropped as not new): ${nwLow} (${pct(nwLow, scoredAll.length)}). Impact levels (rounded): ${fmtDist(dist(scoredAll.map((s) => Math.round(s.impact))).sort())}.`,
  `- Soft news and non-events are removed by the code pre-filter (kind = event), not by Jev: ${pct(avg((p) => p.nArticles - p.nEvents), avg((p) => p.nArticles))} of articles per run.`, '',
  '## Cost and latency (v2 only)',
  `- Jev calls ${store.usage.calls}, input tokens ${store.usage.input_tokens} (about ${Math.round(store.usage.input_tokens / Math.max(1, store.usage.calls))} per call), cost about $${spent().toFixed(3)} at $${USD_PER_M}/M input; v1 spent $0.470. Latency median ${lat[Math.floor(lat.length / 2)] ?? 'n/a'} ms, p95 ${lat[Math.floor(lat.length * 0.95)] ?? 'n/a'} ms. A live run would send about ${avg((p) => p.toScore.length)} calls, roughly $${(spent() / Math.max(1, store.usage.calls) * avg((p) => p.toScore.length)).toFixed(3)}.`, '',
  '## Highest-impact Jev-only picks',
  ...examples.map(({ p, c, impact }) => `- ${runLabel(p)}: ${c.title} (${c.gdacs ? `GDACS ${c.gdacs}` : `${c.outlets} outlets, sev ${c.severity}`}, impact ${impact.toFixed(2)})`), '',
  '## Limitations',
  '- "Became big" is measured on our own classified corpus with the story matcher above; a shared lead entity ties a story to every later article about that person in the same country, which inflates later outlet counts for stories led by prolific actors (US/Trump). It affects all selectors equally but lifts every recall figure.',
  '- Hindsight rewards stories that become widely covered, not stories that matter: a quiet but consequential story (a study, a policy) scores as a miss. It is an objective but partial measure; the blind review sheet covers the rest.',
  '- Later coverage counts only new articles in hour files; the last runs have no 72h window and are excluded. The corpus is the classified feed, so outlets outside our feeds are invisible.',
  '- The classifier has no climate/science/energy/business/military category, so those quotas rarely bind; v2 category spread is not strictly comparable to the LLM selector\'s categories.',
  '- GDACS history exists only from about 2026-09-21; earlier runs have no disaster candidates. There is no population field, so Orange cannot be filtered by affected population.',
  '- "Ours" comes from an LLM that sees headlines plus snippets; Jev sees classifier fields, so partly the classifier\'s judgement. Agreement is not correctness; there is no ground truth.',
  '- Single backtest on about 14 days; no confidence intervals. Merging and dedup use heuristic matching, so overlap counts are approximate.', '',
].join('\n'));
console.log('wrote REPORT.md, REVIEW_SHEET.md, REVIEW_KEY.json');
