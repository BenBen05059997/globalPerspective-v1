#!/usr/bin/env node
// P6 Jev story-selection backtest, v3 (plan: project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md).
// Read-only on AWS (S3 corpus + DynamoDB archive via the AWS CLI). Spends Jev tokens (operator-approved 2026-10-17).
//
//   node predictions/jev-backtest/run.mjs --dry     # build candidates + matching only
//   node predictions/jev-backtest/run.mjs           # reuse the cached Jev answers in results.json (a state with no cached answer is skipped and counted), write REPORT / REVIEW files
//   node predictions/jev-backtest/run.mjs --score   # also call Jev for missing answers
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
const req = createRequire(import.meta.url);
const { clusterStories, normalizeEntity } = req(path.join(REPO, 'amplify/backend/function/newsSituationIngest/src/classifier-core.js'));

const BUCKET = 's3://globalperspective-world-280362093938';
const AWS_ENV = { ...process.env, AWS_REGION: 'ap-northeast-1', AWS_DEFAULT_REGION: 'ap-northeast-1' };
const CORPUS_CACHE = path.join(os.tmpdir(), 'jev-backtest-corpus');
const RESULTS = path.join(HERE, 'results.json'); // per-candidate Jev answers, keyed by sha1(state) + run summaries
const DRY = process.argv.includes('--dry');
const FIRST_DAY = '2026-09-30', LAST_DAY = '2026-10-17';
const SKIP_DAYS = new Set(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']); // DeepSeek outage: no selections
const WINDOW_H = 8, LATER_H = 72, JACCARD = 0.3, MAX_PER_COUNTRY = 2, EARLY_OUTLETS = 4, FREQUENT = 0.05, RESCUE_MAX = 2, DONE_MIN = 0.6, CONCURRENCY = 4, BUDGET_USD = 0.95, USD_PER_M = 0.042, SEED = 20261017;
const MUST_HAVE = ['climate', 'science', 'society', 'energy', 'business']; // selection prompt rule 7
// North America + Western Europe, for the non-Western hindsight split
const WEST = new Set(['USA', 'CAN', 'GBR', 'IRL', 'FRA', 'DEU', 'NLD', 'BEL', 'LUX', 'CHE', 'AUT', 'ESP', 'PRT', 'ITA', 'DNK', 'NOR', 'SWE', 'FIN', 'ISL']);
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
      runs.get(e.generationId).topics.push({ title: e.title, category: e.category, regions: e.regions || [], iso3: e.iso3 || [], threadId: e.threadId, urls: (e.sources || []).map((s) => s.url), sourceTitles: (e.sources || []).map((s) => `${s.title} (${s.source})`), sourceOutlets: new Set((e.sources || []).map((s) => s.source)).size });
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
    ids, items, title: top.en_title || top.title, primary: top.iso3[0], iso3: [...new Set(items.flatMap((i) => i.iso3))], domains: [...new Set(items.map((i) => i.domain))], outlets: new Set(items.map((i) => i.domain)).size, articles: items.length,
    severity: top.severity, axis: top.axis, rawCategory: top.category, category: CATEGORY[top.category] || AXIS_CATEGORY[top.axis], headlines, urls: new Set(items.map((i) => urlKey(i.url))),
    toks: items.map((i) => tokens(i.en_title || i.title)), ents: new Set(items.map((i) => normalizeEntity(i.entities[0])).filter(Boolean)),
  };
}
// Same story: same primary country AND (a shared lead entity OR title-token Jaccard >= 0.3). A "frequent" entity (lead entity of > 5% of the run's event articles, e.g. Trump) is
// not a merge key. Used to merge fragments and to match later coverage.
const frequent = (items) => { const n = {}; for (const i of items) { const e = normalizeEntity(i.entities[0]); if (e) n[e] = (n[e] || 0) + 1; } return new Set(Object.keys(n).filter((e) => n[e] > FREQUENT * items.length)); };
const same = (a, b, skip) => a.primary === b.primary && ([...a.ents].some((e) => !skip.has(e) && b.ents.has(e)) || a.toks.some((x) => b.toks.some((y) => jaccard(x, y) >= JACCARD)));
function mergeCands(cands, skip) { // union-find over `same`; returns merged candidates
  const parent = cands.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  cands.forEach((a, i) => { for (let j = i + 1; j < cands.length; j++) if (same(a, cands[j], skip)) parent[find(j)] = find(i); });
  const groups = new Map();
  cands.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  return [...groups.values()].map((g) => (g.length === 1 ? g[0] : mkCand(g.flatMap((c) => c.items), g.flatMap((c) => c.ids))));
}
{ // unit-style asserts for the merge
  const art = (t, iso, ent, dom) => ({ en_title: t, title: t, domain: dom, iso3: [iso], severity: 3, entities: ent ? [ent] : [], url: `https://${dom}/${t}`, axis: 'conflict', category: 'war' });
  const filler = Array.from({ length: 60 }, (_, i) => mkCand([art(`Filler${'x'.repeat(i)}${i} report`, 'BRA', '', `f${i}.com`)], [`f${i}`]));
  const cs = [
    mkCand([art('Floods hit northern province hard', 'IND', '', 'a.com')], ['1']), mkCand([art('Floods hit northern province again', 'IND', '', 'b.com')], ['2']),
    mkCand([art('Parliament passes budget', 'IND', 'Narendra Modi', 'c.com')], ['3']), mkCand([art('Modi visits plant', 'IND', 'Narendra Modi', 'd.com')], ['4']),
    mkCand([art('Floods hit northern province hard', 'FRA', '', 'e.com')], ['5']), mkCand([art('Central bank cuts rates', 'IND', 'RBI', 'f.com')], ['6']),
    ...[['7', 'Tariffs announced'], ['8', 'Senate vote'], ['9', 'Shutdown looms'], ['10', 'Pipeline sanctions']].map(([id, t]) => mkCand([art(t, 'USA', 'Donald Trump', `t${id}.com`)], [id])), // frequent entity: 4 of 70 > 5%
  ];
  const all = [...cs, ...filler], m = mergeCands(all, frequent(all.flatMap((c) => c.items)));
  assert.deepEqual(m.filter((c) => !c.ids[0].startsWith('f')).map((c) => c.ids.slice().sort().join('+')).sort(), ['1+2', '10', '3+4', '5', '6', '7', '8', '9']);
  assert.equal(m.find((c) => c.ids.includes('1')).outlets, 2);
}

