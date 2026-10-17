#!/usr/bin/env node
// P6 Jev story-selection backtest (plan: project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md).
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
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const { clusterStories } = createRequire(import.meta.url)(path.join(REPO, 'amplify/backend/function/newsSituationIngest/src/classifier-core.js'));

const BUCKET = 's3://globalperspective-world-280362093938';
const AWS_ENV = { ...process.env, AWS_REGION: 'ap-northeast-1', AWS_DEFAULT_REGION: 'ap-northeast-1' };
const CORPUS_CACHE = path.join(os.tmpdir(), 'jev-backtest-corpus');
const RESULTS = path.join(HERE, 'results.json'); // per-candidate Jev answers, keyed by sha1(state) + run summaries
const DRY = process.argv.includes('--dry');
const FIRST_DAY = '2026-09-30', LAST_DAY = '2026-10-17';
const SKIP_DAYS = new Set(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']); // DeepSeek outage: no selections
const WINDOW_H = 8, MIN_SINGLE_SEVERITY = 3, CONCURRENCY = 4, BUDGET_USD = 0.95, USD_PER_M = 0.042, SEED = 20261017;
const MUST_HAVE = ['climate', 'science', 'society', 'energy', 'business']; // selection prompt rule 7
const CATEGORIES = { // the selection prompt's 12 allowed categories
  politics: 'elections, policy changes, diplomatic relations, government actions', economy: 'macroeconomics, trade deals, sanctions, currency, central bank policy',
  military: 'defense spending, troop movements, arms deals, exercises', conflict: 'wars, battles, peace talks, territorial disputes, organized violence',
  disaster: 'natural disasters, industrial accidents, humanitarian crises', technology: 'tech breakthroughs, AI, cybersecurity, major platform news',
  health: 'disease outbreaks, epidemics, major drug approvals, healthcare policy', climate: 'climate impacts, emissions, extreme weather, environmental treaties',
  science: 'research breakthroughs, space, biology, physics, geology', business: 'corporate M&A, major layoffs, supply chain disruptions, labor disputes',
  society: 'migration, demographics, social movements, protests, education, human rights', energy: 'oil, gas, renewables, grid infrastructure, energy security',
};

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

// ---------- candidates ----------
const storyId = (a) => clusterStories([a], '')[0]?.storyId || null; // the clusterer's own key for one article
function buildCandidates(run) {
  const hourStart = new Date(Math.floor(run.time / 36e5) * 36e5);
  const byUrl = new Map();
  for (let h = 1; h <= WINDOW_H; h++) for (const a of corpusFile(new Date(+hourStart - h * 36e5))) byUrl.set(a.url, a);
  const articles = [...byUrl.values()];
  const groups = new Map();
  for (const a of articles) { const id = storyId(a); const k = id || `single#${a.url}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  const cands = [];
  for (const [id, items] of groups) {
    const clustered = !id.startsWith('single#');
    const maxSev = Math.max(...items.map((i) => i.severity || 1));
    if (!clustered && maxSev < MIN_SINGLE_SEVERITY) continue; // ungrouped singles only if severity >= 3
    const domains = [...new Set(items.map((i) => i.domain))];
    const iso3 = [...new Set(items.flatMap((i) => i.iso3 || []))];
    const top = items.slice().sort((a, b) => b.severity - a.severity)[0];
    const seen = new Set(); const heads = [];
    for (const i of items.slice().sort((a, b) => b.severity - a.severity)) if (!seen.has(i.domain) && heads.length < 3) { seen.add(i.domain); heads.push(`${i.en_title || i.title} (${i.domain})`); }
    const c = { id, title: top.en_title || top.title, outlets: domains.length, articles: items.length, iso3, axis: top.axis, category: top.category, severity: maxSev, headlines: heads, urls: new Set(items.map((i) => urlKey(i.url))), titleTokens: items.map((i) => tokens(i.en_title || i.title)) };
    c.state = [`Story: ${c.title}`, `Coverage: ${c.outlets} distinct outlet(s), ${c.articles} article(s)`, `Countries: ${iso3.join(', ') || 'unspecified'}`, `Type: ${c.axis || 'unclassified'} / ${c.category}; max severity ${maxSev} of 5`, 'Headlines:', ...heads.map((h) => `- ${h}`)].join('\n');
    cands.push(c);
  }
  return { cands, articleUrls: new Set(articles.map((a) => urlKey(a.url))), nArticles: articles.length };
}

// published topic -> candidates it overlaps (by source URL; fallback title containment >= 0.5)
function matchTopics(run, cands) {
  for (const t of run.topics) {
    const keys = t.urls.map(urlKey);
    t.overlap = cands.filter((c) => keys.some((k) => c.urls.has(k)));
    t.how = 'url';
    if (!t.overlap.length) {
      const tt = tokens(t.title);
      const best = cands.map((c) => ({ c, s: Math.max(...c.titleTokens.map((x) => containment(tt, x))) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s)[0];
      if (best) { t.overlap = [best.c]; t.how = 'title'; }
    }
    t.best = t.overlap.slice().sort((a, b) => keys.filter((k) => b.urls.has(k)).length - keys.filter((k) => a.urls.has(k)).length || b.outlets - a.outlets)[0] || null;
  }
}

// ---------- Jev ----------
const RULES = 'Global Perspectives is an AI global-news intelligence brief for analysts. It publishes only significant news events judged by material impact: second-order effects on how people live, work, eat, move or breathe, and geopolitical or market consequence. It rejects sports, entertainment, celebrity and lifestyle, and local crime or accidents unless they have clear world impact. Political theater without material consequence is low significance. Many outlets covering a story and high severity are evidence of impact but not proof.';
const QUESTIONS = {
  publish: { type: 'noul', instructions: `${RULES} Should Global Perspectives publish this story in today's brief?`, criteria: { true: 'Yes: a significant event with material world impact that analysts would want in the brief', false: 'No: routine, local, celebrity/sport/lifestyle, or political theater without material consequence' } },
  importance: { type: 'score', instructions: `${RULES} Rate the importance of this story for that audience.`, criteria: ['Trivial: no analytical value, routine or lifestyle', 'Minor: local or narrow interest, little consequence beyond its setting', 'Notable: meaningful regional development or sector news', 'Major: significant consequence for a region, a market or a bilateral relationship', 'Critical: world-moving event with large cross-border or systemic consequence'] },
  category: { type: 'choice', instructions: 'Pick the single best-fitting category for this story.', criteria: CATEGORIES },
};
const store = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')) : { model: null, answers: {}, usage: { input_tokens: 0, calls: 0 }, latencyMs: [] };
const spent = () => (store.usage.input_tokens * USD_PER_M) / 1e6;
const key = fs.existsSync(path.join(os.homedir(), '.config/globalperspective/jev.key')) ? fs.readFileSync(path.join(os.homedir(), '.config/globalperspective/jev.key'), 'utf8').trim() : null;

async function jev(c) {
  const h = crypto.createHash('sha1').update(c.state).digest('hex');
  if (store.answers[h]) return store.answers[h];
  if (spent() > BUDGET_USD) throw new Error(`Jev budget guard hit ($${spent().toFixed(3)})`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const t0 = Date.now();
    const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state: c.state, questions: QUESTIONS }), signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 599 }));
    if (r.status === 429 || r.status === 529 || r.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    if (!r.ok) throw new Error(`Jev ${r.status}`);
    const j = await r.json();
    store.model = j.model; store.usage.input_tokens += j.usage.input_tokens; store.usage.calls++; store.latencyMs.push(Date.now() - t0);
    const imp = j.answers.importance;
    const a = { publish: j.answers.publish.noul, importance: imp.score + 1, category: j.answers.category.choice };
    return (store.answers[h] = a);
  }
  throw new Error('Jev retries exhausted');
}
async function pool(items, fn) { let i = 0, done = 0; await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) { await fn(items[i++]); if (++done % 200 === 0) { fs.writeFileSync(RESULTS, JSON.stringify(store)); console.log(`  ${done}/${items.length} spent $${spent().toFixed(3)}`); } } })); }

