// Prompt fixes for the briefs and analysis jobs (2026-11-16): daily brief, systems analysis, country intelligence. Re-runs the recorded inputs of the
// briefs test (the exact prompts the Lambdas built from the rebuilt record, input_prompt.txt per sample) on Haiku 5.5 through the shared chat() with
// each Lambda's own options and live caps.
//   "before" = the recorded prompt unchanged. "after" = the recorded prompt with each prompt line that the change replaced swapped for the new
//   line, where old and new lines are read from the Lambda source (OLD = the committed-before copy of index.js, NEW = the worktree's index.js);
//   a template-literal prompt line is the prompt text, so the swap is exact. A swap that does not hit exactly one line aborts.
//   OUT=<dir> RECORDED=<briefs dir of the test> OLD=<old index.js> NEW=<new index.js> node prompt_fixes_prompts.mjs <daily|systems|country> <before|after> <reps> [model]
import fs from 'node:fs';
import path from 'node:path';
import * as L from './prompt_fixes_lib.mjs';
const [job, variant, repsArg = '2', model = 'haiku'] = process.argv.slice(2);
const RECORDED = process.env.RECORDED;
const reps = Number(repsArg);

const lines = (f) => fs.readFileSync(f, 'utf8').split('\n');
function swaps() {
  const o = lines(process.env.OLD); const n = lines(process.env.NEW);
  const nSet = new Set(n); const oSet = new Set(o);
  const A = o.filter((l) => !nSet.has(l) && l.trim()); const B = n.filter((l) => !oSet.has(l) && l.trim());
  if (A.length !== B.length) throw new Error(`changed lines differ in number (${A.length} old, ${B.length} new): pair them by hand`);
  return A.map((a, i) => [a, B[i]]);
}
function applySwaps(prompt) {
  let out = prompt; const date = /from today \((\d{4}-\d{2}-\d{2})\)/.exec(prompt)?.[1];
  for (const [a0, b0] of swaps()) {
    const fill = (l) => (date ? l.replace('${new Date().toISOString().slice(0, 10)}', date) : l);
    const a = fill(a0); const b = fill(b0);
    if (out.split(a).length !== 2) throw new Error(`old line not found exactly once: ${a.slice(0, 80)}`);
    out = out.replace(a, () => b);
  }
  return out;
}

const SAMPLES = { daily: ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'], systems: ['China', 'France', 'Iran'], country: ['UKR', 'CHN', 'UGA', 'BRA', 'ETH'] };
const OPTS = {
  daily: { step: 'daily_brief', maxTokens: 4000, temperature: 0.3 },
  systems: { step: 'systems_web', system: 'You are a causal analysis engine. Return only valid JSON. No markdown, no commentary.', maxTokens: 6000, temperature: 0.2, json: true },
  country: { step: 'country_intel', maxTokens: 5000, temperature: 0.2, topP: 0.9 },
};
const words = L.words;
const bold = (s) => (String(s || '').match(/\*\*[^*]+\*\*/g) || []).length;

function check(text, prompt) {
  const o = { fenced: /^\s*```/.test(text), prose: !/^\s*(```|[{[])/.test(text) };
  let p; try { p = JSON.parse(L.jsonText(text)); o.parse = true; } catch (e) { o.parse = false; o.err = e.message.slice(0, 80); return o; }
  if (job === 'daily') { o.words = words(p.summary); o.bold = bold(p.summary); o.over350 = o.words > 350; o.boldOk = o.bold === 4; o.headlineWords = words(p.headline); o.top = (p.topStories || []).length; }
  if (job === 'systems') {
    const peak = Object.fromEntries([...prompt.matchAll(/threadId: "([^"]+)"\s+category: [^\n]*\s+peakDate: (\d{4}-\d{2}-\d{2})/g)].map((m) => [m[1], m[2]]));
    const codes = new Set(prompt.match(/\bE\d+(?= \|)/g));
    const ids = new Set((p.nodes || []).map((n) => n.threadId).filter((id) => peak[id]));
    const good = (p.edges || []).filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && (e.citedEntries || []).some((c) => codes.has(String(c).trim().split(/\s/)[0])));
    o.threads = Object.keys(peak).length; o.nodes = ids.size; o.edges = (p.edges || []).length; o.validEdges = good.length;
    o.effectBeforeCause = good.filter((e) => peak[e.to] < peak[e.from]).length;
    o.negativeLag = good.filter((e) => Number(e.lagDays) < 0).length;
    o.edgeList = good.map((e) => `${e.from.slice(7, 30)}(${peak[e.from]}) -> ${e.to.slice(7, 30)}(${peak[e.to]}) lag ${e.lagDays} ${e.confidence}`);
  }
  if (job === 'country') {
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const inPrompt = (iso) => { if (prompt.includes(iso)) return true; const [, m, d] = iso.split('-').map(Number); return new RegExp(`\\b${MON[m - 1]} ${d}\\b|\\b${d} ${MON[m - 1]}\\b`, 'i').test(prompt) || prompt.includes(`${MON[m - 1].slice(0, 3)} ${d}`); };
    const lists = { kd: p.keyDevelopments || [], bt: p.backgroundTimeline || [], rs: p.riskSignals || [] };
    o.kd = lists.kd.length; o.bt = lists.bt.length; o.rs = lists.rs.length;
    o.datesNotInInput = [...lists.kd.map((x) => x.date), ...lists.bt.map((x) => x.date)].filter((d) => d && !inPrompt(d));
    const MD = new RegExp(`\\b(${MON.join('|')}) \\d{1,2}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\bexpected by\\b|\\bby (the )?(end of|mid|late|early)\\b|\\bwithin (\\d+|two|three|a few) (days|weeks)\\b`, 'gi');
    o.riskSignalDated = lists.rs.filter((r) => (String(r).match(MD) || []).length).length;
    o.riskSignalText = lists.rs;
    o.keyDevCount = lists.kd.length;
  }
  return o;
}

const jobs = [];
for (const s of SAMPLES[job]) for (let r = 1; r <= reps; r++) jobs.push({ s, r });
await L.pool(jobs, async ({ s, r }) => {
  const f = path.join(L.OUT, `${job}-${variant}`, `${s}-${model}-r${r}.json`);
  if (fs.existsSync(f)) return;
  const rec0 = fs.readFileSync(path.join(RECORDED, job, s, 'input_prompt.txt'), 'utf8');
  const prompt = variant === 'after' ? applySwaps(rec0) : rec0;
  const res = await L.call(`${job}|${variant}`, model, { ...OPTS[job], user: prompt, timeoutMs: 300000, retries: 1 });
  const rec = { sample: s, finish: res.finishReason, out: res.usage?.completion_tokens, usd: res.usd, check: check(res.content, prompt), text: res.content };
  L.write(f, rec);
  console.log(job, variant, s, `r${r}`, res.finishReason, `out=${rec.out}`, JSON.stringify({ ...rec.check, edgeList: undefined, riskSignalText: undefined }).slice(0, 220));
});
console.log('spent', L.spent().toFixed(3), '429 waits', L.stats.retries429);
