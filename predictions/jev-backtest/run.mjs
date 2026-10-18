#!/usr/bin/env node
// P6 Jev story-selection backtest, v9 (plan: project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md).
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
// The selector itself lives in the shadow Lambda (one copy): candidates, Jev questions, gates and quotas.
const core = req(path.join(REPO, 'amplify/backend/function/newsSelectionShadow/src/selection-core.js'));
const { urlKey, tokens, eligible, mkCand, same, attachAlerts, QUESTIONS, DONE_Q, stateOf, doneState, select, lifted, DONE_MIN, GATE } = core;

const BUCKET = 's3://globalperspective-world-280362093938';
const AWS_ENV = { ...process.env, AWS_REGION: 'ap-northeast-1', AWS_DEFAULT_REGION: 'ap-northeast-1' };
const CORPUS_CACHE = path.join(os.tmpdir(), 'jev-backtest-corpus');
const RESULTS = path.join(HERE, 'results.json'); // per-candidate Jev answers, keyed by sha1(state) + run summaries
const DRY = process.argv.includes('--dry');
const FIRST_DAY = '2026-09-30', LAST_DAY = '2026-10-17';
const SKIP_DAYS = new Set(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']); // DeepSeek outage: no selections
const WINDOW_H = 8, LATER_H = 72, EARLY_OUTLETS = 4, CONCURRENCY = 4, BUDGET_USD = 1.2, USD_PER_M = 0.042, SEED = 20261017;
// North America + Western Europe, for the non-Western hindsight split
const WEST = new Set(['USA', 'CAN', 'GBR', 'IRL', 'FRA', 'DEU', 'NLD', 'BEL', 'LUX', 'CHE', 'AUT', 'ESP', 'PRT', 'ITA', 'DNK', 'NOR', 'SWE', 'FIN', 'ISL']);

// ---------- small helpers ----------
const aws = (...args) => execFileSync('aws', args, { env: AWS_ENV, maxBuffer: 1 << 28, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const unmarshall = (v) => { const [k, x] = Object.entries(v)[0]; return k === 'S' ? x : k === 'N' ? +x : k === 'BOOL' ? x : k === 'NULL' ? null : k === 'L' ? x.map(unmarshall) : k === 'M' ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, unmarshall(b)])) : x; };
const rng = (() => { let s = SEED; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
const sum = (a) => a.reduce((s, x) => s + x, 0);
const days = () => { const out = []; for (let t = Date.parse(FIRST_DAY); t <= Date.parse(LAST_DAY); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out.filter((d) => !SKIP_DAYS.has(d)); };

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

// ---------- candidates: selection-core, plus 72h of later coverage for hindsight ----------
const laterOutlets = (c, later, skip) => new Set(later.filter((x) => same(c, x, skip)).map((x) => x.items[0].domain)).size;

function buildCandidates(run) {
  const hourStart = new Date(Math.floor(run.time / 36e5) * 36e5);
  const hour = (h) => corpusFile(new Date(+hourStart + h * 36e5));
  const byUrl = new Map();
  for (let h = 1; h <= WINDOW_H; h++) for (const a of hour(-h)) byUrl.set(a.url, a);
  const articles = [...byUrl.values()];
  const { cands, skip, events, clusters } = core.candidates(articles, new Set(hour(-WINDOW_H).map((a) => a.url))); // growth vs the corpus snapshot 8h before the run
  const articleUrls = new Set(articles.map((a) => urlKey(a.url)));
  const hasLater = hour(LATER_H).length > 0; // hindsight needs the corpus 72h after the run
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
const store = { model: null, answers: {}, usage: { input_tokens: 0, calls: 0 }, latencyMs: [], ...(fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : {}) };
const spent = () => (store.usage.input_tokens * USD_PER_M) / 1e6;
const key = fs.existsSync(path.join(os.homedir(), '.config/globalperspective/jev.key')) ? fs.readFileSync(path.join(os.homedir(), '.config/globalperspective/jev.key'), 'utf8').trim() : null;
const hashOf = (state, questions = QUESTIONS) => crypto.createHash('sha1').update(state + JSON.stringify(questions)).digest('hex');
const doneOf = (title) => store.answers[hashOf(doneState(title), DONE_Q)]?.done; // probability the headline reports something done

async function jev([state, questions]) {
  const h = hashOf(state, questions);
  if (store.answers[h]) return;
  if (spent() > BUDGET_USD) throw new Error(`Jev budget guard hit ($${spent().toFixed(3)})`);
  const t0 = Date.now(), r = await core.jevAsk(key, state, questions, sleep);
  store.model = r.model; store.usage.input_tokens += r.inputTokens; store.usage.calls++; store.latencyMs.push(Date.now() - t0);
  store.answers[h] = r.answer;
}
async function pool(items, fn) { let i = 0, done = 0; await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) { await fn(items[i++]); if (++done % 200 === 0) { fs.writeFileSync(RESULTS, JSON.stringify(store)); console.log(`  ${done}/${items.length} spent $${spent().toFixed(3)}`); } } })); }

