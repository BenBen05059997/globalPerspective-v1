#!/usr/bin/env node
// severity_prompt_eval.js — Phase 4 Step 4.1 offline eval harness.
// See project-docs/architecture/ONE_TRUTH_EXECUTION_PLAN.md Phase 4 for the full spec.
//
// Runs a candidate "dimensions" rubric block over the frozen 28 narratives in
// quality/severity_gold_set.json, through the SAME two model APIs the live generators use
// (deepseek-v4-pro for country records, gemini-2.5-flash for thread records — endpoint/model/key
// are read live from each Lambda's env at runtime, never hardcoded, never written to disk),
// parses the "dimensions" field with the SAME normalization the generators use
// (riskDimensions.js, required — not reimplemented), and grades against the gold labels with the
// same metrics as severity_agreement.js PLUS two inflation counters (model-higher vs
// judge-higher band counts, and model-scored-where-gold-null count).
//
// Read-only: no live DDB reads, no writes to Lambda config, no repo code changes. API keys are
// fetched into process memory only (via `aws lambda get-function-configuration`) and are never
// printed, logged, or written to any file by this script.
//
// Usage:
//   node quality/severity_prompt_eval.js --baseline-check
//   node quality/severity_prompt_eval.js --prompt-file quality/prompts/dimensions_v2 --label v2
//
// --prompt-file <base> expects two files: <base>_country.txt and <base>_thread.txt (the two
// per-generator rubric blocks — Step 4.2 produces quality/prompts/dimensions_v2_country.txt and
// quality/prompts/dimensions_v2_thread.txt, so pass --prompt-file quality/prompts/dimensions_v2).

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeDimensions } = require('../amplify/backend/function/newsCountryIntelligence/src/riskDimensions');

const AXES = ['conflict', 'political', 'economic', 'humanitarian'];
const REGION = 'ap-northeast-1';
const GOLD_SET_PATH = path.join(__dirname, 'severity_gold_set.json');