// ---------- selection with the selector's own stated rules ----------
// Prompt rules implemented: N picks; no category above 25% (rounded up); >= 1 each of climate/science/society/energy/business
// when a relevant candidate exists (publish > 0.5); sources exclusive (clusters are disjoint); soft dedup vs stories picked in the
// previous 24h. Not implemented (prompt-only, no deterministic form): "group aggressively", "regional diversity", continuity.
function select(scored, n, alreadyPicked) {
  const pool_ = scored.filter((s) => !alreadyPicked.has(s.c.id)).sort((a, b) => b.score - a.score);
  const cap = Math.ceil(0.25 * n), picks = [], count = {};
  const add = (s) => { picks.push(s); count[s.cat] = (count[s.cat] || 0) + 1; };
  for (const cat of MUST_HAVE) { const s = pool_.find((x) => x.cat === cat && x.publish > 0.5 && !picks.includes(x)); if (s && picks.length < n) add(s); }
  for (const s of pool_) { if (picks.length >= n) break; if (!picks.includes(s) && (count[s.cat] || 0) < cap) add(s); }
  return picks;
}

// ---------- main ----------
syncCorpus();
let runs = loadRuns().filter((r) => r.topics.length);
console.log(`${runs.length} archive runs over ${new Set(runs.map((r) => r.time.toISOString().slice(0, 10))).size} days`);
const prepared = runs.map((run) => { const b = buildCandidates(run); matchTopics(run, b.cands); return { run, ...b }; }).filter((p) => p.cands.length); // drops a run whose corpus hours do not exist (2026-09-30 02:15)
const droppedRuns = runs.length - prepared.length;
runs = prepared.map((p) => p.run);
const nTopics = sum(runs.map((r) => r.topics.length)), nMatched = sum(runs.map((r) => r.topics.filter((t) => t.best).length));
console.log(`candidates/run avg ${Math.round(sum(prepared.map((p) => p.cands.length)) / prepared.length)}; topics matched ${nMatched}/${nTopics}`);

