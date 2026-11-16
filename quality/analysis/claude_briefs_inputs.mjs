// Claude comparison for the briefs-and-analysis jobs (2026-11-16): rebuild each job's prompt from the public record views
// (fetched by claude_briefs_fetch.mjs into a cache dir) using the Lambda's OWN prompt code. Nothing here calls a model, AWS or
// writes anywhere but the cache. The Lambdas are loaded from source with the AWS SDK stubbed and (country job) the model call
// replaced by a capture, so the prompt text is exactly what the deployed code builds from the same inputs.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
export const CACHE = process.env.VIEW_CACHE;
if (!CACHE) throw new Error('set VIEW_CACHE to the directory claude_briefs_fetch.mjs filled');
const readJson = (rel) => { const f = path.join(CACHE, rel); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

// ---- load a Lambda's index.js with the AWS SDK stubbed, appending exports in memory (the file is not touched) ----
export const ctx = { drift: [], capture: null };
class Cmd { constructor(input) { this.input = input; this.cmd = this.constructor.name; } }
const sdk = {
  DynamoDBClient: class { }, S3Client: class { },
  DynamoDBDocumentClient: { from: () => ({ send: async (c) => {
    if (c.cmd === 'QueryCommand' && ctx.drift) return { Items: ctx.drift };
    if (c.cmd === 'GetCommand') return { Item: undefined };
    throw new Error('stubbed AWS call: ' + c.cmd);
  } }) },
  GetCommand: class GetCommand extends Cmd { }, PutCommand: class PutCommand extends Cmd { }, QueryCommand: class QueryCommand extends Cmd { },
  ScanCommand: class ScanCommand extends Cmd { }, PutObjectCommand: class PutObjectCommand extends Cmd { },
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.startsWith('@aws-sdk/')) return sdk;
  // A Lambda loaded here can never reach a model: its chat() is always the capture below (no DeepSeek, no Anthropic).
  if (/_shared\/llm$/.test(request) && parent && /\/backend\/(?!shared)/.test(parent.filename || '')) {
    const real = origLoad.apply(this, [request, parent, isMain]);
    return { ...real, chat: async (o) => { if (ctx.capture) ctx.capture(o); throw new Error('captured'); } };
  }
  return origLoad.apply(this, [request, parent, isMain]);
};
export function loadLambda(dir, names) {
  const file = path.join(ROOT, 'backend', dir, 'src', 'index.js');
  const code = fs.readFileSync(file, 'utf8') + `\n;module.exports.__t={${names.join(',')}};`;
  const m = new Module(file, null);
  m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}

// ---- the record: stories -> archive-style entries ----
const COUNTRIES = require(path.join(ROOT, 'backend/shared/src/iso3Names.json'));
const nameOf = (iso3) => (COUNTRIES[iso3] ? COUNTRIES[iso3].name : iso3);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
let _stories;
export function stories() {
  if (_stories) return _stories;
  _stories = [];
  const dir = path.join(CACHE, 'stories');
  for (const f of fs.readdirSync(dir)) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!s.aliasOf) _stories.push(s);
  }
  return _stories;
}
/** Archive-style entries (the shape the Lambdas' own `project` keeps) from the story views. `ai` carries a summary where the view has one. */
export function entriesOf(story) {
  const a = story.analysis || {};
  const known = new Map((a.entryShortTitles || []).map((x) => [String(x.topicId).replace(/-\d+$/, ''), x.topicId]));
  const regions = (story.iso3 || []).map(nameOf);
  return (story.entries || []).map((e, i) => ({
    topicId: known.get(e.title) || `${e.title}-${i}`,
    threadId: story.threadId, title: e.title, date: e.date, at: e.at,
    regions, category: e.category || '',
    sources: (e.sources || []).slice(0, 3).map((s) => ({ source: host(s.url) || s.outlet, title: s.title, url: s.url, outlet: s.outlet })),
    // the live entry carries a model-written ai.summary (+ prediction, trace_cause); the public views do not keep them, so the first
    // source snippet stands in for the summary line (declared in the report); prediction and root-cause lines are absent
    ai: (e.summary || (e.sources || [])[0]?.snippet) ? { summary: e.summary || e.sources[0].snippet } : {},
  }));
}
export const allEntries = () => stories().flatMap(entriesOf);
export const analysisOf = (threadId) => { const s = stories().find((x) => x.threadId === threadId); return s && s.analysis ? { ...s.analysis, threadId } : null; };
export const analysisAt = (threadId, cutoffIso) => { const a = analysisOf(threadId); return a && a.generatedAt <= cutoffIso ? a : null; };
export const countryView = (iso3) => readJson(`countries/${iso3}.json`);
export const dailyBrief = (d) => readJson(`briefs/daily/${d}.json`)?.brief || null;
export const weeklyBrief = (d) => readJson(`briefs/weekly/${d}.json`)?.brief || null;
export const todayView = () => readJson('index/today.json');
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---- daily brief (newsDailyBrief, dir distribution/newsPostDevTo) ----
const daily = () => loadLambda('distribution/newsPostDevTo', ['buildBriefPrompt', 'checkSummaryFormat']).__t;
const placeFilter = require(path.join(ROOT, 'backend/shared/src/placeFilter.js'));
const { resolveIso3 } = require(path.join(ROOT, 'backend/shared/src/resolveIso3.js'));
const { formatDisplayDate } = require(path.join(ROOT, 'backend/distribution/newsPostDevTo/src/buildDailySummary.js'));
export const checkSummaryFormat = (s) => daily().checkSummaryFormat(s);