// ─── args ───────────────────────────────────────────────────────────────────
function arg(name, def) {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = a[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const BASELINE_CHECK = !!arg('baseline-check', false);
const PROMPT_FILE_BASE = arg('prompt-file', null);
const LABEL = arg('label', BASELINE_CHECK ? 'baseline' : null);
const DELAY_MS = parseInt(arg('delay-ms', '1500'), 10);

if (!BASELINE_CHECK && !PROMPT_FILE_BASE) {
  console.error('Usage: node quality/severity_prompt_eval.js --baseline-check');
  console.error('   or: node quality/severity_prompt_eval.js --prompt-file <base> --label <name>');
  process.exit(1);
}
if (!LABEL) {
  console.error('--label <name> is required when not using --baseline-check');
  process.exit(1);
}

// ─── the CURRENT live rubric text, verbatim (used only for --baseline-check) ───────────────────
// Quoted verbatim from amplify/backend/function/newsCountryIntelligence/src/index.js (~line
// 487-492) and amplify/backend/function/newsThreadAnalysis/src/index.js (~line 263) as of
// 2026-09-15 — see project-docs/architecture/SEVERITY_CODEBOOK.md §1. This block is NOT edited by
// this harness; if the live prompt text ever changes, re-quote it here so --baseline-check keeps
// meaning what it says.
const CURRENT_RUBRIC_COUNTRY = `10. "dimensions": Object scoring this country's CURRENT risk across four INDEPENDENT axes. For each axis provide {"score": integer 0-100, "why": ONE sentence citing the specific arc/event from the data above that justifies the score} — or null when the data gives genuinely no signal for that axis. Be sparing: most countries are NOT elevated on all four — use null rather than a filler mid-number. Axes:
   - "conflict": armed violence, military operations, armed-actor intensity
   - "political": institutional stability, governance, legitimacy, protest/unrest
   - "economic": financial stress, sanctions, trade/market disruption
   - "humanitarian": displacement, civilian harm, disaster, aid crisis
Per-axis calibration: 0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe. (riskScore and riskLevel are derived from these — do NOT output them separately.)`;

const CURRENT_RUBRIC_THREAD = `8. "dimensions": Object scoring THIS thread's current risk across four INDEPENDENT axes. For each axis provide {"score": integer 0-100, "why": ONE sentence citing the specific development in this thread that justifies the score} — or null when the thread gives genuinely no signal for that axis. Be sparing — use null rather than a filler mid-number. Axes: "conflict" (armed violence, military operations, armed-actor intensity), "political" (institutional stability, governance, legitimacy, unrest), "economic" (financial stress, sanctions, market disruption), "humanitarian" (displacement, civilian harm, disaster). Per-axis calibration: 0-24 = low, 25-49 = moderate, 50-74 = elevated, 75-100 = severe. (riskScore is derived from these — do NOT output it separately.)`;

function loadRubrics() {
  if (BASELINE_CHECK) {
    return { country: CURRENT_RUBRIC_COUNTRY, thread: CURRENT_RUBRIC_THREAD };
  }
  const countryPath = `${PROMPT_FILE_BASE}_country.txt`;
  const threadPath = `${PROMPT_FILE_BASE}_thread.txt`;
  if (!fs.existsSync(countryPath) || !fs.existsSync(threadPath)) {
    console.error(`Expected both ${countryPath} and ${threadPath} to exist.`);
    process.exit(1);
  }
  return {
    country: fs.readFileSync(countryPath, 'utf8').trim(),
    thread: fs.readFileSync(threadPath, 'utf8').trim(),
  };
}

// ─── live Lambda env (endpoint + model + key) — fetched at runtime, kept in memory only ────────
function getFunctionEnv(functionName) {
  const raw = execFileSync('aws', [
    'lambda', 'get-function-configuration',
    '--function-name', functionName,
    '--region', REGION,
    '--output', 'json',
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const config = JSON.parse(raw);
  return (config.Environment && config.Environment.Variables) || {};
}

function buildModelConfig(functionName, defaults) {
  const env = getFunctionEnv(functionName);
  return {
    endpoint: env.GROK_API_URL || defaults.endpoint,
    model: env.GROK_MODEL || defaults.model,
    key: env.XAI_API_KEY || '',
    maxTokens: parseInt(env.MAX_TOKENS || String(defaults.maxTokens), 10),
    temperature: Number(env.TEMPERATURE || defaults.temperature),
    topP: Number(env.TOP_P || defaults.topP),
  };
}

// ─── prompt construction (data section identical baseline vs candidate; only rubric varies) ────
// This mirrors the section of the production prompt that presents the record's data, built from
// ONLY the frozen `narrative` fields in the gold set (never re-reads DDB). It is intentionally a
// reasonable analogue, not a byte-identical copy of the full production prompt (the gold set
// freezes a generator's OUTPUT narrative, not the original archive-entry input) — kept identical
// across every run of this harness so only the rubric block varies between comparisons.

function buildCountryPrompt(record, rubricBlock) {
  const n = record.narrative || {};
  const devLines = Array.isArray(n.keyDevelopments)
    ? n.keyDevelopments.map((d) => `- ${d.date}: ${d.text}`).join('\n')
    : 'None';
  const riskSignalLines = Array.isArray(n.riskSignals) && n.riskSignals.length
    ? n.riskSignals.map((s) => `- ${s}`).join('\n')
    : 'None';

  return `You are a geopolitical intelligence analyst scoring a country risk assessment for a sophisticated news intelligence platform. Below is the current assessment for ${n.countryName || record.id}.

=== CURRENT ASSESSMENT ===
Headline: ${n.headline || ''}
Bottom line: ${n.bluf || ''}

Key developments:
${devLines}

Why it matters: ${n.whyItMatters || ''}

Risk signals to watch:
${riskSignalLines}

Generate a JSON object with exactly one field, produced per this instruction:

${rubricBlock}

Return ONLY valid JSON of the form {"dimensions": {...}}. No markdown fences, no commentary, no extra keys.`;
}

function buildThreadPrompt(record, rubricBlock) {
  const n = record.narrative || {};
  const watchLines = Array.isArray(n.watchQuestions) && n.watchQuestions.length
    ? n.watchQuestions.map((q) => `- ${q}`).join('\n')
    : 'None';

  return `You are a narrative intelligence analyst scoring a news thread's current risk for a sophisticated global news platform. Below is the thread assessment for "${n.threadTitle || record.id}".

=== THREAD ASSESSMENT ===
Story arc: ${n.storyArc || ''}

Root cause chain: ${n.rootCauseChain || ''}

Watch questions:
${watchLines}

Generate a JSON object with exactly one field, produced per this instruction:

${rubricBlock}

Return ONLY valid JSON of the form {"dimensions": {...}}. No markdown fences, no commentary, no extra keys.`;
}

// ─── model invocation — mirrors each Lambda's invokeGrok() exactly ─────────────────────────────

function stripCodeFence(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/,(\s*[\]}])/g, '$1')
    .trim();
}

function extractContent(payload) {
  if (!payload) return '';
  const msg = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : undefined;
  if (typeof msg === 'string') return stripCodeFence(msg);
  if (typeof payload === 'string') return payload.trim();
  return JSON.stringify(payload);
}

// country records → deepseek-v4-pro; mirrors newsCountryIntelligence/src/index.js invokeGrok(),
// including the `thinking: { type: 'disabled' }` guard (DeepSeek V4 defaults to thinking mode,
// which burns max_tokens on invisible reasoning and truncates/empties output otherwise).
async function invokeCountryModel(prompt, cfg) {
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      top_p: cfg.topP,
      thinking: { type: 'disabled' },
    }),
  });
  const rawText = await response.text();
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }
  if (!response.ok) {
    const message = (parsed && parsed.error && parsed.error.message) || rawText || `status ${response.status}`;
    throw new Error(`DeepSeek API error: ${message}`);
  }
  return extractContent(parsed);
}

