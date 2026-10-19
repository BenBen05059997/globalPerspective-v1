#!/usr/bin/env node
// P0 before/after harness for the grounded-forecast change (plan: project-docs/prediction/_active/
// TASK_2026-10-17_grounded_forecast_and_cost.md). Read-only against AWS; spends a few cents of DeepSeek.
//
//   A = the old path: research briefing call + forecast call, old prompts, old gates G1-G12
//   B = the new path: one grounded forecast call, new prompt, gates G1-G12 + G13
//
// Both are run on the same inputs: the staging topics the research job would process next, FACTS#
// premises and the 7-day archive digest, built with the job's own (loaded, not copied) helpers.
//
//   node predictions/forecast-ab/run.mjs                 # call DeepSeek, write results + report
//   node predictions/forecast-ab/run.mjs --from-cache    # recompute metrics/report from results JSON
//
// Secrets: the DeepSeek key is read from the job's Lambda env via the AWS CLI INSIDE this process
// and kept in memory only (operator approval 2026-10-17). It is never printed, logged or written.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FN_DIR = 'backend/pipeline/NewsProjectInvokeAgentLambda';
const OLD_FN_DIR = 'amplify/backend/function/NewsProjectInvokeAgentLambda'; // its path at OLD_REF, before the move to backend/
const FN = 'NewsProjectInvokeAgentLambda-dev';
const REGION = 'ap-northeast-1';
const OLD_REF = process.env.OLD_REF || '0ef24cf'; // last commit with the two-call job
const HELD = process.argv.some((a) => a.startsWith('--days='));
const RESULTS = path.join(HERE, HELD ? 'results_heldout_2026-10-17.json' : 'results_2026-10-17.json');
const REPORT = path.join(HERE, HELD ? 'REPORT_heldout_2026-10-17.md' : 'REPORT_2026-10-17.md');
const FROM_CACHE = process.argv.includes('--from-cache');
const REDO_B = process.argv.includes('--redo-b'); // keep cached A, re-run only B (prompt iteration)
// --days N: test on archived stories from the N days before today (unseen during prompt tuning), one per thread, max 40.
const DAYS = Number((process.argv.find((a) => a.startsWith('--days=')) || '').split('=')[1]) || 0;
const CONCURRENCY = 4;

// DeepSeek v4-pro, $ per 1M tokens, [off-peak, peak] (project-docs/ops/DEEPSEEK_COST_ESTIMATE.md)
const PRICE = { hit: [0.022, 0.044], miss: [0.66, 1.32], out: [1.98, 3.96] };
const isPeak = (d = new Date()) => {
  const dow = d.getUTCDay(); const h = d.getUTCHours();
  return dow >= 1 && dow <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
};
const dollars = (u, peak) => {
  if (!u) return 0;
  const i = peak ? 1 : 0;
  const hit = u.prompt_cache_hit_tokens || 0;
  const miss = u.prompt_cache_miss_tokens != null ? u.prompt_cache_miss_tokens : Math.max(0, (u.prompt_tokens || 0) - hit);
  return (hit * PRICE.hit[i] + miss * PRICE.miss[i] + (u.completion_tokens || 0) * PRICE.out[i]) / 1e6;
};

// ── load the job's code (old = git ref, new = working tree) with AWS SDK modules stubbed ──────────
function loadJob(srcDir, extraExports) {
  const req = createRequire(path.join(srcDir, 'index.js'));
  const origLoad = Module._load;
  class Stub { constructor() {} send() { throw new Error('AWS call attempted in harness'); } static from() { return new Stub(); } }
  Module._load = function (request, ...rest) {
    if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => Stub });
    return origLoad.call(this, request, ...rest);
  };
  try {
    const file = path.join(srcDir, 'index.js');
    const m = new Module(file, null);
    m.filename = file; m.paths = Module._nodeModulePaths(srcDir); m.require = req;
    m._compile(fs.readFileSync(file, 'utf8') + `\nmodule.exports.__t = { ${extraExports} };\n`, file);
    return { ...m.exports.__t, lib: req('./lib') };
  } finally { Module._load = origLoad; }
}

function exportOldSources() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'forecast-old-'));
  for (const f of ['index.js', 'lib.js', 'questions.js', 'matcher.js', 'entity-normalize.js', 'url-normalize.js']) {
    fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', `${OLD_REF}:${OLD_FN_DIR}/src/${f}`], { cwd: REPO, maxBuffer: 1 << 26 }));
  }
  return dir;
}