// ---------- main ----------
syncCorpus();
const sits = loadGdacs();
let runs = loadRuns().filter((r) => r.topics.length);
console.log(`${runs.length} archive runs over ${new Set(runs.map((r) => r.time.toISOString().slice(0, 10))).size} days; ${sits.length} GDACS situations`);
const prepared = runs.map((run) => ({ run, ...buildCandidates(run) })).filter((p) => p.cands.length); // drops a run whose corpus hours do not exist (2026-09-30 02:15)
const droppedRuns = runs.length - prepared.length;
runs = prepared.map((p) => p.run);
for (const p of prepared) {
  attachAlerts(p.cands, sits, +p.run.time);
  matchTopics(p.run.topics, p.cands);
  p.picks = {};
  p.covered = runs.filter((r) => r.time < p.run.time && p.run.time - r.time < 864e5).flatMap((r) => r.topics.map((t) => t.title)); // what we published in the previous 24h
  p.toScore = core.toScore(p.cands); // the outlet rule is applied in code, so Jev is not asked about stories it would drop anyway
}
const nTopics = sum(runs.map((r) => r.topics.length)), nMatched = sum(prepared.map((p) => p.run.topics.filter((t) => t.best).length));
const biggest = prepared.flatMap((p) => p.cands).sort((a, b) => b.ids.length - a.ids.length)[0];
console.log(`articles/run ${Math.round(sum(prepared.map((p) => p.nArticles)) / prepared.length)} -> events ${Math.round(sum(prepared.map((p) => p.nEvents)) / prepared.length)} -> clusters ${Math.round(sum(prepared.map((p) => p.nClusters)) / prepared.length)} -> merged stories ${Math.round(sum(prepared.map((p) => p.cands.length)) / prepared.length)} -> to score ${Math.round(sum(prepared.map((p) => p.toScore.length)) / prepared.length)}; topics matched ${nMatched}/${nTopics}; biggest merged story ${biggest.ids.length} clusters: ${biggest.title}`);

// sanity check: latest run vs the selector's real captured input
let capture = null;
try {
  const cap = JSON.parse(aws('s3', 'cp', `${BUCKET}/audit/ingest-capture/latest.json`, '-', '--only-show-errors'));
  const p = prepared.find((x) => x.run.gen === cap.generationId);
  if (p) { const ck = cap.input.map((a) => urlKey(a.url)); capture = { gen: cap.generationId, inputCount: cap.input.length, inCorpusWindow: ck.filter((k) => p.articleUrls.has(k)).length, articles: p.nArticles }; }
} catch { /* capture is optional */ }

const spent0 = spent();
const jobs = [...prepared.flatMap((p) => [...p.toScore.map((c) => [stateOf(c, p.covered), QUESTIONS]), ...p.toScore.map((c) => [doneState(c.title), DONE_Q]), ...p.run.topics.map((t) => [doneState(t.title), DONE_Q])])];
const todo = [...new Map(jobs.map((j) => [hashOf(...j), j])).values()].filter((j) => !store.answers[hashOf(...j)]);
console.log(`states without a cached Jev answer: ${todo.length}`);
if (DRY) process.exit(0);
if (process.argv.includes('--score')) {
  await pool(todo, jev);
  fs.writeFileSync(RESULTS, JSON.stringify(store));
}