// thread records → gemini-2.5-flash via the Gemini OpenAI-compatible endpoint; mirrors
// newsThreadAnalysis/src/index.js invokeGrok() (no `thinking` guard — that's DeepSeek-specific).
async function invokeThreadModel(prompt, cfg) {
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      top_p: cfg.topP,
    }),
  });
  const rawText = await response.text();
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }
  if (!response.ok) {
    const message = (parsed && parsed.error && parsed.error.message) || rawText || `status ${response.status}`;
    throw new Error(`Gemini API error: ${message}`);
  }
  return extractContent(parsed);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── grading — same definitions as severity_agreement.js, plus inflation counters ──────────────

function band(score) {
  if (score == null) return null;
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'moderate';
  return 'low';
}
const BAND_ORDER = { low: 0, moderate: 1, elevated: 2, high: 3 };
function bandDistance(a, b) {
  if (a == null || b == null) return null;
  return Math.abs(BAND_ORDER[a] - BAND_ORDER[b]);
}
function worstAxis(scores) {
  let best = null;
  for (const axis of AXES) {
    const s = scores[axis];
    if (s == null) continue;
    if (best == null || s > best.score) best = { axis, score: s };
  }
  return best;
}

function grade(records) {
  const perAxis = {};
  for (const axis of AXES) perAxis[axis] = { n: 0, exact: 0, withinOne: 0 };

  let worstMatchN = 0;
  let worstMatchHits = 0;
  let modelHigher = 0;
  let judgeHigher = 0;
  let modelScoredWhereGoldNull = 0;

  for (const r of records) {
    const gold = r.gold || {};
    const model = r.candidateDimensions || {};

    for (const axis of AXES) {
      const g = gold[axis];
      const mEntry = model[axis];
      const m = mEntry && typeof mEntry.score === 'number' ? mEntry.score : null;

      if (g == null && m != null) modelScoredWhereGoldNull++;

      if (g == null || m == null) continue;
      const gb = band(g);
      const mb = band(m);
      perAxis[axis].n++;
      if (gb === mb) perAxis[axis].exact++;
      const d = bandDistance(gb, mb);
      if (d != null && d <= 1) perAxis[axis].withinOne++;

      const gi = BAND_ORDER[gb];
      const mi = BAND_ORDER[mb];
      if (mi > gi) modelHigher++;
      else if (mi < gi) judgeHigher++;
    }

    const goldScores = {};
    const modelScores = {};
    for (const axis of AXES) {
      if (gold[axis] != null) goldScores[axis] = gold[axis];
      const mEntry = model[axis];
      if (mEntry && typeof mEntry.score === 'number') modelScores[axis] = mEntry.score;
    }
    const goldWorst = worstAxis(goldScores);
    const modelWorst = worstAxis(modelScores);
    if (goldWorst && modelWorst) {
      worstMatchN++;
      if (goldWorst.axis === modelWorst.axis) worstMatchHits++;
    }
  }

  let overallN = 0, overallExact = 0, overallWithinOne = 0;
  for (const axis of AXES) {
    overallN += perAxis[axis].n;
    overallExact += perAxis[axis].exact;
    overallWithinOne += perAxis[axis].withinOne;
  }

  return {
    perAxis,
    overallN, overallExact, overallWithinOne,
    worstMatchN, worstMatchHits,
    modelHigher, judgeHigher,
    modelScoredWhereGoldNull,
  };
}