// ── AWS reads (CLI) ─────────────────────────────────────────────────────────────────────────────
const aws = (args) => JSON.parse(execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], { maxBuffer: 1 << 28 }).toString() || 'null');
function unm(v) {
  if (v == null) return v;
  if ('S' in v) return v.S; if ('N' in v) return Number(v.N); if ('BOOL' in v) return v.BOOL; if ('NULL' in v) return null;
  if ('L' in v) return v.L.map(unm); if ('M' in v) return Object.fromEntries(Object.entries(v.M).map(([k, x]) => [k, unm(x)]));
  if ('SS' in v) return v.SS; return v;
}
const getItem = (table, key) => { const r = aws(['dynamodb', 'get-item', '--table-name', table, '--key', JSON.stringify(key)]); return r && r.Item ? unm({ M: r.Item }) : null; };

function lambdaEnv() {
  const cfg = aws(['lambda', 'get-function-configuration', '--function-name', FN]);
  return cfg.Environment.Variables; // held in memory; never printed or written
}

const pad = (n) => String(n).padStart(2, '0');

// ── metrics ──────────────────────────────────────────────────────────────────────────────────────
function analyse(lib, raw, inputText, day, gated) {
  // raw = parsed model JSON; gated = lib.buildGatedScenarios output
  const scenarios = Array.isArray(raw.scenarios) ? raw.scenarios : [];
  const index = lib.buildGroundIndex ? lib.buildGroundIndex(inputText, day) : null;
  const claims = [];
  const claimsPostGate = [];
  scenarios.forEach((s, si) => {
    const dls = (s.triggers || []).map((t) => lib.normalizeTrigger(t, 2026).deadline);
    const rat = String(s.rationale || '');
    for (const c of lib.ungroundedClaims ? lib.ungroundedClaims(rat, index, dls) : []) claims.push({ where: `${s.label} rationale`, ...c });
    (s.triggers || []).forEach((t) => {
      const n = lib.normalizeTrigger(t, 2026);
      for (const c of lib.ungroundedClaims ? lib.ungroundedClaims(n.text, index, [n.deadline]) : []) claims.push({ where: `${s.label} trigger "${n.text.slice(0, 70)}"`, ...c });
    });
  });
  // what a reader/the log still carries after the gates (stripped rationale; demoted triggers are narrative)
  gated.scenarios.forEach((s) => {
    for (const c of lib.ungroundedClaims ? lib.ungroundedClaims(String(s.rationale || ''), index, s.triggers.map((t) => t.deadline)) : []) claimsPostGate.push({ where: `${s.label} rationale`, ...c });
  });
  const allTrig = scenarios.flatMap((s) => (s.triggers || []).map((t) => lib.normalizeTrigger(t, 2026)));
  const leads = allTrig.filter((t) => t.deadline).map((t) => Math.round((Date.parse(t.deadline) - Date.parse(day)) / 86400000));
  const qs = gated.scenarios.flatMap((s) => s.triggers.filter((t) => t.question === true));
  const qLeads = qs.map((t) => Math.round((Date.parse(t.deadline) - Date.parse(day)) / 86400000));
  const ranges = scenarios.map((s) => String(s.probability_range || '').replace(/\s/g, ''));
  return {
    claims, claimsPostGate,
    rawTriggers: allTrig.length, rawLeadMean: mean(leads), rawLeadUnder7: leads.filter((l) => l < 7).length, rawLeadN: leads.length,
    questions: qs.length, qLeadMean: mean(qLeads),
    narrativeG13: gated.capture.dropped.filter((d) => d.gate === 'G13').length,
    dropped: gated.capture.dropped.map((d) => `${d.gate}${d.field ? '/' + d.field : ''}`),
    ranges, mostLikelyRange: ranges[0] || '',
  };
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f1 = (x) => (x == null ? 'n/a' : x.toFixed(1));
const parseJson = (s) => { try { return JSON.parse(String(s).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); } catch { return null; } };

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const oldDir = exportOldSources();
const NEW_DIR = path.join(REPO, FN_DIR, 'src');
const EXPORTS = 'buildTopic, buildPremiseBlock, buildArcDigest, buildPredictionPrompt, buildStableTopicId, collectRegions, factsForTopic';
const oldJob = loadJob(oldDir, EXPORTS + ', buildResearchPrompt');
const newJob = loadJob(NEW_DIR, EXPORTS + ', forecastInputText');
const DAY = new Date().toISOString().slice(0, 10);

let results;
if (FROM_CACHE) {
  results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
} else {
  const env = lambdaEnv();
  const KEY = env.XAI_API_KEY; const URL = env.GROK_API_URL; const MODEL = env.PREDICTION_MODEL || env.GROK_MODEL;
  if (!KEY || !URL || !MODEL) throw new Error('job env is missing key/url/model');

  async function llm(prompt, maxTokens, json = false) {
    const body = newJob.lib.buildChatBody({ model: MODEL, prompt, maxTokens, temperature: 0.2, topP: 0.9, json });
    const peak = isPeak();
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(`LLM ${r.status}: ${j?.error?.message || 'error'}`);
    return { content: j.choices?.[0]?.message?.content || '', usage: j.usage || null, peak, model: j.model || MODEL };
  }

  const staging = getItem('NewsCache', { id: { S: 'staging' } });
  let rawTopics = staging.topics;
  if (DAYS) {
    const seen = new Set(staging.topics.map((t) => t.threadId).filter(Boolean));
    rawTopics = [];
    for (let i = 1; i <= DAYS && rawTopics.length < 40; i++) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
      const it = getItem('NewsCache', { id: { S: `archive#${d.toISOString().slice(0, 10)}` } });
      for (const e of it?.entries || []) {
        if (rawTopics.length >= 40 || !e.threadId || seen.has(e.threadId) || !(e.sources || []).length) continue;
        seen.add(e.threadId); rawTopics.push({ ...e, _day: d.toISOString().slice(0, 10) });
      }
    }
  }
  const topics = rawTopics.map((t, i) => ({ ...newJob.buildTopic(t, i), _day: t._day }));
  const regions = newJob.collectRegions(topics);
  const factsByCountry = {};
  for (const c of regions) {
    const it = getItem('SummarizeAndPredict', { PK: { S: `FACTS#${c}` }, SK: { S: 'COUNTRY_FACTS' } });
    if (it) factsByCountry[c] = { country: c, current: [it.headOfState?.name, it.headOfGovernment?.name].filter(Boolean), stale: [], leadershipString: it.leadershipString || '' };
  }
  const pastEntries = [];
  for (let i = 1; i <= 7 + DAYS; i++) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
    const key = `archive#${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const it = getItem('NewsCache', { id: { S: key } });
    for (const e of it?.entries || []) pastEntries.push({ topicId: e.topicId, threadId: e.threadId, title: e.title, search_keywords: e.search_keywords || [], regions: e.regions || [], category: e.category || '', date: key.replace(/^archive#/, '') });
  }
  console.log(`inputs: ${topics.length} topics (${staging.generationId}), ${Object.keys(factsByCountry).length}/${regions.length} FACTS, ${pastEntries.length} archive entries`);

  const generatedDate = staging.generatedDate; const year = staging.generatedYear || new Date().getUTCFullYear();
  const prior = REDO_B ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).stories : [];
  const per = new Array(topics.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < topics.length) {
      const i = cursor++; const topic = topics[i];
      const premiseBlock = newJob.buildPremiseBlock(topic, factsByCountry);
      // held-out stories only see archive history from BEFORE their own day (no look-ahead)
      const arcDigest = newJob.buildArcDigest(topic, topic._day ? pastEntries.filter((e) => e.date < topic._day) : pastEntries);
      const v1 = { premiseBlock, arcDigest, webContext: '' };
      const inputText = newJob.forecastInputText(topic, v1);
      const row = { id: topic.id, title: topic.title, inputText, arcDigest, premiseBlock };
      try {
        const cachedA = prior.find((x) => x.id === topic.id && x.A);
        if (cachedA) row.A = cachedA.A;
        else {
          const rp = oldJob.buildResearchPrompt(topic, generatedDate, year, v1);
          const rA = await llm(rp, 800);
          const pA = oldJob.buildPredictionPrompt(topic, generatedDate, year, rA.content, { premiseBlock });
          const fA = await llm(pA, 2500);
          row.A = { research: rA.content, researchUsage: rA.usage, forecast: fA.content, forecastUsage: fA.usage, peak: rA.peak, cost: dollars(rA.usage, rA.peak) + dollars(fA.usage, fA.peak) };
        }
        const pB = newJob.buildPredictionPrompt(topic, generatedDate, year, v1);
        const fB = await llm(pB, 2500, true); // production sends the forecast in JSON mode
        row.B = { forecast: fB.content, forecastUsage: fB.usage, peak: fB.peak, cost: dollars(fB.usage, fB.peak) };
      } catch (e) { row.error = e.message; }
      per[i] = row;
      console.log(`[${i + 1}/${topics.length}] ${topic.title.slice(0, 60)} A=$${(row.A?.cost ?? NaN).toFixed(4)} B=$${(row.B?.cost ?? NaN).toFixed(4)}${row.error ? ' ERROR ' + row.error : ''}`);
    }
  }));
  results = { day: DAY, generationId: staging.generationId, model: MODEL, oldRef: OLD_REF, stories: per };
  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 1));
}

// ── gate + measure ───────────────────────────────────────────────────────────────────────────────
const rows = [];
for (const s of results.stories) {
  if (s.error || !s.A || !s.B) { rows.push({ s, error: s.error || 'missing' }); continue; }
  const base = (k, ctxExtra) => ({ generatedAtDay: results.day, fallbackYear: 2026, facts: [], pk: `PRED#${s.id}`, sk: results.day, snippets: s.inputText.split('\n').filter(Boolean), priorTexts: [], ...ctxExtra });
  const rawA = parseJson(s.A.forecast); const rawB = parseJson(s.B.forecast);
  const gA = oldJob.lib.buildGatedScenarios(rawA?.scenarios, base('A'));
  // B as the job runs it: ground the rationale once, then gate (G13 on trigger text) the grounded copy.
  const grounded = newJob.lib.groundForecastContent(rawB, s.inputText, results.day);
  const gB = newJob.lib.buildGatedScenarios(grounded.parsed?.scenarios, base('B', { inputText: s.inputText }));
  gB.capture.dropped.push(...grounded.removed);
  rows.push({ s, rawA, rawB, gA, gB, mA: rawA ? analyse(newJob.lib, rawA, s.inputText, results.day, gA) : null, mB: rawB ? analyse(newJob.lib, rawB, s.inputText, results.day, gB) : null });
}
const ok = rows.filter((r) => r.mA && r.mB);
const sum = (f) => ok.reduce((a, r) => a + f(r), 0);
const usageSum = (u, k) => (u ? u[k] || 0 : 0);
const tok = (side) => ({
  in: sum((r) => (side === 'A' ? usageSum(r.s.A.researchUsage, 'prompt_tokens') + usageSum(r.s.A.forecastUsage, 'prompt_tokens') : usageSum(r.s.B.forecastUsage, 'prompt_tokens'))),
  out: sum((r) => (side === 'A' ? usageSum(r.s.A.researchUsage, 'completion_tokens') + usageSum(r.s.A.forecastUsage, 'completion_tokens') : usageSum(r.s.B.forecastUsage, 'completion_tokens'))),
});
const costA = sum((r) => r.s.A.cost); const costB = sum((r) => r.s.B.cost);
const M = (side) => {
  const k = side === 'A' ? 'mA' : 'mB';
  const ranges = ok.map((r) => r[k].ranges.join(' / '));
  const ml = ok.map((r) => r[k].mostLikelyRange);
  const stock = ml.filter((x) => /^(55-65|60-70)%?$/.test(x)).length;
  const allLead = ok.flatMap((r) => r[k].rawLeadN ? [r[k]] : []);
  return {
    claimsRaw: sum((r) => r[k].claims.length), claimsPost: sum((r) => r[k].claimsPostGate.length),
    storiesWithClaims: ok.filter((r) => r[k].claims.length).length,
    distinctMostLikely: new Set(ml).size, distinctTriples: new Set(ranges).size, stock,
    questions: sum((r) => r[k].questions),
    qLead: mean(ok.map((r) => r[k].qLeadMean).filter((x) => x != null)),
    rawTrig: sum((r) => r[k].rawTriggers), rawUnder7: sum((r) => r[k].rawLeadUnder7), rawLeadN: sum((r) => r[k].rawLeadN),
    rawLead: mean(ok.flatMap((r) => (r[k].rawLeadMean != null ? [r[k].rawLeadMean] : []))),
    g13: sum((r) => r[k].narrativeG13),
  };
};
const mA = M('A'); const mB = M('B'); const tA = tok('A'); const tB = tok('B');
const ratio = costA ? costB / costA : null;

