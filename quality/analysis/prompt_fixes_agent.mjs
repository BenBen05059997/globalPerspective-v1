// newsAgent prompt fixes (2026-11-16): summary rule 5, trace_cause evidence grounding, forecast statement verbs. Re-runs the recorded 8 stories
// (inputs.json of the intake test) through the Lambda's own prompt builders and gate code and the shared chat() with invokeGrok's options and the
// LIVE caps (summary and trace_cause 1500, forecast 2500).
//   OUT=<dir> INPUTS=<inputs.json> SRC=<lambda src dir> node prompt_fixes_agent.mjs <tag> <haiku|sonnet> <reps>
// SRC = the worktree's src for "after", a copy of the committed-before src for "before".
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as L from './prompt_fixes_lib.mjs';
const require = createRequire(import.meta.url);
const [tag, model = 'sonnet', repsArg = '2'] = process.argv.slice(2);
const SRC = process.env.SRC; const INPUTS = process.env.INPUTS;
const draw = require(path.join(SRC, 'forecast-draw.js'));
const lib = require(path.join(SRC, 'lib.js'));
const questions = require(path.join(SRC, 'questions.js'));

function loadLambda() {
  const real = require('node:module').createRequire(path.join(SRC, 'index.js'));
  const Stub = class { constructor() {} send() { throw new Error('AWS call blocked'); } static from() { return new Stub(); } };
  const sdk = (n) => (n.startsWith('@aws-sdk/') ? new Proxy({}, { get: () => Stub }) : null);
  const context = { exports: {}, module: { exports: {} }, process: { env: {} }, console, Date, Buffer, setTimeout, clearTimeout, URL, AbortController, fetch, require: (n) => sdk(n) || real(n) };
  vm.runInNewContext(fs.readFileSync(path.join(SRC, 'index.js'), 'utf8'), context);
  return context;
}
const lam = loadLambda();
const inp = JSON.parse(fs.readFileSync(INPUTS, 'utf8'));

const nums = (t) => (String(t).replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) || []);
const ungroundedNums = (text, hay) => { const h = String(hay).replace(/(\d),(?=\d{3})/g, '$1'); return [...new Set(nums(text))].filter((n) => !new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}([^\\d]|$)`).test(h)); };
// capitalised words (not sentence-initial) that the prompt does not contain: a hint for the hand read, not a verdict
const ungroundedNames = (text, hay) => {
  const h = String(hay).toLowerCase(); const out = new Set();
  for (const m of String(text).matchAll(/(?<![.!?]\s)(?<!^)\b([A-Z][a-zA-Z'’-]{3,})\b/g)) if (!h.includes(m[1].toLowerCase())) out.add(m[1]);
  return [...out];
};

const META = /\b(snippets?|the sources?|the title|the headline|per the title|cut off|source(?:s)? (?:do|does|did) not|not reported by the)\b/gi;
function checkSummary(text) {
  return { bullets: text.split('\n').filter((l) => /^\s*[-*•]\s+/.test(l)).length, words: L.words(text), meta: (text.match(META) || []).length, metaHits: (text.match(META) || []).slice(0, 4) };
}
function checkTrace(text, prompt) {
  let o; try { o = JSON.parse(text); } catch { return { parse: false }; }
  const miss = [];
  if (!(o.proximate && typeof o.proximate.what === 'string' && typeof o.proximate.when === 'string')) miss.push('proximate');
  if (!(Array.isArray(o.contributing) && o.contributing.length >= 2 && o.contributing.length <= 4 && o.contributing.every((c) => c.factor && c.evidence))) miss.push('contributing');
  if (!(o.structural && o.structural.factor && o.structural.depth)) miss.push('structural');
  const sc = o.impactScores || {};
  if (!['humanImpact', 'economicReach', 'geopolitical'].every((k) => Number.isInteger(sc[k]) && sc[k] >= 1 && sc[k] <= 10)) miss.push('impactScores');
  if (!(o.signalVsNoise && ['True Signal', 'Noise', 'Uncertain'].includes(o.signalVsNoise.verdict))) miss.push('signalVsNoise');
  const ev = (o.contributing || []).map((c) => c.evidence).join(' ');
  const hay = prompt;
  return { parse: true, schemaMissing: miss, evidenceSnippetMentions: (ev.match(/\bsnippets?\b/gi) || []).length, evidenceUngroundedNums: ungroundedNums(ev, hay), evidenceUngroundedNames: ungroundedNames(ev, hay), proximateUngroundedNums: ungroundedNums(o.proximate?.what || '', hay) };
}
function checkForecast(text, st) {
  let parsed; try { parsed = JSON.parse(text); } catch { return { parse: false }; }
  const miss = [];
  if (!Array.isArray(parsed.outcomes)) miss.push('outcomes'); else if (parsed.outcomes.length > 3) miss.push('outcomes>3');
  if (!Array.isArray(parsed.precedents) || parsed.precedents.length !== 5) miss.push(`precedents=${parsed.precedents?.length}`);
  for (const [i, o] of (parsed.outcomes || []).entries()) for (const k of ['text', 'deadline', 'p', 'resolution_source', 'rationale']) if (o[k] == null || o[k] === '') miss.push(`outcome${i}.${k}`);
  const g = lib.groundForecastContent(draw.outcomesToScenarios(parsed), st.inputText, st.day);
  const gated = lib.buildGatedScenarios(g.parsed.scenarios || [], {
    generatedAtDay: st.day, fallbackYear: 2026, facts: [], pk: `PRED#${st.topic.id}`, sk: st.day,
    snippets: [st.topic.title, st.topic.description, ...st.topic.sources.map((s) => s.snippet)].filter(Boolean).map(String),
    priorTexts: [], priorEntries: st.priorEntries, inputText: st.inputText, outcomeMode: true,
  });
  const outs = parsed.outcomes || [];
  const saidWords = outs.filter((o) => questions.SAID.test(o.text)).map((o) => o.text);
  const droppedG14 = gated.capture.dropped.filter((d) => d.gate === 'G14').length;
  return { parse: true, schemaMissing: miss, outcomes: outs.length, kept: gated.capture.kept, dropped: gated.capture.dropped.map((d) => d.gate), droppedG14, saidVerbOutcomes: saidWords.length, saidTexts: saidWords, groundRemoved: g.removed.length };
}