const fmtPct = (num, den) => (den === 0 ? 'n/a' : `${((num / den) * 100).toFixed(1)}%`);

// ─── known live baseline (per SEVERITY_CODEBOOK.md / severity-2026-09-14.md) — for delta report ─
const KNOWN_BASELINE = {
  perAxis: {
    conflict: { n: 15, exact: 53.3, withinOne: 93.3 },
    political: { n: 22, exact: 22.7, withinOne: 68.2 },
    economic: { n: 17, exact: 41.2, withinOne: 88.2 },
    humanitarian: { n: 18, exact: 50.0, withinOne: 94.4 },
  },
  overallExact: 40.3,
  overallWithinOne: 84.7,
  modelHigher: 41,
  modelScoredWhereGoldNull: 27,
};

// ─── acceptance gates (Step 4.3) — only meaningful for a candidate (non-baseline-check) run ────
function evalGates(result) {
  const politicalExact = result.perAxis.political.n
    ? (result.perAxis.political.exact / result.perAxis.political.n) * 100 : null;
  const overallWithinOne = result.overallN ? (result.overallWithinOne / result.overallN) * 100 : null;

  const gates = [];
  gates.push({
    name: 'political exact >= 45%',
    pass: politicalExact != null && politicalExact >= 45,
    value: politicalExact == null ? 'n/a' : `${politicalExact.toFixed(1)}%`,
  });
  gates.push({
    name: 'model-scored-where-gold-null <= 10',
    pass: result.modelScoredWhereGoldNull <= 10,
    value: String(result.modelScoredWhereGoldNull),
  });
  gates.push({
    name: 'overall within-one >= 85%',
    pass: overallWithinOne != null && overallWithinOne >= 85,
    value: overallWithinOne == null ? 'n/a' : `${overallWithinOne.toFixed(1)}%`,
  });

  let noAxisRegressed = true;
  const axisDeltas = [];
  for (const axis of AXES) {
    const n = result.perAxis[axis].n;
    const withinOne = n ? (result.perAxis[axis].withinOne / n) * 100 : null;
    const base = KNOWN_BASELINE.perAxis[axis].withinOne;
    const delta = withinOne == null ? null : withinOne - base;
    if (delta != null && delta < -5) noAxisRegressed = false;
    axisDeltas.push({ axis, withinOne, base, delta });
  }
  gates.push({
    name: 'no axis within-one drops >5pts vs baseline',
    pass: noAxisRegressed,
    value: axisDeltas.map((d) => `${d.axis}=${d.withinOne == null ? 'n/a' : d.withinOne.toFixed(1) + '%'} (Δ${d.delta == null ? 'n/a' : d.delta.toFixed(1)})`).join(', '),
  });

  gates.push({
    name: 'model-higher band-count <= 20',
    pass: result.modelHigher <= 20,
    value: String(result.modelHigher),
  });

  return { gates, allPass: gates.every((g) => g.pass), axisDeltas };
}