// sanity check: latest run vs the selector's real captured input
let capture = null;
try {
  const cap = JSON.parse(aws('s3', 'cp', `${BUCKET}/audit/ingest-capture/latest.json`, '-', '--only-show-errors'));
  const p = prepared.find((x) => x.run.gen === cap.generationId);
  if (p) { const ck = cap.input.map((a) => urlKey(a.url)); capture = { gen: cap.generationId, inputCount: cap.input.length, inCorpusWindow: ck.filter((k) => p.articleUrls.has(k)).length, candidates: p.cands.length, articles: p.nArticles }; }
} catch { /* capture is optional */ }

const unique = new Map(prepared.flatMap((p) => p.cands).map((c) => [crypto.createHash('sha1').update(c.state).digest('hex'), c]));
const todo = [...unique.values()].filter((c) => !store.answers[crypto.createHash('sha1').update(c.state).digest('hex')]);
console.log(`unique candidate states ${unique.size}, to score ${todo.length}`);
if (DRY) process.exit(0);

console.log('scoring with Jev...');
await pool(todo, jev);
fs.writeFileSync(RESULTS, JSON.stringify(store));
console.log(`Jev model ${store.model}, input tokens ${store.usage.input_tokens}, $${spent().toFixed(3)}`);

// ---------- per-run evaluation ----------
const hashOf = (c) => crypto.createHash('sha1').update(c.state).digest('hex');
const big = (c) => c.outlets >= 8 || c.severity === 5;
const rows = [];
const pickedBy = { ours: [], jev: [] }; // {t, ids:Set} for the 24h soft-dedup window
for (const p of prepared) {
  const { run, cands } = p, N = run.topics.length, t = +run.time;
  const scored = cands.map((c) => { const a = store.answers[hashOf(c)]; return { c, publish: a.publish, imp: a.importance, score: a.publish * a.importance, cat: a.category }; });
  const recent = (side) => new Set(pickedBy[side].filter((x) => t - x.t < 864e5).flatMap((x) => [...x.ids]));
  const jevPicks = select(scored, N, recent('jev'));
  const oursIds = new Set(run.topics.flatMap((x) => x.overlap.map((c) => c.id)));
  const jevIds = new Set(jevPicks.map((s) => s.c.id));
  const matched = run.topics.filter((x) => x.overlap.length);
  const covered = matched.filter((x) => x.overlap.some((c) => jevIds.has(c.id)));
  const jevOnly = jevPicks.filter((s) => !oursIds.has(s.c.id));
  const oursOnly = matched.filter((x) => !covered.includes(x));
  const oursSeen = recent('ours'), jevSeen = recent('jev');
  const bigOurs = cands.filter((c) => big(c) && !oursIds.has(c.id) && !oursSeen.has(c.id));
  const bigJev = cands.filter((c) => big(c) && !jevIds.has(c.id) && !jevSeen.has(c.id));
  pickedBy.ours.push({ t, ids: oursIds }); pickedBy.jev.push({ t, ids: jevIds });
  rows.push({ run, N, nCands: cands.length, matched, covered, jevPicks, jevOnly, oursOnly, bigOurs, bigJev, scored });
}

