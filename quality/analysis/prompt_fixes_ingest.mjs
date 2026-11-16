// newsIngest topic-selection prompt fix (2026-11-16): unrelated events merged into one topic; more topics than the limit (Sonnet 5.5).
// Re-runs the 4 recorded inputs of the intake test (inputs.json: the pool of articles per simulated run time) through the Lambda's own prompt
// builder, collapse, newest-per-feed and filters, and the shared chat() with the handler's exact options.
//   OUT=<dir> INPUTS=<ingest inputs.json> SRC=<newsInvokeGemini src dir> node prompt_fixes_ingest.mjs <tag> <haiku|sonnet> <reps>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as L from './prompt_fixes_lib.mjs';
const require = createRequire(import.meta.url);
const [tag, model = 'sonnet', repsArg = '1'] = process.argv.slice(2);
const SRC = process.env.SRC;
const real = require('node:module').createRequire(path.join(SRC, 'index.js'));
const sdk = (n) => (n.startsWith('@aws-sdk/') ? new Proxy({}, { get: () => class { constructor() {} send() { throw new Error('AWS call blocked'); } static from() { return new this(); } } }) : null);
const context = { exports: {}, process: { env: { GROK_MODEL: 'unused' } }, console, Date, setTimeout, clearTimeout, URL, AbortController, fetch, require: (n) => sdk(n) || real(n) };
vm.runInNewContext(fs.readFileSync(path.join(SRC, 'index.js'), 'utf8'), context);
const I = context.exports._internal;
const { collapseSameEvent, dropRepeatTopics, newestPerFeed } = require(path.join(SRC, 'dedupe.js'));
const inp = JSON.parse(fs.readFileSync(process.env.INPUTS, 'utf8'));
const LIMIT = inp.limit;

// the handler's post-processing with the Lambda's exported pure functions (as in the intake test)
function postprocess(text, run) {
  let parsed; const out = { parse: 'direct' };
  try { parsed = JSON.parse(text); } catch { try { parsed = I.extractJson(text); out.parse = 'extracted'; } catch { return { parse: 'FAILED' }; } }
  const raw = Array.isArray(parsed) ? parsed : (parsed?.topics || []);
  const valid = new Map(run.poolArticles.map((a) => [I.normalizeSourceUrl(a.url), a]));
  const normalized = raw.map((t) => {
    const sources = (Array.isArray(t?.sources) ? t.sources : []).filter((s) => s?.url && valid.has(I.normalizeSourceUrl(s.url))).map((s) => ({ ...s, url: valid.get(I.normalizeSourceUrl(s.url)).url }));
    return { ...t, title: String(t?.title || '').trim(), category: String(t?.category || '').trim().toLowerCase(), iso3: I.canonicalIso3(t?.iso3, () => {}), sources };
  });
  const w = console.warn; console.warn = () => {};
  let filtered = I.filterTopics(normalized);
  const rep = dropRepeatTopics(filtered, inp.pastArchiveTitles.filter((e) => e.date >= new Date(Date.parse(run.simulatedAt) - 864e5).toISOString().slice(0, 10)).map((e) => e.title));
  filtered = I.capTopics(rep.topics, LIMIT);
  console.warn = w;
  // topics whose sources span two clusters of unrelated titles are the "merged" ones: list titles + source titles for the hand read
  const view = filtered.map((t) => ({ title: t.title, n: t.sources.length, sourceTitles: t.sources.map((s) => (valid.get(I.normalizeSourceUrl(s.url))?.title || '?').slice(0, 90)) }));
  return { ...out, raw: raw.length, kept: filtered.length, overLimit: raw.length > LIMIT, andTitles: filtered.filter((t) => /\b(and|as|plus|while)\b/i.test(t.title)).length, view };
}

const reps = Number(repsArg);
const jobs = [];
for (const r of inp.runs) for (let k = 1; k <= reps; k++) jobs.push({ r, k });
await L.pool(jobs, async ({ r, k }) => {
  const f = path.join(L.OUT, tag, `${r.id}-${model}-r${k}.json`);
  if (fs.existsSync(f)) return;
  const all = r.poolArticles; // url-deduped pool of that simulated run
  const { items } = collapseSameEvent(all);
  const prompt = I.buildSelectionPrompt({ articles: newestPerFeed(items, 8), limit: LIMIT, seenEntries: [], pastArchiveTitles: inp.pastArchiveTitles });
  const sameAsRecorded = prompt === r.prompt;
  const res = await L.call(`ingest|${tag}`, model, { step: 'topic_selection', system: 'You are a news analyst that returns only valid JSON. No commentary or markdown.', user: prompt, json: true, temperature: 0.5, maxTokens: 12000, timeoutMs: 600000, retries: 2 });
  const rec = { run: r.id, finish: res.finishReason, out: res.usage?.completion_tokens, usd: res.usd, sameAsRecorded, post: postprocess(res.content, r), text: res.content };
  L.write(f, rec);
  console.log(tag, r.id, `r${k}`, res.finishReason, `out=${rec.out}`, `raw=${rec.post.raw} kept=${rec.post.kept} over=${rec.post.overLimit} promptSameAsRecorded=${sameAsRecorded}`);
});
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