const bar = {
  claims: mB.claimsPost === 0,
  rawClaims: mB.claimsRaw === 0,
  questions: mB.questions >= mA.questions,
  cost: ratio != null && ratio <= 0.6,
};

// ── report ───────────────────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = '';
md += `# Grounded forecast A/B — ${results.day}\n\n`;
md += `Plan: \`project-docs/prediction/_active/TASK_2026-10-17_grounded_forecast_and_cost.md\` (P0). Generated by \`predictions/forecast-ab/run.mjs\` (read-only AWS; DeepSeek model \`${results.model}\`; old code = \`${results.oldRef}\`; staging generation \`${results.generationId}\`).\n\n`;
md += `A = research briefing call + forecast call, old prompts, gates G1-G12. B = one grounded forecast call, new prompt, gates G1-G12 + G13. Same inputs per story (snippets, FACTS# premises, 7-day archive digest). ${ok.length} of ${rows.length} stories completed both sides.\n\n`;
md += `## Metrics (A vs B, ${ok.length} stories)\n\n| Metric | A (old) | B (new) |\n|---|---|---|\n`;
md += `| Ungrounded dated claims / named events, raw model output (rationale + trigger text) | ${mA.claimsRaw} (${mA.storiesWithClaims} stories) | ${mB.claimsRaw} (${mB.storiesWithClaims} stories) |\n`;
md += `| Ungrounded claims still in the rationale after the gates (what readers see) | ${mA.claimsPost} | ${mB.claimsPost} |\n`;
md += `| Triggers demoted to narrative by G13 | n/a | ${mB.g13} |\n`;
md += `| Distinct "Most Likely" probability_range values | ${mA.distinctMostLikely} | ${mB.distinctMostLikely} |\n`;
md += `| Distinct 3-range combinations | ${mA.distinctTriples} | ${mB.distinctTriples} |\n`;
md += `| Stories whose Most Likely range is 55-65% or 60-70% | ${mA.stock} | ${mB.stock} |\n`;
md += `| Scoreable questions after gates | ${mA.questions} | ${mB.questions} |\n`;
md += `| Triggers emitted (raw) | ${mA.rawTrig} | ${mB.rawTrig} |\n`;
md += `| Mean lead days, raw triggers (mean of per-story means) | ${f1(mA.rawLead)} | ${f1(mB.rawLead)} |\n`;
md += `| Raw triggers with lead < 7 days | ${mA.rawUnder7} / ${mA.rawLeadN} | ${mB.rawUnder7} / ${mB.rawLeadN} |\n`;
md += `| Mean lead days, kept questions | ${f1(mA.qLead)} | ${f1(mB.qLead)} |\n`;
md += `| Tokens in / out (usage) | ${tA.in} / ${tA.out} | ${tB.in} / ${tB.out} |\n`;
md += `| Cost, total (${ok.some((r) => r.s.A.peak) ? 'mixed peak' : 'off-peak'} prices) | $${costA.toFixed(4)} | $${costB.toFixed(4)} |\n`;
md += `| Cost per story | $${(costA / (ok.length || 1)).toFixed(4)} | $${(costB / (ok.length || 1)).toFixed(4)} |\n`;
md += `| B / A cost | | ${ratio == null ? 'n/a' : (ratio * 100).toFixed(0) + '%'} |\n\n`;
md += `Notes: claims are found by the same pure checker B's G13 uses (\`lib.ungroundedClaims\`), run on A's and B's raw output against the input text the model was shown (the research briefing is NOT counted as input for A, since it is model-written). priorTexts (G12 near-duplicates from earlier PRED# rows) are empty in this offline run, which affects A and B equally.\n\n`;
md += `## P0 bar\n\n- B has 0 ungrounded dated claims: raw output ${bar.rawClaims ? 'PASS' : 'FAIL'} (${mB.claimsRaw}); after the gates (rationale stripped) ${bar.claims ? 'PASS' : 'FAIL'} (${mB.claimsPost})\n- B keeps >= A's scoreable questions: ${bar.questions ? 'PASS' : 'FAIL'} (${mB.questions} vs ${mA.questions})\n- B cost <= 60% of A: ${bar.cost ? 'PASS' : 'FAIL'} (${ratio == null ? 'n/a' : (ratio * 100).toFixed(0) + '%'})\n\n`;
md += `Flagged claims (B, raw):\n\n`;
for (const r of ok) for (const c of r.mB.claims) md += `- ${esc(r.s.title.slice(0, 60))} — ${c.where}: \`${esc(c.text)}\` (${c.kind})\n`;
if (!mB.claimsRaw) md += '- none\n';
md += `\nFlagged claims (A, raw):\n\n`;
for (const r of ok) for (const c of r.mA.claims) md += `- ${esc(r.s.title.slice(0, 60))} — ${c.where}: \`${esc(c.text)}\` (${c.kind})\n`;
if (!mA.claimsRaw) md += '- none\n';
md += `
## Hand check of flagged claims (2026-10-17, no web verification done; "unverified" means not checked against a source)

- A, Hormuz rationale "October 20-22": not in input; unverified, likely an invented schedule.
- A, White House press secretary and wildfire rationales "November 3": US midterm election day (3 Nov 2026) is real, but it is not in the input, so the gate treats it as ungrounded (correct fact, unverifiable from input).
- A, Egypt "November 2026" House session and "December 2026" IMF review: not in input; unverified.
- A, Kenya "Emergency Committee": a WHO body convened on demand, not a scheduled event; the generic-noun rule over-flags it (false positive).
- B (final prompt): the five raw flags in the first run were dated precedents (December 2023, December 2018, August 2020, December 2021) and the organisation name "International Committee of the Red Cross", all false positives; the checker now skips past-dated references and names followed by "of". B then has 0 raw flags.

## Prompt iterations

Iteration 1 (example numbers removed, "Prefer 14-84 days"): B 0 claims but 100 vs 107 questions, mean lead 78 days, 12/13 stories still 55-65%/60-70%. Iteration 2 (this report: 90-day cap, "3 distinct triggers when they exist", anti-template probability instruction) lifted questions to A's level and shortened leads; probability templating is reduced but not removed (the model's prior is strong).
`;
md += `\n## Per story\n`;
const show = (raw, g) => {
  if (!raw) return '_unparseable output_\n';
  let o = '';
  raw.scenarios?.forEach((s, si) => {
    o += `- **${s.label}** ${s.probability_range} / ${s.horizon}\n  - rationale: ${esc(s.rationale)}\n`;
    const kept = g.scenarios[si]?.triggers || [];
    (s.triggers || []).forEach((t) => {
      const n = newJob.lib.normalizeTrigger(t, 2026);
      const k = kept.find((x) => x.text === n.text);
      const tag = k ? (k.question ? `question p=${k.p}` : 'narrative') : 'dropped';
      o += `  - [${tag}] ${esc(n.text)} (by ${n.deadline || '?'}, p=${t.p})\n`;
    });
  });
  o += `  - gate drops: ${g.capture.dropped.map((d) => `${d.gate}${d.field ? '/' + d.field : ''}`).join(', ') || 'none'}\n`;
  return o;
};
for (const r of rows) {
  md += `\n### ${esc(r.s.title)}\n\n`;
  if (!r.mA || !r.mB) { md += `_not completed: ${esc(r.error || 'unparseable')}_\n`; continue; }
  md += `Cost A $${r.s.A.cost.toFixed(4)} / B $${r.s.B.cost.toFixed(4)}; questions A ${r.mA.questions} / B ${r.mB.questions}; ungrounded claims A ${r.mA.claims.length} / B ${r.mB.claims.length}.\n\n**B (new)**\n\n${show(r.rawB, r.gB)}\n**A (old)**\n\n${show(r.rawA, r.gA)}\n`;
  md += `\n<details><summary>A research briefing (old step 1)</summary>\n\n${esc(r.s.A.research)}\n\n</details>\n`;
}
fs.writeFileSync(REPORT, md);
console.log(`wrote ${path.relative(REPO, REPORT)}; claims A=${mA.claimsRaw} B=${mB.claimsRaw}/${mB.claimsPost}; questions A=${mA.questions} B=${mB.questions}; cost A=$${costA.toFixed(4)} B=$${costB.toFixed(4)} (${ratio == null ? 'n/a' : (ratio * 100).toFixed(0) + '%'})`);