// ---------- per-run selection ----------
const SIDES = { ours: 'Ours (published)', oursm: 'Ours, matched topics only', comb: 'Combined v9', base: 'Outlet-count baseline', growth: 'Growth baseline' };
const got = (side, p, S, hours = 72, maxOutlets = Infinity) => prepared.some((q) => +p.run.time - +q.run.time >= 0 && +p.run.time - +q.run.time < hours * 36e5 && (q.picks[side] || []).some((P) => P.outlets < maxOutlets && (P === S || same(S, P, p.skip))));
const topN = (side, p, f) => p.cands.filter((c) => !got(side, p, c, 24)).sort(f).slice(0, p.run.topics.length);
const byOutlets = (a, b) => b.outlets - a.outlets || b.articles - a.articles;
for (const p of prepared) { // every side gets the same 24h self-dedup; an unmatched published topic is its own pick, matched to later coverage by its title and source domains
  const pseudo = (t) => { const domains = [...new Set(t.urls.map((u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } }))]; const c = { ids: [], items: [], title: t.title, primary: t.iso3[0], iso3: t.iso3, domains, outlets: domains.length, articles: t.urls.length, severity: 0, category: t.category, headlines: [], urls: new Set(), toks: [tokens(t.title)], ents: new Set(), growth: 0 }; if (p.hasLater) c.later = laterOutlets(c, p.later, p.skip); return c; };
  const matched = [...new Set(p.run.topics.map((t) => t.best).filter(Boolean))], all = [...matched, ...p.run.topics.filter((t) => !t.best && t.iso3.length).map(pseudo)];
  p.picks.oursm = matched.filter((c) => !got('oursm', p, c, 24));
  p.picks.ours = all.filter((c) => !got('ours', p, c, 24));
  p.scored = p.toScore.flatMap((c) => { const a = store.answers[hashOf(stateOf(c, p.covered))], done = doneOf(c.title); return a && done !== undefined ? [{ c, impact: a.impact, nw: a.nw, done }] : []; }); // impact on Jev's 0-4 scale; a missing answer skips the candidate
  p.missing = p.toScore.length - p.scored.length;
  const n = p.run.topics.length;
  p.picks.comb = select(p.scored, n, (c) => got('comb', p, c, 24)).map((s) => s.c);
  p.picks.base = topN('base', p, byOutlets);
  p.picks.growth = topN('growth', p, (a, b) => b.growth - a.growth || byOutlets(a, b));
}

// ---------- metrics ----------
const real = (p, side) => p.picks[side];
const hind = prepared.filter((p) => p.hasLater);
const hindsight = (side, thr, inScope = () => true) => {
  const big = hind.flatMap((p) => p.cands.filter((c) => c.later >= thr && inScope(c)).map((c) => [p, c]));
  const picks = hind.flatMap((p) => real(p, side)).filter(inScope);
  return { big: big.length, recall: sum(big.map(([p, c]) => got(side, p, c))), early: sum(big.map(([p, c]) => got(side, p, c, 72, EARLY_OUTLETS))), picks: picks.length, dead: picks.filter((c) => c.later <= 2).length };
};
const nonWest = (c) => !WEST.has(c.primary);
const hs = Object.fromEntries(Object.keys(SIDES).map((s) => [s, { 8: hindsight(s, 8), 5: hindsight(s, 5), w8: hindsight(s, 8, nonWest), w5: hindsight(s, 5, nonWest) }]));
const bigMisses = (side) => sum(prepared.map((p) => p.cands.filter((c) => (c.outlets >= 8 || c.severity === 5) && !got(side, p, c, 24)).length));
const oursCovered = (side) => sum(prepared.map((p) => p.run.topics.filter((t) => t.overlap.some((c) => p.picks[side].includes(c))).length));
const dist = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const fmtDist = (d) => d.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
const cats = (side) => dist(prepared.flatMap((p) => (side.startsWith('ours') ? p.run.topics.map((t) => t.category) : p.picks[side].map((c) => c.category))));
const ctys = (side) => dist(prepared.flatMap((p) => (side.startsWith('ours') ? p.run.topics.map((t) => t.iso3[0]) : p.picks[side].map((c) => c.primary))).filter(Boolean));
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const sideRows = (f) => Object.entries(SIDES).map(([s, name]) => [name, ...f(s)]);
const runLabel = (p) => p.run.time.toISOString().slice(0, 16).replace('T', ' ');
const rescues = prepared.flatMap((p) => p.scored.filter((s) => p.picks.comb.includes(s.c) && s.c.outlets < 2).map((s) => ({ p, ...s })));