const laterOutlets = (c, later, skip) => new Set(later.filter((x) => same(c, x, skip)).map((x) => x.items[0].domain)).size;

function buildCandidates(run) {
  const hourStart = new Date(Math.floor(run.time / 36e5) * 36e5);
  const hour = (h) => corpusFile(new Date(+hourStart + h * 36e5));
  const byUrl = new Map();
  for (let h = 1; h <= WINDOW_H; h++) for (const a of hour(-h)) byUrl.set(a.url, a);
  const articles = [...byUrl.values()], events = articles.filter(eligible);
  const groups = new Map();
  for (const a of events) { const id = storyId(a); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(a); }
  const clusters = [...groups].map(([id, items]) => mkCand(items, [id]));
  const skip = frequent(events), cands = mergeCands(clusters, skip);
  const articleUrls = new Set(articles.map((a) => urlKey(a.url)));
  const hasLater = hour(LATER_H).length > 0; // hindsight needs the corpus 72h after the run
  const earlier = new Set(hour(-WINDOW_H).map((a) => a.url)); // growth: outlets now minus outlets of the same story already in the corpus snapshot 8h before the run
  for (const c of cands) c.growth = c.outlets - new Set(c.items.filter((i) => earlier.has(i.url)).map((i) => i.domain)).size;
  const later = new Map(); // later coverage: NEW articles (not in the pre-run window) in the following 72h
  if (hasLater) for (let h = 1; h <= LATER_H; h++) for (const a of hour(h)) if (!articleUrls.has(urlKey(a.url)) && !later.has(a.url) && eligible(a)) later.set(a.url, mkCand([a], []));
  const laterList = [...later.values()];
  for (const c of cands) c.later = laterOutlets(c, laterList, skip);
  return { cands, skip, later: laterList, articleUrls, nArticles: articles.length, nEvents: events.length, nClusters: clusters.length, hasLater };
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
    return [{ ids: [s.situationId], items: [], title: s.title, primary: s.iso3_origin[0] || s.iso3_affected[0], iso3: s.iso3_affected, domains: [], growth: 0, outlets: 0, articles: 0, severity: 0, category: 'disaster', gdacs: level,
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
// Operator editorial rule: only things DONE count; things SAID (criticism, warnings, demands, speeches) do not. A second, cheap call per headline keeps the impact / new cache valid.
const DONE_Q = { done_or_said: { type: 'choice', instructions: 'Does the headline report an action that has happened, or only what someone said?', criteria: { done: 'the headline reports an action or decision that has actually happened: a law/policy enacted, sanctions imposed, a deal signed, troops deployed, strikes carried out, diplomatic ties cut, rates changed, an election held, an acquisition closed, a disaster occurred', said: 'the headline reports what someone said: criticism, blame, a warning, threat, demand, condition or opinion, with no new action taken' } } };
const doneState = (title) => `Headline: ${title}`;
const hashOf = (state, questions = QUESTIONS) => crypto.createHash('sha1').update(state + JSON.stringify(questions)).digest('hex');
const doneOf = (title) => store.answers[hashOf(doneState(title), DONE_Q)]?.done; // probability the headline reports something done

async function jev([state, questions]) {
  const h = hashOf(state, questions);
  if (store.answers[h]) return;
  if (spent() > BUDGET_USD) throw new Error(`Jev budget guard hit ($${spent().toFixed(3)})`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const t0 = Date.now();
    const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state, questions }), signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 599 }));
    if (r.status === 429 || r.status === 529 || r.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    if (!r.ok) throw new Error(`Jev ${r.status}`);
    const j = await r.json();
    store.model = j.model; store.usage.input_tokens += j.usage.input_tokens; store.usage.calls++; store.latencyMs.push(Date.now() - t0);
    store.answers[h] = questions === DONE_Q ? { done: j.answers.done_or_said.probabilities.done } : { impact: j.answers.impact.score + 1, nw: j.answers.new_since_last_brief.noul };
    return;
  }
  throw new Error('Jev retries exhausted');
}
async function pool(items, fn) { let i = 0, done = 0; await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) { await fn(items[i++]); if (++done % 200 === 0) { fs.writeFileSync(RESULTS, JSON.stringify(store)); console.log(`  ${done}/${items.length} spent $${spent().toFixed(3)}`); } } })); }