export function buildDaily(dateKey, { allowNewer = false } = {}) {
  const base = dailyBrief(dateKey);
  const cutoff = `${dateKey}T14:00:00Z`; // the brief ran at 14:01 UTC
  let entries; let exact = false;
  const tv = todayView();
  if (tv && tv.entries.some((e) => (e.archivedAt || '').slice(0, 10) === dateKey) && base && tv.entries.filter((e) => e.archivedAt.slice(0, 10) === dateKey).length === base.stats.totalArticles) {
    entries = tv.entries.filter((e) => e.archivedAt.slice(0, 10) === dateKey).map((e) => ({ ...e, sources: (e.sources || []).slice(0, 3) }));
    exact = true;
  } else {
    const day = allEntries().filter((e) => e.date === dateKey).sort((a, b) => (a.at < b.at ? -1 : 1));
    const stored = new Set((base?.topStories || []).map((t) => t.title));
    const must = day.filter((e) => stored.has(e.title));
    const rest = day.filter((e) => !stored.has(e.title));
    entries = [...must, ...rest].slice(0, base.stats.totalArticles).sort((a, b) => (a.at < b.at ? -1 : 1));
  }
  const threadAnalyses = {};
  const ids = [...new Set(entries.map((e) => e.threadId).filter(Boolean))].slice(0, 20);
  for (const id of ids) {
    const a = allowNewer ? analysisOf(id) : analysisAt(id, cutoff);
    if (a) threadAnalyses[id] = a;
  }
  const names = [...new Set(entries.flatMap((e) => (e.regions || []).map((r) => resolveIso3(r)?.name || r)))].filter(placeFilter.isCountryName);
  const countryIntel = {};
  for (const name of names.slice(0, 15)) {
    const iso3 = resolveIso3(name)?.iso3; const i = iso3 && countryView(iso3)?.intelligence;
    if (i && (allowNewer || i.generatedAt <= cutoff) && Date.parse(i.generatedAt) > Date.parse(cutoff) - 30 * 86400000) countryIntel[name] = i;
  }
  const prompt = daily().buildBriefPrompt(entries, threadAnalyses, countryIntel, formatDisplayDate(dateKey), dateKey);
  return {
    job: 'daily', id: dateKey, prompt, baseline: base, exact,
    inputNotes: { entries: entries.length, storedTotalArticles: base.stats.totalArticles, threadsWithAnalysis: Object.keys(threadAnalyses).length, countriesWithIntel: Object.keys(countryIntel).length, headlinesWithSummarySnippet: entries.slice(0, 20).filter((e) => e.ai?.summary).length },
    // what the Lambda does with the answer: it parses jsonText(content) and needs headline + summary
    call: { user: prompt, maxTokens: 2000, temperature: 0.3 },
  };
}