// ─── main ───────────────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(GOLD_SET_PATH)) {
    console.error(`Gold set not found at ${GOLD_SET_PATH}`);
    process.exit(1);
  }
  const goldSet = JSON.parse(fs.readFileSync(GOLD_SET_PATH, 'utf8'));
  const records = goldSet.records;
  if (!Array.isArray(records)) {
    console.error('severity_gold_set.json has no records array.');
    process.exit(1);
  }

  // completeness guard — mirrors severity_agreement.js
  const incomplete = records.filter((r) => AXES.some((a) => !((r.gold || {}).hasOwnProperty(a))));
  if (incomplete.length) {
    console.error(`Refusing to run: ${incomplete.length} record(s) have an incomplete gold object.`);
    process.exit(1);
  }
  const anyLabeled = records.some((r) => AXES.some((a) => (r.gold || {})[a] != null));
  if (!anyLabeled) {
    console.error('Refusing to run: gold set appears unlabeled (all gold values null).');
    process.exit(1);
  }

  const rubrics = loadRubrics();

  console.log(`Fetching live env for newsCountryIntelligence and newsThreadAnalysis (ap-northeast-1)...`);
  const countryCfg = buildModelConfig('newsCountryIntelligence', {
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-pro',
    maxTokens: 5000,
    temperature: 0.3,
    topP: 0.9,
  });
  const threadCfg = buildModelConfig('newsThreadAnalysis', {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    maxTokens: 3500,
    temperature: 0.2,
    topP: 0.9,
  });
  if (!countryCfg.key) { console.error('Missing country-model API key from live env.'); process.exit(1); }
  if (!threadCfg.key) { console.error('Missing thread-model API key from live env.'); process.exit(1); }
  console.log(`Country model: ${countryCfg.model} @ ${countryCfg.endpoint}`);
  console.log(`Thread model:  ${threadCfg.model} @ ${threadCfg.endpoint}`);

  let done = 0;
  for (const r of records) {
    const isCountry = r.type === 'country';
    const rubric = isCountry ? rubrics.country : rubrics.thread;
    const prompt = isCountry ? buildCountryPrompt(r, rubric) : buildThreadPrompt(r, rubric);

    let content = '';
    try {
      content = isCountry
        ? await invokeCountryModel(prompt, countryCfg)
        : await invokeThreadModel(prompt, threadCfg);
      const parsed = JSON.parse(content);
      r.candidateDimensions = normalizeDimensions(parsed.dimensions);
      r.candidateRaw = parsed.dimensions;
    } catch (err) {
      console.warn(`  [${r.id}] FAILED: ${err.message}`);
      r.candidateDimensions = {};
      r.candidateError = err.message;
    }
    done++;
    console.log(`  [${done}/${records.length}] ${r.id} (${r.type}) — ${r.candidateError ? 'ERROR' : 'ok'}`);
    await sleep(DELAY_MS);
  }

  const result = grade(records);
  const gateReport = BASELINE_CHECK ? null : evalGates(result);

  // ── console summary ──────────────────────────────────────────────────────────────────────────
  console.log('');
  console.log(`Run: ${LABEL}${BASELINE_CHECK ? ' (--baseline-check)' : ''}`);
  console.log('Per-axis:');
  for (const axis of AXES) {
    const s = result.perAxis[axis];
    console.log(`  ${axis.padEnd(12)} n=${s.n}  exact=${fmtPct(s.exact, s.n)}  within-one=${fmtPct(s.withinOne, s.n)}`);
  }
  console.log(`Overall pooled: n=${result.overallN} exact=${fmtPct(result.overallExact, result.overallN)} within-one=${fmtPct(result.overallWithinOne, result.overallN)}`);
  console.log(`Worst-axis match: ${fmtPct(result.worstMatchHits, result.worstMatchN)} (n=${result.worstMatchN})`);
  console.log(`Model-higher: ${result.modelHigher}  Judge-higher: ${result.judgeHigher}  Model-scored-where-gold-null: ${result.modelScoredWhereGoldNull}`);
  if (gateReport) {
    console.log('\nGates:');
    for (const g of gateReport.gates) console.log(`  [${g.pass ? 'PASS' : 'FAIL'}] ${g.name} — ${g.value}`);
    console.log(`Overall: ${gateReport.allPass ? 'ALL GATES PASS' : 'NOT ALL GATES PASS'}`);
  }

  // ── markdown report ──────────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(__dirname, 'calibration', `prompt-eval-${LABEL}-${today}.md`);
  const lines = [];
  lines.push(`# Prompt eval — ${LABEL} — ${today}`);
  lines.push('');
  lines.push(`Generated by \`quality/severity_prompt_eval.js\`${BASELINE_CHECK ? ' --baseline-check' : ` --prompt-file ${PROMPT_FILE_BASE} --label ${LABEL}`}.`);
  lines.push(`Frozen input: \`quality/severity_gold_set.json\` (28 records, same set as the Phase 3 baseline).`);
  lines.push(`Country model: ${countryCfg.model} @ ${countryCfg.endpoint}`);
  lines.push(`Thread model: ${threadCfg.model} @ ${threadCfg.endpoint}`);
  lines.push('');
  lines.push('## Per-axis agreement');
  lines.push('');
  lines.push('| Axis | n | Exact-band | Within-one-band |');
  lines.push('|---|---|---|---|');
  for (const axis of AXES) {
    const s = result.perAxis[axis];
    lines.push(`| ${axis} | ${s.n} | ${fmtPct(s.exact, s.n)} | ${fmtPct(s.withinOne, s.n)} |`);
  }
  lines.push('');
  lines.push('## Overall');
  lines.push('');
  lines.push(`- **Pooled exact-band:** ${fmtPct(result.overallExact, result.overallN)} (n=${result.overallN})`);
  lines.push(`- **Pooled within-one-band:** ${fmtPct(result.overallWithinOne, result.overallN)} (n=${result.overallN})`);
  lines.push(`- **Worst-axis match:** ${fmtPct(result.worstMatchHits, result.worstMatchN)} (n=${result.worstMatchN})`);
  lines.push(`- **Model-higher band-count:** ${result.modelHigher}`);
  lines.push(`- **Judge-higher band-count:** ${result.judgeHigher}`);
  lines.push(`- **Model-scored-where-gold-null:** ${result.modelScoredWhereGoldNull}`);
  lines.push('');

  if (BASELINE_CHECK) {
    lines.push('## Delta vs known live baseline (`quality/calibration/severity-2026-09-14.md`)');
    lines.push('');
    lines.push('| Metric | Known baseline | This harness run | Delta |');
    lines.push('|---|---|---|---|');
    const overallExactPct = result.overallN ? (result.overallExact / result.overallN) * 100 : null;
    const overallWithinPct = result.overallN ? (result.overallWithinOne / result.overallN) * 100 : null;
    const politPct = result.perAxis.political.n ? (result.perAxis.political.exact / result.perAxis.political.n) * 100 : null;
    const row = (name, base, cur) => lines.push(`| ${name} | ${base}% | ${cur == null ? 'n/a' : cur.toFixed(1) + '%'} | ${cur == null ? 'n/a' : (cur - base).toFixed(1)} |`);
    row('overall exact-band', KNOWN_BASELINE.overallExact, overallExactPct);
    row('overall within-one-band', KNOWN_BASELINE.overallWithinOne, overallWithinPct);
    row('political exact-band', KNOWN_BASELINE.perAxis.political.exact, politPct);
    lines.push(`| model-higher band-count | ${KNOWN_BASELINE.modelHigher} | ${result.modelHigher} | ${result.modelHigher - KNOWN_BASELINE.modelHigher} |`);
    lines.push(`| model-scored-where-gold-null | ${KNOWN_BASELINE.modelScoredWhereGoldNull} | ${result.modelScoredWhereGoldNull} | ${result.modelScoredWhereGoldNull - KNOWN_BASELINE.modelScoredWhereGoldNull} |`);
    lines.push('');
    lines.push('Expect similar-not-identical numbers (LLM nondeterminism) — this is a harness-validity check, not a rubric comparison.');
    lines.push('');
  } else if (gateReport) {
    lines.push('## Acceptance gates (Step 4.3)');
    lines.push('');
    lines.push('| Gate | Result | Value |');
    lines.push('|---|---|---|');
    for (const g of gateReport.gates) lines.push(`| ${g.name} | ${g.pass ? 'PASS' : 'FAIL'} | ${g.value} |`);
    lines.push('');
    lines.push(`**${gateReport.allPass ? 'ALL GATES PASS' : 'NOT ALL GATES PASS'}**`);
    lines.push('');
  }

  const failures = records.filter((r) => r.candidateError);
  if (failures.length) {
    lines.push('## Failed calls');
    lines.push('');
    for (const r of failures) lines.push(`- ${r.id}: ${r.candidateError}`);
    lines.push('');
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`\nWrote ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