// ---------- selection (one function) ----------
// Gates (Jev selectors): headline reports something DONE with probability >= DONE_MIN (GDACS exempt), Jev impact >= 2.5 on the 0-4 scale (3 for severity 2),
// classifier category not 'other', new_since_last_brief >= 0.4, not picked by this side in the previous 24h, >= 2 outlets. v2 selector (combined = false):
// 1-outlet severity-5 stories also enter; rank by impact (tie: outlets). Combined: a 1-outlet story enters only on impact >= 3.5 (rescue, at most RESCUE_MAX
// per run); rank by impact rounded to 0.5, then growth (outlets now minus outlets 8h earlier), then outlets. Both: one reserved slot for the best GDACS Red
// event outside the quotas; selector rule 7: no category above 25% (rounded up), >= 1 each of MUST_HAVE when a candidate with impact >= 2 exists; our
// interpretation of the prompt's "regional diversity": at most 2 picks per primary country (not a stated rule).
function select(scored, n, seen, combined) {
  const cap = Math.ceil(0.25 * n), cat = {}, cty = {}, picks = [];
  const good = (s) => s.c.gdacs || (s.done >= DONE_MIN && s.impact >= (s.c.severity === 2 ? 3 : 2.5) && s.c.rawCategory !== 'other');
  const entry = (s) => s.c.gdacs || s.c.outlets >= 2 || (combined ? s.impact >= 3.5 : s.c.severity === 5);
  const half = (x) => Math.round(x * 2) / 2;
  const order = combined ? (a, b) => half(b.impact) - half(a.impact) || b.c.growth - a.c.growth || b.c.outlets - a.c.outlets : (a, b) => b.impact - a.impact || b.c.outlets - a.c.outlets;
  const pool_ = scored.filter((s) => s.nw >= 0.4 && good(s) && !seen(s.c) && entry(s)).sort(order);
  const slot = pool_.find((s) => s.c.gdacs === 'Red');
  if (slot) picks.push(slot);
  const rescued = () => picks.filter((s) => !s.c.gdacs && s.c.outlets < 2).length;
  const ok = (s) => picks.length < n && !picks.includes(s) && (cat[s.c.category] || 0) < cap && (cty[s.c.primary] || 0) < MAX_PER_COUNTRY && (!combined || s.c.gdacs || s.c.outlets >= 2 || rescued() < RESCUE_MAX);
  const add = (s) => { picks.push(s); cat[s.c.category] = (cat[s.c.category] || 0) + 1; cty[s.c.primary] = (cty[s.c.primary] || 0) + 1; };
  for (const k of MUST_HAVE) { const s = pool_.find((x) => x.c.category === k && x.impact >= 2 && ok(x)); if (s) add(s); }
  for (const s of pool_) if (ok(s)) add(s);
  return picks;
}