// review sheet: one combined-only pick vs one ours-only topic from the same run, 20 runs sampled, order randomized. Each card shows exactly what that side picked.
const combOnly = (p) => p.picks.comb.filter((c) => !p.run.topics.some((t) => t.overlap.includes(c)));
const oursOnly = (p) => p.run.topics.filter((t) => !t.overlap.some((c) => p.picks.comb.includes(c)));
const rank = new Map(prepared.flatMap((p) => p.scored.map((s) => [s.c, s.impact])));
const sample = shuffle(prepared.filter((p) => combOnly(p).length && oursOnly(p).length)).slice(0, 20);
const candCard = (c) => ({ title: c.title, outlets: `${c.outlets} (${c.articles} articles)`, severity: `${c.severity} of 5${c.alert ? ` (GDACS ${c.alert} alert)` : ''}`, countries: c.iso3, bullets: c.headlines.slice(1) });
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
const gd = (lvl) => prepared.filter((p) => p.cands.some((c) => c.alert === lvl)).length;
const failImpact = (s) => lifted(s) < (s.c.severity === 2 ? GATE.sev2 : GATE.imp);
const gatePool = prepared.map((p) => p.scored.filter((s) => s.nw >= core.NEW_MIN && s.c.outlets >= 2));
const failCombos = {};
for (const s of gatePool.flat()) { if (s.c.alert) continue; const k = [s.done < DONE_MIN && 'said', failImpact(s) && 'low impact', s.c.rawCategory === 'other' && 'other'].filter(Boolean).join(' + ') || 'passes all'; failCombos[k] = (failCombos[k] || 0) + 1; }
const catDist = dist([...new Map(prepared.flatMap((p) => p.cands.flatMap((c) => c.items)).map((i) => [i.url, i.category])).values()]);
const fmtDist15 = (d) => d.slice(0, 15).map(([k, v]) => `${k} ${v}`).join(', ');
const saidShare = (side) => { const d = (side.startsWith('ours') ? runs.flatMap((r) => r.topics.map((t) => t.title)) : prepared.flatMap((p) => real(p, side).map((c) => c.title))).map(doneOf).filter((x) => x !== undefined); return [d.length, pct(d.filter((x) => x < 0.5).length, d.length)]; };
const saidExamples = [...new Map(prepared.flatMap((p) => p.scored).filter((s) => s.done < 0.5 && s.nw >= 0.4 && s.c.outlets >= 2).sort((a, b) => b.c.outlets - a.c.outlets).map((s) => [s.c.title, s])).values()].slice(0, 5);
fs.writeFileSync(path.join(HERE, 'REPORT.md'), [
  '# Jev story-selection backtest (P6), v9', '',
  `Generated by predictions/jev-backtest/run.mjs from the Jev cache (model ${store.model}); new spend this run $${(spent() - spent0).toFixed(3)}. Selectors: ours, Combined v9 (the shared selector in amplify/backend/function/newsSelectionShadow/src/selection-core.js, also used by the shadow job), two baselines; N = the number of topics we published in each run. Every side has the same 24h self-dedup.`, '',
  `## Hindsight: did the story become big? (${hind.length} runs whose following 72h is in the corpus)`,
  'A story "became big" if distinct outlets publishing the same story (same primary country and a non-frequent shared lead entity or title-token Jaccard >= 0.3) in NEW articles over the 72h after the run reach the threshold. Recall = share of became-big stories the side picked in that run or the previous 72h. Early recall counts only picks made while the story had < 4 outlets. Dead picks = picks that never got more than 2 outlets in the next 72h. Units are (run, story) pairs.', '',
  tbl(['Selector', 'Slots filled per run', 'Picks scored', 'Dead picks', 'Recall (>=8)', 'Early recall (>=8)', 'Recall (>=5)', 'Early recall (>=5)'], sideRows((s) => [(sum(prepared.map((p) => p.picks[s].length)) / prepared.length).toFixed(1), hs[s][8].picks, pct(hs[s][8].dead, hs[s][8].picks), pct(hs[s][8].recall, hs[s][8].big), pct(hs[s][8].early, hs[s][8].big), pct(hs[s][5].recall, hs[s][5].big), pct(hs[s][5].early, hs[s][5].big)])),
  `Became-big units: ${hs.ours[8].big} at >= 8 outlets, ${hs.ours[5].big} at >= 5.`, '',
  `Non-Western check: the same metrics for stories whose primary country is outside North America and Western Europe (${hs.ours.w8.big} became-big units at >= 8, ${hs.ours.w5.big} at >= 5).`, '',
  tbl(['Selector', 'Dead picks', 'Recall (>=8)', 'Early recall (>=8)', 'Recall (>=5)', 'Early recall (>=5)'], sideRows((s) => [pct(hs[s].w8.dead, hs[s].w8.picks), pct(hs[s].w8.recall, hs[s].w8.big), pct(hs[s].w8.early, hs[s].w8.big), pct(hs[s].w5.recall, hs[s].w5.big), pct(hs[s].w5.early, hs[s].w5.big)])), '',
  '## Other metrics (all runs)',
  tbl(['Selector', 'Overlap with ours (topics covered)', 'Big-event misses', 'Category spread', 'Primary country spread'], sideRows((s) => [s.startsWith('ours') ? 'n/a' : `${oursCovered(s)}/${nMatched} (${pct(oursCovered(s), nMatched)})`, bigMisses(s), fmtDist(cats(s)), `${new Set(ctys(s).map((x) => x[0])).size} countries: ${fmtDist(ctys(s))}`])),
  'Big-event miss = a candidate story with >= 8 outlets or severity 5 that the side did not pick in the run or the previous 24h, after merging. Category: ours is the LLM selector\'s category, the others use the classifier category mapped to the selector\'s list.', '',
  '## Slots filled (a thin window gives a smaller brief; slots are not force-filled)',
  tbl(['Selector', 'Slots filled', 'Per run (avg)'], sideRows((s) => [`${sum(prepared.map((p) => p.picks[s].length))}/${nTopics}`, (sum(prepared.map((p) => p.picks[s].length)) / prepared.length).toFixed(1)])),
  `Fewest picks, Combined v9: ${prepared.slice().sort((a, b) => a.picks.comb.length - b.picks.comb.length).slice(0, 5).map((p) => `${runLabel(p)} ${p.picks.comb.length}/${p.run.topics.length}`).join('; ')}.`, '',
  '## Gate breakdown (Combined eligible pool: scored, >= 2 outlets, new_since_last_brief >= 0.4, GDACS-tagged stories left out; averages per run)',
  `Pool ${(sum(gatePool.map((x) => x.length)) / prepared.length).toFixed(1)} per run. Failing, by gate combination:`,
  tbl(['Fails', 'Per run (avg)'], Object.entries(failCombos).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, (v / prepared.length).toFixed(1)])),
  `Each gate alone (any combination): P(done) < ${DONE_MIN} ${(sum(gatePool.map((x) => x.filter((s) => s.done < DONE_MIN).length)) / prepared.length).toFixed(1)}, impact below bar ${(sum(gatePool.map((x) => x.filter(failImpact).length)) / prepared.length).toFixed(1)}, category 'other' ${(sum(gatePool.map((x) => x.filter((s) => s.c.rawCategory === 'other').length)) / prepared.length).toFixed(1)} per run.`,
  `- Classifier category among event articles (unique urls, top 15): ${fmtDist15(catDist)}.`,
  `- Impact (0-4, rounded) of stories with P(done) >= ${DONE_MIN} in the pool: ${fmtDist(dist(gatePool.flat().filter((s) => s.done >= DONE_MIN).map((s) => Math.round(s.impact))).sort())}.`,
  'The classifier has no entertainment/sports/celebrity/lifestyle category: such headlines are set to severity 1 and "other", and clusterStories already drops severity < 2, so the selector\'s REJECT list needs no extra mapping. An "other" event with severity >= 2 gets the category mapped from its axis.', '',
  '## Said vs done (Jev done_or_said on the headline; said = P(done) < 0.5)',
  tbl(['Selector', 'Headlines answered', 'Share said'], sideRows((s) => saidShare(s))),
  'Examples of said-headlines now excluded from Combined (most-covered):',
  ...saidExamples.map((s) => `- ${s.c.title} (${s.c.outlets} outlets, P(done) ${s.done.toFixed(2)})`), '',
  '## What changed from v7 (fixes from the v7 and v8 blind reviews)',
  '- v7 for reference (REPORT.md in git at 62b2e66): Combined v7 6.9 slots per run, said-share 0%, dead picks 60%, recall (>=8) 61%, early recall 35%; blind review Combined 11, ours 9.',
  '- GDACS: no bare alert cards. An active Red/Orange event only tags a disaster story that outlets already report (same country); that story skips the done/impact gates and a Red one takes the reserved slot.',
  '- One story per war: a conflict story is skipped when an earlier pick in the run is a conflict story sharing a country.',
  `- Decision lift: policy / economy / markets / diplomacy / election stories get +0.5 on Jev impact (gate and rank). Gates otherwise unchanged: P(done) >= ${DONE_MIN}, impact >= ${GATE.imp} (${GATE.sev2} for severity 2), rescue (1-outlet) needs >= 3.5. No force-fill.`,
  '- done_or_said judges the main clause: a headline leading with a reaction ("X blasts Y as strikes kill 78"), an attributed claim ("..., police say"), an announced or future intention ("to intensify strikes") or an anniversary is said; every done answer was re-asked.',
  '- v8 (same fixes, earlier done question) blind review: Combined 9, ours 9, 2 split; losses were mostly an intention, attributed claims and an anniversary passing as done.',
  `- Review cards now show what each side actually picked: ours = the published title with its own source headlines from the archive entry; Combined = the story's lead headline plus two from the same merged story. Rescue (1-outlet) picks: ${rescues.length} over ${prepared.length} runs.`,
  `- Jev answers are reused from earlier runs (impact/new) where the state is unchanged; missing: ${sum(prepared.map((p) => p.missing))} of ${sum(prepared.map((p) => p.toScore.length))} candidates (${pct(sum(prepared.map((p) => p.missing)), sum(prepared.map((p) => p.toScore.length)))}) were skipped by Combined. The baseline and ours do not depend on Jev. Total Jev spend for the backtest: $${spent().toFixed(3)}.`,
  `- Removed: the Jev-only selector and the v6/v7 columns (in git history at 62b2e66).`,
  `- Per run: ${avg((p) => p.nArticles)} articles -> ${avg((p) => p.nEvents)} eligible events -> ${avg((p) => p.nClusters)} clusters -> ${avg((p) => p.cands.length)} merged stories -> ${avg((p) => p.toScore.length)} Jev-scored. ${runs.length} runs over ${days_.length} days (${days_[0]} to ${days_[days_.length - 1]}; 10-12 to 10-15 skipped for the DeepSeek outage; ${droppedRuns} dropped for lack of corpus hours). Topics matched ${nMatched}/${nTopics} (${pct(nMatched, nTopics)}). GDACS: runs with a story tagged Red ${gd('Red')}, Orange ${gd('Orange')}.`,
  capture ? `- Selector-input sanity check (${capture.gen}): the selector saw ${capture.inputCount} articles; ${capture.inCorpusWindow} (${pct(capture.inCorpusWindow, capture.inputCount)}) are in our ${capture.articles}-article corpus window.` : '', '',
  '## Rescued stories (Combined v9, 1 outlet)',
  ...rescues.sort((a, b) => b.impact - a.impact).slice(0, 5).map((r) => `- ${runLabel(r.p)}: ${r.c.title} (${r.c.outlets} outlets, sev ${r.c.severity}, impact ${r.impact.toFixed(2)}, later outlets ${r.p.hasLater ? r.c.later : 'n/a'})`), '',
  '## Limitations',
  '- Hindsight rewards stories that get widely covered, not stories that matter; a quiet consequential story scores as a miss. The outlet-count baseline is favoured by construction because "big" is defined by outlet counts.',
  '- "Became big" uses our own classified feed and a heuristic matcher; the frequent-entity rule reduces but does not remove over-matching, and lead-entity matching can still tie unrelated stories of one actor. Outlets outside our feeds are invisible; the last runs lack a 72h window.',
  '- Our feed is mostly Western and English-language, so the non-Western check is partial. done_or_said judges the headline only, one call per distinct headline.',
  '- Missing Jev answers shrink the Combined pool; stories with 0-1 outlets and severity < 5 were never sent to Jev, so Combined cannot rescue them.',
  '- The classifier has no climate/science/energy/business/military category, so those quotas rarely bind. The cap of 2 per primary country is our interpretation of "regional diversity", not a stated prompt rule.',
  '- "Ours" comes from an LLM that sees headlines plus snippets; there is no ground truth. Single backtest on about 14 days; no confidence intervals.', '',
].join('\n'));
console.log('wrote REPORT.md, REVIEW_SHEET.md, REVIEW_KEY.json');