// ---------- outputs ----------
const dist = (arr) => { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const fmtDist = (d) => d.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
const totN = sum(rows.map((r) => r.N)), totM = sum(rows.map((r) => r.matched.length)), totC = sum(rows.map((r) => r.covered.length));
const lat = store.latencyMs.slice().sort((a, b) => a - b);
const oursCats = dist(runs.flatMap((r) => r.topics.map((t) => t.category)));
const jevCats = dist(rows.flatMap((r) => r.jevPicks.map((s) => s.cat)));
const oursRegions = dist(runs.flatMap((r) => r.topics.map((t) => t.iso3[0]).filter(Boolean)));
const jevRegions = dist(rows.flatMap((r) => r.jevPicks.map((s) => s.c.iso3[0]).filter(Boolean)));
const runLabel = (r) => r.run.time.toISOString().slice(0, 16).replace('T', ' ');

const table = [
  '| Run (UTC) | N | Candidates | Matched topics | Jev covers | Recall | Jev-only | Ours-only | Big misses ours | Big misses Jev |', '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${runLabel(r)} | ${r.N} | ${r.nCands} | ${r.matched.length} | ${r.covered.length} | ${pct(r.covered.length, r.matched.length)} | ${r.jevOnly.length} | ${r.oursOnly.length} | ${r.bigOurs.length} | ${r.bigJev.length} |`),
  `| **All** | ${totN} | ${Math.round(sum(rows.map((r) => r.nCands)) / rows.length)} avg | ${totM} | ${totC} | ${pct(totC, totM)} | ${sum(rows.map((r) => r.jevOnly.length))} | ${sum(rows.map((r) => r.oursOnly.length))} | ${sum(rows.map((r) => r.bigOurs.length))} | ${sum(rows.map((r) => r.bigJev.length))} |`,
].join('\n');

// review sheet: one Jev-only pick vs one ours-only topic from the same run, 20 runs sampled, order randomized
const eligible = rows.filter((r) => r.jevOnly.length && r.oursOnly.some((x) => x.best));
const sample = shuffle(eligible).slice(0, 20);
const show = (c) => [`**${c.title}**`, `- Outlets: ${c.outlets} (${c.articles} articles); countries: ${c.iso3.join(', ') || 'n/a'}`, ...c.headlines.map((h) => `- ${h}`)].join('\n');
const key_ = []; const sheet = ['# Review sheet: which story belongs in the brief?', '', 'For each pair, both stories were available in the same selection window. Pick the one an analyst would rather see in the brief (or "equal"). Sides are not labelled.', ''];
sample.forEach((r, i) => {
  const jv = r.jevOnly.slice().sort((a, b) => b.score - a.score)[0];
  const ou = shuffle(r.oursOnly.filter((x) => x.best))[0];
  const flip = rng() < 0.5;
  const [o1, o2] = flip ? [jv.c, ou.best] : [ou.best, jv.c];
  sheet.push(`## Pair ${i + 1}`, '', '### Option 1', show(o1), '', '### Option 2', show(o2), '', 'Your pick: ____', '');
  key_.push({ pair: i + 1, run: r.run.gen, option1: flip ? 'jev' : 'ours', option2: flip ? 'ours' : 'jev', ourTitle: ou.title, jevScore: +jv.score.toFixed(2) });
});
fs.writeFileSync(path.join(HERE, 'REVIEW_SHEET.md'), sheet.join('\n'));
fs.writeFileSync(path.join(HERE, 'REVIEW_KEY.json'), JSON.stringify(key_, null, 2));

const examples = rows.flatMap((r) => r.jevOnly.slice(0, 1).map((s) => ({ r, s }))).sort((a, b) => b.s.score - a.s.score).slice(0, 5);
const days_ = [...new Set(runs.map((r) => r.time.toISOString().slice(0, 10)))];
fs.writeFileSync(path.join(HERE, 'REPORT.md'), [
  '# Jev story-selection backtest (P6)', '',
  `Generated by predictions/jev-backtest/run.mjs. Jev model id pinned by the API: **${store.model}** (requested jev-latest).`, '',
  '## Method',
  `- Runs: every newsInvokeGemini run (cron 15 4/8 UTC, i.e. 04:15, 12:15, 20:15) that left entries in DynamoDB NewsCache archive#YYYY-MM-DD, grouped by generationId. N = topics we published in that run.`,
  `- Candidates: the story scan's corpus hour files for the ${WINDOW_H} hours before each run, deduped by url, grouped with the existing clusterStories (via one-article calls to get each article's storyId); articles the clusterer drops (no axis, iso3 or latlon) are kept as single candidates only if severity >= ${MIN_SINGLE_SEVERITY}. Each corpus hour file is a rolling ~36h snapshot, so the pool spans roughly 44h, similar to the selector's 48h feed window.`,
  `- Jev state per candidate: title, distinct outlets, article count, countries, axis/category, max severity, up to 3 headlines from different outlets. Questions: publish (noul), importance (5-level score; Jev score, 1-5), category (choice among the selection prompt's 12 categories). Rank = publish x expected importance. Instructions are written from the selection prompt's rule 8 (material impact) and its rejected categories.`,
  `- Picking: top N after the selector's stated rules: category cap 25% (rounded up), >= 1 each of ${MUST_HAVE.join('/')} when a candidate with publish > 0.5 exists, exclusive sources (clusters are disjoint), soft dedup against stories Jev picked in the previous 24h. Prompt-only rules (aggressive grouping, regional diversity, continuity) are not implemented.`,
  `- Matching published topics to candidates: shared source URL (tracking params stripped); fallback title-token containment >= 0.5. A topic with no match is "chosen but not in candidates" (a source-coverage gap), excluded from recall.`,
  `- Recall@N = matched published topics that share a candidate with some Jev pick / matched topics. Jev-only = Jev picks overlapping no published topic. Ours-only = matched topics no Jev pick overlaps. Big event = candidate with >= 8 outlets or severity 5; a miss is a big candidate the side did not pick in this run or the previous 24h.`, '',
  '## Data coverage',
  `- ${runs.length} runs over ${days_.length} days (${days_[0]} to ${days_[days_.length - 1]}; 2026-10-12 to 10-15 skipped, DeepSeek outage; ${droppedRuns} further run(s) dropped for lack of corpus hours). Published topics: ${totN}; matched to a candidate: ${totM} (${pct(totM, totN)}); by url ${sum(runs.map((r) => r.topics.filter((t) => t.how === 'url' && t.best).length))}, by title fallback ${sum(runs.map((r) => r.topics.filter((t) => t.how === 'title' && t.best).length))}.`,
  `- Candidates per run: mean ${Math.round(sum(rows.map((r) => r.nCands)) / rows.length)}, min ${Math.min(...rows.map((r) => r.nCands))}, max ${Math.max(...rows.map((r) => r.nCands))}; unique candidate states scored: ${unique.size}.`,
  capture ? `- Selector-input sanity check (audit/ingest-capture/latest.json, ${capture.gen}): the selector saw ${capture.inputCount} articles; ${capture.inCorpusWindow} (${pct(capture.inCorpusWindow, capture.inputCount)}) are in our ${capture.articles}-article corpus window, which became ${capture.candidates} candidates. So our pool is a superset about ${Math.round(capture.candidates / capture.inputCount * 10) / 10}x the size of the selector's capped input.` : '- Capture sanity check not available.', '',
  '## Results per run', table, '',
  '## Spread (all runs)',
  `- Categories ours: ${fmtDist(oursCats)}`, `- Categories Jev (its own choice answer): ${fmtDist(jevCats)}`,
  `- Primary country ours (distinct ${oursRegions.length}): ${fmtDist(oursRegions)}`, `- Primary country Jev (distinct ${jevRegions.length}): ${fmtDist(jevRegions)}`, '',
  '## Cost and latency',
  `- Jev calls ${store.usage.calls}, input tokens ${store.usage.input_tokens}, cost about $${spent().toFixed(3)} at $${USD_PER_M}/M input (output free). Latency per call median ${lat[Math.floor(lat.length / 2)] ?? 'n/a'} ms, p95 ${lat[Math.floor(lat.length * 0.95)] ?? 'n/a'} ms (concurrency ${CONCURRENCY}). Candidates re-appearing with an identical state across runs reuse the cached answer. A live run would need about ${Math.round(sum(rows.map((r) => r.nCands)) / rows.length)} calls, roughly $${(spent() / Math.max(1, store.usage.calls) * (sum(rows.map((r) => r.nCands)) / rows.length)).toFixed(3)} per run.`, '',
  '## Highest-scoring Jev-only picks',
  ...examples.map(({ r, s }) => `- ${runLabel(r)}: ${s.c.title} (${s.c.outlets} outlets, sev ${s.c.severity}, score ${s.score.toFixed(2)})`), '',
  '## Limitations',
  '- "Ours" is the output of a different pipeline step (the LLM selector sees headlines plus snippets; Jev sees a short state built from classifier fields and headlines). Jev sees outlet counts and severity, which the selector does not, so Jev gets partly the classifier\'s judgement for free.',
  '- Agreement is not correctness: there is no ground truth. Disagreements need the blind human review in REVIEW_SHEET.md before drawing a conclusion.',
  '- The candidate pool is built from the classified corpus, not the exact selector input (the selector input capture only exists from 2026-10-17). Published topics not found in the pool are excluded from recall.',
  '- Fragmentation likely deflates recall: clusterStories splits one real story into several (axis, country, lead-entity) clusters, so Jev can pick the same story under a different cluster than the one our topic overlaps. Recall here is a lower bound; chance level for 13 picks from ~390 candidates is about 3%.',
  '- Clusters are the clusterer\'s coarse (axis, primary country, lead entity) groups; one Jev pick can stand for several of our topics, and one of our topics can span several clusters, which makes overlap counts approximate.',
  '- Quota rules are only partly implemented (see Method); category spread for ours uses the LLM\'s category, for Jev its own choice answer, so they are not strictly comparable.',
  '- Snapshots are rolling 36h windows, so stories from before the 8h window can appear; Jev has no notion of "already covered in earlier days" beyond the 24h soft dedup.',
  '- Single backtest on 14 days of one period; no confidence intervals.', '',
].join('\n'));
console.log('wrote REPORT.md, REVIEW_SHEET.md, REVIEW_KEY.json');