// ---------- main ----------
syncCorpus();
const sits = loadGdacs();
let runs = loadRuns().filter((r) => r.topics.length);
console.log(`${runs.length} archive runs over ${new Set(runs.map((r) => r.time.toISOString().slice(0, 10))).size} days; ${sits.length} GDACS situations`);
const prepared = runs.map((run) => ({ run, ...buildCandidates(run) })).filter((p) => p.cands.length); // drops a run whose corpus hours do not exist (2026-09-30 02:15)
const droppedRuns = runs.length - prepared.length;
runs = prepared.map((p) => p.run);
for (const p of prepared) {
  p.gdacs = gdacsCands(sits, +p.run.time);
  p.cands.push(...p.gdacs);
  matchTopics(p.run.topics, p.cands);
  p.picks = {};
  p.covered = runs.filter((r) => r.time < p.run.time && p.run.time - r.time < 864e5).flatMap((r) => r.topics.map((t) => t.title)); // what we published in the previous 24h
  p.toScore = p.cands.filter((c) => c.gdacs || c.outlets >= 2 || c.severity === 5); // the outlet rule is applied in code, so Jev is not asked about stories it would drop anyway
}
const nTopics = sum(runs.map((r) => r.topics.length)), nMatched = sum(prepared.map((p) => p.run.topics.filter((t) => t.best).length));
const biggest = prepared.flatMap((p) => p.cands).sort((a, b) => b.ids.length - a.ids.length)[0];
console.log(`articles/run ${Math.round(sum(prepared.map((p) => p.nArticles)) / prepared.length)} -> events ${Math.round(sum(prepared.map((p) => p.nEvents)) / prepared.length)} -> clusters ${Math.round(sum(prepared.map((p) => p.nClusters)) / prepared.length)} -> merged stories ${Math.round(sum(prepared.map((p) => p.cands.length - p.gdacs.length)) / prepared.length)} -> to score ${Math.round(sum(prepared.map((p) => p.toScore.length)) / prepared.length)}; topics matched ${nMatched}/${nTopics}; biggest merged story ${biggest.ids.length} clusters: ${biggest.title}`);

// sanity check: latest run vs the selector's real captured input
let capture = null;
try {
  const cap = JSON.parse(aws('s3', 'cp', `${BUCKET}/audit/ingest-capture/latest.json`, '-', '--only-show-errors'));
  const p = prepared.find((x) => x.run.gen === cap.generationId);
  if (p) { const ck = cap.input.map((a) => urlKey(a.url)); capture = { gen: cap.generationId, inputCount: cap.input.length, inCorpusWindow: ck.filter((k) => p.articleUrls.has(k)).length, articles: p.nArticles }; }
} catch { /* capture is optional */ }

const spent0 = spent();
const jobs = [...prepared.flatMap((p) => [...p.toScore.map((c) => [stateOf(c, p.covered), QUESTIONS]), ...p.toScore.map((c) => [doneState(c.title), DONE_Q]), ...p.run.topics.map((t) => [doneState(t.title), DONE_Q])]), ...prepared.flatMap((p) => p.gdacs).map((c) => [doneState(c.title), DONE_Q])];
const todo = [...new Map(jobs.map((j) => [hashOf(...j), j])).values()].filter((j) => !store.answers[hashOf(...j)]);
console.log(`states without a cached Jev answer: ${todo.length}`);
if (DRY) process.exit(0);
if (process.argv.includes('--score')) {
  await pool(todo, jev);
  fs.writeFileSync(RESULTS, JSON.stringify(store));
}