const reps = Number(repsArg);
const jobs = [];
for (const st0 of inp.stories) {
  // rebuild the prompts with THIS code (summary, trace_cause, forecast), same arguments as the intake test's prep
  const st = { ...st0 };
  const v1 = { premiseBlock: '', arcDigest: st.prompts.forecast.match(/How this story has evolved[^\n]*\n([\s\S]*?)\n\n/)?.[1] || '' };
  st.prompts = {
    summary: lam.buildSummaryPrompt(st.topic, st.generatedDate),
    trace_cause: lam.buildTraceCausePrompt(st.topic, st.generatedDate),
    forecast: draw.buildPredictionPrompt(st.topic, st.generatedDate, 2026, v1, st.day),
  };
  st.inputText = draw.forecastInputText(st.topic, v1);
  for (const step of (process.env.STEPS || 'summary,trace_cause,forecast').split(',')) for (let r = 1; r <= reps; r++) jobs.push({ st, step, r });
}
await L.pool(jobs, async ({ st, step, r }) => {
  const f = path.join(L.OUT, tag, step, `${st.key}-${model}-r${r}.json`);
  if (fs.existsSync(f)) return;
  // invokeGrok's chat() options at the live caps: user-only message, json for trace_cause and forecast, timeout 180 s, 1 transport retry
  const opts = { step, user: st.prompts[step], maxTokens: step === 'forecast' ? 2500 : 1500, temperature: 0.2, topP: 0.9, json: step !== 'summary', timeoutMs: 180000, retries: 1 };
  let res;
  try { res = await L.call(`agent|${tag}|${step}`, model, opts); } catch (e) { L.write(f, { error: e.message }); return; }
  const text = L.stripCodeFence(res.content);
  const rec = { story: st.key, step, finish: res.finishReason, out: res.usage?.completion_tokens, usd: res.usd, text };
  rec.check = step === 'summary' ? checkSummary(text) : step === 'trace_cause' ? checkTrace(text, st.prompts.trace_cause) : checkForecast(text, st);
  L.write(f, rec);
  console.log(tag, step, st.key, `r${r}`, res.finishReason, JSON.stringify(rec.check).slice(0, 160));
});
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
