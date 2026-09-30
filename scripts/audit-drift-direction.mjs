#!/usr/bin/env node
/**
 * Audit of stored drift notes for direction contradictions (Batch 3 / phase E, D9).
 * A note contradicts itself when its `whyChanged` explains a LOWER score with a worsening (or a
 * HIGHER score with an improvement). Higher score = more risk = worse.
 *
 *   node scripts/audit-drift-direction.mjs [--out report.json]
 *        default: HEURISTIC only (the Lambda's directionCheck.js). Read-only, no LLM, no cost.
 *   node scripts/audit-drift-direction.mjs --llm [--out report.json]
 *        also asks `deepseek-flash` (key read in memory from the drift Lambda's env, never printed) for the
 *        valence the explanation gives each moved axis, and compares it with the stored delta. REAL LLM
 *        calls; the measured token usage and cost are printed. Needs the operator's go.
 *   node scripts/audit-drift-direction.mjs --write-flags reviewed.json
 *        WRITES: for each {pk, sk} in the reviewed list, `UpdateItem SET directionFlag` on the DRIFT# and
 *        DRIFTLOG# rows (additive; the text is untouched; undo = REMOVE directionFlag). Needs a fresh yes
 *        with the reviewed list. Not part of the read-only audit.
 *
 * Uses the AWS CLI; region ap-northeast-1; table SummarizeAndPredict.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dc = require(path.join(here, '../amplify/backend/function/newsDriftCorrector/src/directionCheck.js'));

const REGION = 'ap-northeast-1';
const TABLE = 'SummarizeAndPredict';
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i > 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const aws = (args, input) => execFileSync('aws', ['--region', REGION, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, input });

const un = (v) => {
  const k = Object.keys(v)[0]; const x = v[k];
  if (k === 'M') return Object.fromEntries(Object.entries(x).map(([a, b]) => [a, un(b)]));
  if (k === 'L') return x.map(un);
  if (k === 'N') return Number(x);
  if (k === 'NULL') return null;
  return x;
};

function scanNotes() {
  const out = [];
  let token = null;
  do {
    const a = ['dynamodb', 'scan', '--table-name', TABLE, '--filter-expression', 'begins_with(SK, :s)',
      '--expression-attribute-values', JSON.stringify({ ':s': { S: 'DRIFTLOG#' } }),
      '--projection-expression', 'PK, SK, asOf, whyChanged, changeScore, changeDimensions, noSingleDriver, triggerEvent, directionFlag', '--output', 'json'];
    if (token) a.push('--starting-token', token);
    const res = JSON.parse(aws(a));
    for (const it of res.Items || []) out.push(un({ M: it }));
    token = res.NextToken || null;
  } while (token);
  return out;
}

function heuristic(n) {
  const moves = Object.entries(n.changeDimensions || {}).map(([axis, v]) => ({ axis, from: v.from, to: v.to, delta: v.delta }));
  const v = dc.checkDrift({ whyChanged: n.whyChanged }, { axisMovesArr: moves, changeDimensions: n.changeDimensions || undefined });
  return { moves, problems: v.problems };
}

// ---- LLM valence audit (deepseek-flash) ------------------------------------------------------------
let LLM = null;
function llmConfig() {
  if (LLM) return LLM;
  const env = JSON.parse(aws(['lambda', 'get-function-configuration', '--function-name', 'newsDriftCorrector', '--query', 'Environment.Variables', '--output', 'json']));
  LLM = { key: env.XAI_API_KEY, url: env.GROK_API_URL, model: env.GROK_MODEL };
  if (!LLM.key || !LLM.url || !LLM.model) throw new Error('drift Lambda env is missing the LLM settings');
  return LLM;
}
const usage = { calls: 0, prompt: 0, completion: 0 };
async function valence(n, moves) {
  const c = llmConfig();
  const axes = moves.length ? moves.map((m) => m.axis) : ['overall'];
  const prompt = [
    'Below is an explanation an analyst wrote for why a country/story RISK score changed. Higher score = more risk = conditions worse.',
    'For each axis listed, say what the EVENT DESCRIBED in the explanation does to that axis: "worsens" (makes conditions worse / raises risk), "improves" (makes conditions better / lowers risk) or "unclear".',
    'Judge ONLY the explanation text, not what score change it is attached to. Also quote (verbatim, max 25 words) the fragment that shows it.',
    `Axes: ${axes.join(', ')}`,
    `Explanation: "${n.whyChanged}"`,
    `Return ONLY JSON: {"effects":{${axes.map((a) => `"${a}":"worsens|improves|unclear"`).join(',')}},"quote":"<fragment>"}`,
  ].join('\n');
  const res = await fetch(c.url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
    body: JSON.stringify({ model: c.model, temperature: 0, max_tokens: 200, thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`llm ${res.status}: ${body?.error?.message || ''}`);
  usage.calls++; usage.prompt += body.usage?.prompt_tokens || 0; usage.completion += body.usage?.completion_tokens || 0;
  let obj = null; try { obj = JSON.parse(body.choices[0].message.content); } catch { /* unparseable: no verdict */ }
  return obj;
}
function llmProblems(n, moves, obj) {
  if (!obj || !obj.effects) return [];
  const out = [];
  if (moves.length) {
    for (const m of moves) {
      const said = String(obj.effects[m.axis] || '').toLowerCase();
      if ((said === 'worsens' && m.delta < 0) || (said === 'improves' && m.delta > 0)) out.push({ kind: 'llm', axis: m.axis, said, actual: m.delta > 0 ? 'rose' : 'fell', clause: obj.quote || '' });
    }
  } else {
    const d = Number(n.changeScore && n.changeScore.delta); const said = String(obj.effects.overall || '').toLowerCase();
    if (Number.isFinite(d) && Math.abs(d) >= 8 && ((said === 'worsens' && d < 0) || (said === 'improves' && d > 0))) out.push({ kind: 'llm', axis: 'overall', said, actual: d > 0 ? 'rose' : 'fell', clause: obj.quote || '' });
  }
  return out;
}
async function pool(items, limit, fn) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