// ---------- per-run selection ----------
const SIDES = { ours: 'Ours (published)', oursm: 'Ours, matched topics only', jev: 'Jev v2', base: 'Outlet-count baseline', growth: 'Growth baseline', comb: 'Combined v5' };
const got = (side, p, S, hours = 72, maxOutlets = Infinity) => prepared.some((q) => +p.run.time - +q.run.time >= 0 && +p.run.time - +q.run.time < hours * 36e5 && (q.picks[side] || []).some((P) => !P.gdacs && P.outlets < maxOutlets && (P === S || same(S, P, p.skip))));
const topN = (side, p, f) => p.cands.filter((c) => !c.gdacs && !got(side, p, c, 24)).sort(f).slice(0, p.run.topics.length);
const byOutlets = (a, b) => b.outlets - a.outlets || b.articles - a.articles;
for (const p of prepared) { // every side gets the same 24h self-dedup; an unmatched published topic is its own pick, matched to later coverage by its title and source domains
  const pseudo = (t) => { const domains = [...new Set(t.urls.map((u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } }))]; const c = { ids: [], items: [], title: t.title, primary: t.iso3[0], iso3: t.iso3, domains, outlets: domains.length, articles: t.urls.length, severity: 0, category: t.category, headlines: [], urls: new Set(), toks: [tokens(t.title)], ents: new Set(), growth: 0 }; if (p.hasLater) c.later = laterOutlets(c, p.later, p.skip); return c; };
  const matched = [...new Set(p.run.topics.map((t) => t.best).filter(Boolean))], all = [...matched, ...p.run.topics.filter((t) => !t.best && t.iso3.length).map(pseudo)];
  p.picks.oursm = matched.filter((c) => !got('oursm', p, c, 24));
  p.picks.ours = all.filter((c) => !got('ours', p, c, 24));
  p.scored = p.toScore.flatMap((c) => { const a = store.answers[hashOf(stateOf(c, p.covered))], done = c.gdacs ? 1 : doneOf(c.title); return a && done !== undefined ? [{ c, impact: a.impact - 1, nw: a.nw, done }] : []; }); // impact on the 0-4 scale; a missing answer skips the candidate
  p.missing = p.toScore.length - p.scored.length;
  const n = p.run.topics.length;
  p.picks.jev = select(p.scored, n, (c) => got('jev', p, c, 24), false).map((s) => s.c);
  p.picks.comb = select(p.scored, n, (c) => got('comb', p, c, 24), true).map((s) => s.c);
  p.picks.base = topN('base', p, byOutlets);
  p.picks.growth = topN('growth', p, (a, b) => b.growth - a.growth || byOutlets(a, b));
}

// ---------- metrics ----------
const real = (p, side) => p.picks[side].filter((c) => !c.gdacs);
const hind = prepared.filter((p) => p.hasLater);
const hindsight = (side, thr, inScope = () => true) => {
  const big = hind.flatMap((p) => p.cands.filter((c) => !c.gdacs && c.later >= thr && inScope(c)).map((c) => [p, c]));
  const picks = hind.flatMap((p) => real(p, side)).filter(inScope);
  return { big: big.length, recall: sum(big.map(([p, c]) => got(side, p, c))), early: sum(big.map(([p, c]) => got(side, p, c, 72, EARLY_OUTLETS))), picks: picks.length, dead: picks.filter((c) => c.later <= 2).length };
};
const nonWest = (c) => !WEST.has(c.primary);
const hs = Object.fromEntries(Object.keys(SIDES).map((s) => [s, { 8: hindsight(s, 8), 5: hindsight(s, 5), w8: hindsight(s, 8, nonWest), w5: hindsight(s, 5, nonWest) }]));
const bigMisses = (side) => sum(prepared.map((p) => p.cands.filter((c) => !c.gdacs && (c.outlets >= 8 || c.severity === 5) && !got(side, p, c, 24)).length));
const oursCovered = (side) => sum(prepared.map((p) => p.run.topics.filter((t) => t.overlap.some((c) => p.picks[side].includes(c))).length));
const dist = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const fmtDist = (d) => d.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
const cats = (side) => dist(prepared.flatMap((p) => (side.startsWith('ours') ? p.run.topics.map((t) => t.category) : p.picks[side].map((c) => c.category))));
const ctys = (side) => dist(prepared.flatMap((p) => (side.startsWith('ours') ? p.run.topics.map((t) => t.iso3[0]) : p.picks[side].map((c) => c.primary))).filter(Boolean));
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sideRows = (f) => Object.entries(SIDES).map(([s, name]) => [name, ...f(s)]);
const runLabel = (p) => p.run.time.toISOString().slice(0, 16).replace('T', ' ');
const rescues = prepared.flatMap((p) => p.scored.filter((s) => p.picks.comb.includes(s.c) && !s.c.gdacs && s.c.outlets < 2).map((s) => ({ p, ...s })));