// ---- weekly brief (newsWeeklyBrief) ----
const weekly = () => loadLambda('distribution/newsWeeklyBrief', ['buildSignalsPrompt', 'groupByThread', 'parseJson']).__t;
export const parseWeekly = (c) => weekly().parseJson(c);
export function buildWeekly(weekKey, { strict = true, storedThreads = false } = {}) {
  const base = weeklyBrief(weekKey);
  const cutoff = `${weekKey}T06:00:00Z`;
  const lo = addDays(weekKey, -7);
  // Sunday 06:00 UTC: days weekKey-7 .. weekKey-1 are complete; the run's own day holds only the 04:25 run (not rebuilt here)
  const entries = allEntries().filter((e) => e.threadId && e.date >= lo && e.date < weekKey);
  let threads = weekly().groupByThread(entries);
  if (storedThreads && base) { const order = base.threadIds; threads = order.map((id) => threads.find((t) => t.threadId === id)).filter(Boolean); }
  threads = threads.slice(0, 6);
  const threadCtx = threads.map((t) => ({ ...t, analysis: strict ? analysisAt(t.threadId, cutoff) : analysisOf(t.threadId) }));
  const prompt = weekly().buildSignalsPrompt(weekKey, threadCtx);
  const same = base ? threads.filter((t) => (base.threadIds || []).includes(t.threadId)).length : null;
  return {
    job: 'weekly', id: weekKey, prompt, baseline: base,
    inputNotes: { entriesInWindow: entries.length, threads: threads.length, threadsMatchingStoredBrief: same, storedThreadIds: base?.threadIds?.length ?? null, threadsWithAnalysis: threadCtx.filter((t) => t.analysis).length },
    threadIds: threads.map((t) => t.threadId),
    call: { user: prompt, maxTokens: 3500, temperature: 0.3, json: true },
  };
}

// ---- country intelligence (newsCountryIntelligence) ----
let _ci;
const ci = () => (_ci = _ci || loadLambda('pipeline/newsCountryIntelligence', ['groupByCountry', 'generateCountryIntelligence']).__t);
export function countryEntries(D, daysBack = 30, lastDay = 'partial') {
  const lo = addDays(D, -daysBack);
  return allEntries().filter((e) => e.date >= lo && e.date <= D && (lastDay === 'full' || lastDay === 'partial' || e.date < D));
}
/** The prompt the Lambda's own generateCountryIntelligence builds for `iso3`, with the model call replaced by a capture. */
export async function buildCountry(iso3, { lastDay = 'partial' } = {}) {
  const view = countryView(iso3); const base = view.intelligence;
  const D = base.generatedAt.slice(0, 10);
  const cutoff = base.generatedAt;
  const entries = countryEntries(D, 30, lastDay);
  const threadAnalyses = {};
  for (const id of new Set(entries.map((e) => e.threadId).filter(Boolean))) { const a = analysisAt(id, cutoff) || analysisOf(id); if (a) threadAnalyses[id] = a; }
  const grouped = ci().groupByCountry(entries, threadAnalyses);
  const c = grouped.find((g) => g.countryName === base.countryName);
  if (!c) throw new Error('no group for ' + iso3);
  // the drift notes the live run would read: the view lists the country's drift rows newest first
  ctx.drift = (view.drift || []).filter((d) => d.generatedAt <= cutoff).slice(0, 2).map(({ from, generatedAt, model, ...r }) => r);
  let captured = null;
  ctx.capture = (o) => { captured = o; };
  try { await ci().generateCountryIntelligence(c); } catch (e) { if (e.message !== 'captured') throw e; }
  ctx.capture = null;
  if (!captured) throw new Error('no prompt captured');
  // The prompt embeds `new Date()` for "from today"; the run date of the baseline is what the live run saw
  const today = new Date().toISOString().slice(0, 10);
  const prompt = captured.user.split(today).join(D);
  return {
    job: 'country', id: iso3, prompt, baseline: base,
    inputNotes: {
      runDate: D, rebuilt: { totalArticles: c.totalArticles, dayCount: c.dayCount, arcs: c.threads.length, dateRange: c.dateRange },
      stored: { totalArticles: base.totalArticles, dayCount: base.dayCount, arcs: base.activeArcCount, dateRange: base.dateRange },
      threadsWithAnalysis: c.threads.filter((t) => t.storyArc).length, driftNotes: ctx.drift.length,
    },
    call: { user: prompt, maxTokens: 5000, temperature: 0.3, topP: 0.9 },
  };
}