function writeFlags(file) {
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const at = new Date().toISOString();
  for (const { pk, sk } of list) {
    for (const key of [sk, sk.replace(/^DRIFTLOG#/, 'DRIFT#')]) {
      try {
        aws(['dynamodb', 'update-item', '--table-name', TABLE, '--key', JSON.stringify({ PK: { S: pk }, SK: { S: key } }),
          '--update-expression', 'SET directionFlag = :f', '--condition-expression', 'attribute_exists(PK)',
          '--expression-attribute-values', JSON.stringify({ ':f': { M: { backfilled: { BOOL: true }, at: { S: at }, source: { S: 'batch3-audit' } } } })]);
        console.log('flagged', pk, key);
      } catch (e) { console.log('skip (no such row)', pk, key); }
    }
  }
}

(async () => {
  const wf = arg('--write-flags');
  if (wf) { writeFlags(wf); return; }
  const notes = scanNotes().filter((n) => typeof n.whyChanged === 'string' && n.whyChanged.trim());
  console.log(`notes scanned: ${notes.length} (${notes.filter((n) => String(n.PK).startsWith('COUNTRY#')).length} country, ${notes.filter((n) => String(n.PK).startsWith('THREAD#')).length} thread)`);
  const withLLM = !!arg('--llm');
  const rows = await pool(notes, withLLM ? 4 : 1, async (n) => {
    const h = heuristic(n);
    let problems = h.problems.map((p) => ({ ...p, by: 'heuristic' }));
    if (withLLM) {
      try { problems = problems.concat(llmProblems(n, h.moves, await valence(n, h.moves)).map((p) => ({ ...p, by: 'llm' }))); }
      catch (e) { console.error('llm error', n.PK, n.asOf, e.message); }
    }
    return { pk: n.PK, sk: n.SK, asOf: n.asOf, delta: n.changeScore && n.changeScore.delta, dims: n.changeDimensions ? Object.fromEntries(Object.entries(n.changeDimensions).map(([k, v]) => [k, v.delta])) : null, alreadyFlagged: !!n.directionFlag, problems };
  });
  const flagged = rows.filter((r) => r.problems.length);
  console.log(`flagged: ${flagged.length} of ${rows.length}`);
  for (const r of flagged) {
    const who = String(r.pk).replace(/^(COUNTRY|THREAD)#/, '');
    console.log(`\n${who} ${r.asOf} (score delta ${r.delta}; axes ${JSON.stringify(r.dims)})`);
    for (const p of r.problems) console.log(`  [${p.by}${p.axis ? ' ' + p.axis : ''}${p.said ? ' ' + p.said + ' vs ' + p.actual : ''}] "${String(p.clause || '').slice(0, 220)}"`);
  }
  if (withLLM) {
    const cost = (usage.prompt * 0.15 + usage.completion * 0.60) / 1e6; // deepseek-flash $0.15 in / $0.60 out per 1M (AI_PROVIDER_PRICES_2026-09-27.md)
    console.log(`\nLLM usage (measured): ${usage.calls} calls, ${usage.prompt} prompt + ${usage.completion} completion tokens, about $${cost.toFixed(4)} (flash list price, no peak surcharge applied)`);
  }
  const out = arg('--out');
  if (out && out !== true) fs.writeFileSync(out, JSON.stringify(flagged, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