// review sheet: one combined-only pick vs one ours-only topic from the same run, 20 runs sampled, order randomized. Each card shows exactly what that side picked.
const combOnly = (p) => p.picks.comb.filter((c) => !p.run.topics.some((t) => t.overlap.includes(c)));
const oursOnly = (p) => p.run.topics.filter((t) => !t.overlap.some((c) => p.picks.comb.includes(c)));
const rank = new Map(prepared.flatMap((p) => p.scored.map((s) => [s.c, s.impact])));
const sample = shuffle(prepared.filter((p) => combOnly(p).length && oursOnly(p).length)).slice(0, 20);
const candCard = (c) => ({ title: c.title, outlets: c.gdacs ? 'n/a (GDACS alert feed)' : `${c.outlets} (${c.articles} articles)`, severity: c.gdacs ? `GDACS ${c.gdacs} alert` : `${c.severity} of 5`, countries: c.iso3, bullets: c.headlines.slice(1) });
const topicCard = (t) => ({ title: t.title, outlets: `${t.sourceOutlets} source outlet(s)`, severity: t.best ? `${t.best.severity} of 5` : 'n/a', countries: t.iso3, bullets: t.sourceTitles.slice(0, 3) });
const show = (k) => [`**${k.title}**`, `- Outlets: ${k.outlets}; severity: ${k.severity}; countries: ${k.countries.join(', ') || 'n/a'}`, ...k.bullets.map((h) => `- ${h}`)].join('\n');
const key_ = []; const sheet = ['# Review sheet: which story belongs in the brief?', '', 'For each pair, both stories were available in the same selection window. Pick the one an analyst would rather see in the brief (or "equal"). Sides are not labelled.', ''];
sample.forEach((p, i) => {
  const cb = combOnly(p).sort((a, b) => (rank.get(b) || 0) - (rank.get(a) || 0))[0];
  const ou = shuffle(oursOnly(p))[0];
  const flip = rng() < 0.5;
  sheet.push(`## Pair ${i + 1}`, '', '### Option 1', show(flip ? candCard(cb) : topicCard(ou)), '', '### Option 2', show(flip ? topicCard(ou) : candCard(cb)), '', 'Your pick: ____', '');
  key_.push({ pair: i + 1, run: p.run.gen, option1: flip ? 'combined' : 'ours', option2: flip ? 'ours' : 'combined', ourTitle: ou.title, combinedTitle: cb.title, combinedImpact: +(rank.get(cb) || 0).toFixed(2) });
});
fs.writeFileSync(path.join(HERE, 'REVIEW_SHEET.md'), sheet.join('\n'));
fs.writeFileSync(path.join(HERE, 'REVIEW_KEY.json'), JSON.stringify(key_, null, 2));