// ---- thread analysis (newsThreadAnalysis) ----
let _ta;
const ta = () => (_ta = _ta || loadLambda('pipeline/newsThreadAnalysis', ['generateThreadAnalysis']).__t);
export function threadCandidates() {
  return stories().filter((s) => s.analysis && s.analysis.generatedAt && s.analysis.model).map((s) => {
    const a = s.analysis; const cut = a.generatedAt.slice(0, 10);
    const es = entriesOf(s).filter((e) => e.date <= cut).sort((x, y) => x.date.localeCompare(y.date));
    return { threadId: s.threadId, generatedAt: a.generatedAt, model: a.model, storedEntries: a.entryCount, rebuilt: es.length, title: a.threadTitle };
  }).filter((c) => c.storedEntries >= 2);
}
export async function buildThread(threadId) {
  const s = stories().find((x) => x.threadId === threadId); const base = s.analysis;
  const cut = base.generatedAt.slice(0, 10);
  const es = entriesOf(s).filter((e) => e.date <= cut).sort((x, y) => x.date.localeCompare(y.date));
  let captured = null; ctx.capture = (o) => { captured = o; };
  try { await ta().generateThreadAnalysis({ threadId, entries: es }); } catch (e) { if (e.message !== 'captured') throw e; }
  ctx.capture = null;
  return {
    job: 'thread', id: threadId, prompt: captured.user, baseline: base, entries: es,
    inputNotes: { storedEntryCount: base.entryCount, rebuiltEntries: es.length, entriesWithAiSummary: es.filter((e) => e.ai?.summary).length, generatedAt: base.generatedAt },
    call: { user: captured.user, maxTokens: 3500, temperature: 0.2, topP: 0.9, json: true },
  };
}

// ---- systems analysis (newsSystemsAnalysis) ----
let _sy;
const sy = () => (_sy = _sy || loadLambda('pipeline/newsSystemsAnalysis', ['groupByCountry', 'buildSystemsPrompt', 'validateGraph', 'buildBackboneEdges']).__t);
export const webIndex = () => JSON.parse(fs.readFileSync(path.join(CACHE, 'index/web.json'), 'utf8'));
export function buildSystems(countryName, runAt) {
  const web = webIndex();
  const used = web.websUsed.find((w) => w.country === countryName);
  const when = runAt || used.generatedAt; const D = when.slice(0, 10);
  const lo = addDays(D, -30);
  const entries = allEntries().filter((e) => e.date >= lo && e.date <= D).map((e) => ({ ...e, sources: (e.sources || []).map((s) => ({ url: s.url })), category: (e.category || 'other').toLowerCase() }));
  const analyses = {};
  for (const id of new Set(entries.map((e) => e.threadId).filter(Boolean))) { const a = analysisOf(id); if (a) analyses[id] = a; }
  const country = sy().groupByCountry(entries, analyses).find((c) => c.countryName === countryName);
  if (!country) throw new Error('no systems group for ' + countryName);
  const today = new Date().toISOString().slice(0, 10);
  const prompt = sy().buildSystemsPrompt(country).split(today).join(D);
  const links = web.links.filter((l) => l.country === countryName);
  return {
    job: 'systems', id: countryName, prompt, country, baseline: { used, links },
    inputNotes: { runDate: D, threads: country.threads.length, storedNodes: used.nodes, shownEntries: country.threads.reduce((n, t) => n + t.shown.length, 0), totalArticles: country.totalArticles },
    call: { system: 'You are a causal analysis engine. Return only valid JSON. No markdown, no commentary.', user: prompt, maxTokens: 3000, temperature: 0.3, json: true },
    validate: (parsed) => sy().validateGraph(JSON.parse(JSON.stringify(parsed)), country),
  };
}