const days_ = [...new Set(runs.map((r) => r.time.toISOString().slice(0, 10)))];
const avg = (f) => Math.round(sum(prepared.map(f)) / prepared.length);
const gd = (lvl) => prepared.filter((p) => p.gdacs.some((c) => c.gdacs === lvl)).length;
const saidShare = (side) => { const d = (side.startsWith('ours') ? runs.flatMap((r) => r.topics.map((t) => t.title)) : prepared.flatMap((p) => real(p, side).map((c) => c.title))).map(doneOf).filter((x) => x !== undefined); return [d.length, pct(d.filter((x) => x < 0.5).length, d.length)]; };
const saidExamples = [...new Map(prepared.flatMap((p) => p.scored).filter((s) => s.done < 0.5 && s.nw >= 0.4 && s.c.outlets >= 2).sort((a, b) => b.c.outlets - a.c.outlets).map((s) => [s.c.title, s])).values()].slice(0, 5);
fs.writeFileSync(path.join(HERE, 'REPORT.md'), [
  '# Jev story-selection backtest (P6), v5', '',
  `Generated by predictions/jev-backtest/run.mjs from the Jev cache (model ${store.model}); v5 added one question (done_or_said) and spent $${(spent() - spent0).toFixed(3)} new. Selectors: ours, Jev v2, two baselines and Combined v5; N = the number of topics we published in each run. Every side has the same 24h self-dedup.`, '',
  `## Hindsight: did the story become big? (${hind.length} runs whose following 72h is in the corpus)`,
  'A story "became big" if distinct outlets publishing the same story (same primary country and a non-frequent shared lead entity or title-token Jaccard >= 0.3) in NEW articles over the 72h after the run reach the threshold. Recall = share of became-big stories the side picked in that run or the previous 72h. Early recall counts only picks made while the story had < 4 outlets. Dead picks = picks that never got more than 2 outlets in the next 72h. Units are (run, story) pairs; GDACS picks are excluded (no outlet count).', '',
  tbl(['Selector', 'Picks scored', 'Dead picks', 'Recall (>=8)', 'Early recall (>=8)', 'Recall (>=5)', 'Early recall (>=5)'], sideRows((s) => [hs[s][8].picks, pct(hs[s][8].dead, hs[s][8].picks), pct(hs[s][8].recall, hs[s][8].big), pct(hs[s][8].early, hs[s][8].big), pct(hs[s][5].recall, hs[s][5].big), pct(hs[s][5].early, hs[s][5].big)])),
  `Became-big units: ${hs.ours[8].big} at >= 8 outlets, ${hs.ours[5].big} at >= 5.`, '',
  `Non-Western check: the same metrics for stories whose primary country is outside North America and Western Europe (${hs.ours.w8.big} became-big units at >= 8, ${hs.ours.w5.big} at >= 5).`, '',
  tbl(['Selector', 'Dead picks', 'Recall (>=8)', 'Early recall (>=8)', 'Recall (>=5)', 'Early recall (>=5)'], sideRows((s) => [pct(hs[s].w8.dead, hs[s].w8.picks), pct(hs[s].w8.recall, hs[s].w8.big), pct(hs[s].w8.early, hs[s].w8.big), pct(hs[s].w5.recall, hs[s].w5.big), pct(hs[s].w5.early, hs[s].w5.big)])), '',
  '## Other metrics (all runs)',
  tbl(['Selector', 'Overlap with ours (topics covered)', 'Big-event misses', 'Category spread', 'Primary country spread'], sideRows((s) => [s.startsWith('ours') ? 'n/a' : `${oursCovered(s)}/${nMatched} (${pct(oursCovered(s), nMatched)})`, bigMisses(s), fmtDist(cats(s)), `${new Set(ctys(s).map((x) => x[0])).size} countries: ${fmtDist(ctys(s))}`])),
  'Big-event miss = a candidate story with >= 8 outlets or severity 5 that the side did not pick in the run or the previous 24h, after merging. Category: ours is the LLM selector\'s category, the others use the classifier category mapped to the selector\'s list.', '',
  '## Said vs done (Jev done_or_said on the headline; said = P(done) < 0.5)',
  tbl(['Selector', 'Headlines answered', 'Share said'], sideRows((s) => saidShare(s))),
  'Examples of said-headlines now excluded from Jev v2 and Combined (most-covered):',
  ...saidExamples.map((s) => `- ${s.c.title} (${s.c.outlets} outlets, P(done) ${s.done.toFixed(2)})`), '',
  '## What changed from v4',
  `- Editorial rule (operator): only things done count, not things said. Jev v2 and Combined now require P(done) >= ${DONE_MIN} on a done_or_said question (GDACS exempt), Jev impact >= 2.5 on the 0-4 scale (3 for severity 2), and a classifier category other than 'other', on top of new_since_last_brief >= 0.4. A 1-outlet story needs impact >= 3.5 (max ${RESCUE_MAX} per run).`,
  `- Effect of the gates: Jev v2 fills ${sum(prepared.map((p) => p.picks.jev.length))} of ${nTopics} slots and Combined ${sum(prepared.map((p) => p.picks.comb.length))} of ${nTopics} (including ${sum(prepared.map((p) => p.picks.comb.filter((c) => c.gdacs).length))} GDACS picks); too few stories pass done + impact >= 2.5 to reach N. Recall and early recall of these two rows are therefore not comparable with selectors that fill all N slots; compare dead picks and said-share instead.`,
  '- Combined ranks by impact (rounded to 0.5), then 8h outlet growth, then outlets; the outlet-country spread bonus is gone. Growth is the story\'s distinct outlets now minus those already in the corpus snapshot 8h before the run.',
  `- Review cards now show what each side actually picked: ours = the published title with its own source headlines from the archive entry; Combined = the story's lead headline plus two from the same merged story. Rescue (1-outlet) picks: ${rescues.length} over ${prepared.length} runs.`,
  `- Jev answers are reused from v2. Merging changes a story's state, so some answers are missing: ${sum(prepared.map((p) => p.missing))} of ${sum(prepared.map((p) => p.toScore.length))} candidates (${pct(sum(prepared.map((p) => p.missing)), sum(prepared.map((p) => p.toScore.length)))}) were skipped by Jev v2 and Combined. The baseline and ours do not depend on Jev. Cached v2 spend: $${spent().toFixed(3)}.`,
  `- Removed: Jev v1 column and v1_picks.json (still in git history).`,
  `- Per run: ${avg((p) => p.nArticles)} articles -> ${avg((p) => p.nEvents)} eligible events -> ${avg((p) => p.nClusters)} clusters -> ${avg((p) => p.cands.length - p.gdacs.length)} merged stories -> ${avg((p) => p.toScore.length)} Jev-scored. ${runs.length} runs over ${days_.length} days (${days_[0]} to ${days_[days_.length - 1]}; 10-12 to 10-15 skipped for the DeepSeek outage; ${droppedRuns} dropped for lack of corpus hours). Topics matched ${nMatched}/${nTopics} (${pct(nMatched, nTopics)}). GDACS: runs with a Red candidate ${gd('Red')}, Orange ${gd('Orange')}.`,
  capture ? `- Selector-input sanity check (${capture.gen}): the selector saw ${capture.inputCount} articles; ${capture.inCorpusWindow} (${pct(capture.inCorpusWindow, capture.inputCount)}) are in our ${capture.articles}-article corpus window.` : '', '',
  '## Rescued stories (Combined v5, 1 outlet)',
  ...rescues.sort((a, b) => b.impact - a.impact).slice(0, 5).map((r) => `- ${runLabel(r.p)}: ${r.c.title} (${r.c.outlets} outlets, sev ${r.c.severity}, impact ${r.impact.toFixed(2)}, later outlets ${r.p.hasLater ? r.c.later : 'n/a'})`), '',
  '## Limitations',
  '- Hindsight rewards stories that get widely covered, not stories that matter; a quiet consequential story scores as a miss. The outlet-count baseline is favoured by construction because "big" is defined by outlet counts.',
  '- "Became big" uses our own classified feed and a heuristic matcher; the frequent-entity rule reduces but does not remove over-matching, and lead-entity matching can still tie unrelated stories of one actor. Outlets outside our feeds are invisible; the last runs lack a 72h window.',
  '- Our feed is mostly Western and English-language, so the non-Western check is partial. done_or_said judges the headline only, one call per distinct headline.',
  '- Missing Jev answers after the merge change shrink the Jev v2 and Combined pools; stories with 0-1 outlets and severity < 5 were never sent to Jev, so Combined cannot rescue them.',
  '- The classifier has no climate/science/energy/business/military category, so those quotas rarely bind. The cap of 2 per primary country is our interpretation of "regional diversity", not a stated prompt rule.',
  '- "Ours" comes from an LLM that sees headlines plus snippets; there is no ground truth. Single backtest on about 14 days; no confidence intervals.', '',
].join('\n'));
console.log('wrote REPORT.md, REVIEW_SHEET.md, REVIEW_KEY.json');
