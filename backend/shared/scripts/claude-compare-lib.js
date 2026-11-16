'use strict';
// Helpers for the Claude model comparison scripts (2026-11-16): the key read, a call wrapper over shared llm.js chat() that logs each
// call (finish reason, tokens, latency, cost), at most 2 calls in flight, a wait-and-retry on HTTP 429, and the blind A/B judge.
// The Anthropic key is read from ~/.gp-anthropic-key.txt into process.env here; it is never printed or logged.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.ANTHROPIC_API_KEY = fs.readFileSync(path.join(os.homedir(), '.gp-anthropic-key.txt'), 'utf8').trim();
const {chat} = require('../src/llm');

const MODELS = {haiku: 'anthropic:claude-haiku-5-5', sonnet: 'anthropic:claude-sonnet-5-5'};
const PRICE = {haiku: [0.10, 0.50], sonnet: [2, 10]}; // USD per million tokens, in / out
const OUT = path.join(__dirname, '..', '..', '..', '.board', 'reviews', 'model-quality-claude-2026-11-16', 'record');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let inflight = 0;
const waiters = [];
async function slot() { if (inflight >= 2) await new Promise((r) => waiters.push(r)); inflight += 1; }
function free() { inflight -= 1; const w = waiters.shift(); if (w) w(); }

/** One call through the shared client with the caller's own options; logs a row to <dir>/calls.jsonl. -> the chat() result. */
async function call(which, opts, dir, label) {
  await slot();
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await chat({...opts, model: MODELS[which]});
        const u = res.usage || {};
        const row = {label, which, finishReason: res.finishReason, latencyMs: res.latencyMs, in: u.prompt_tokens, out: u.completion_tokens, chars: res.content.length,
          cost: ((u.prompt_tokens || 0) * PRICE[which][0] + (u.completion_tokens || 0) * PRICE[which][1]) / 1e6};
        fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify(row) + '\n');
        return res;
      } catch (e) {
        if (e.status === 429 && attempt < 6) { fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify({label, which, http429: true}) + '\n'); await sleep(20000); continue; }
        fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify({label, which, error: String(e.message).slice(0, 300)}) + '\n');
        throw e;
      }
    }
  } finally { free(); }
}

const JUDGE_SYS = 'You are a strict, blind judge. Two answers, A and B, were written for the same task. Judge them only against the task input shown: factual support from the input, obeying the input\'s own rules, and usefulness to a reader. Do not guess who wrote them. An unsupported or invented fact is a serious fault; so is breaking a stated rule. Begin your reply with the JSON object, with no analysis text before it: {"winner":"A"|"B"|"tie","invented":"A"|"B"|"both"|"none","reason":"at most 40 words"}.';

/** Judge a pair in both orders (x first, then y first). -> {xFirst:{winner,invented,reason}, yFirst:{...}, result:'x'|'y'|'tie'|'split'} */
async function judgePair(input, x, y, dir, label) {
  const ask = async (a, b, tag) => {
    const user = `TASK INPUT:\n${input}\n\n=====\nANSWER A:\n${a}\n\n=====\nANSWER B:\n${b}`;
    const res = await call('sonnet', {step: 'judge', system: JUDGE_SYS, user, maxTokens: 1200, json: true}, dir, `${label}:judge:${tag}`);
    try { return JSON.parse(res.content); } catch { return {winner: 'parse_fail', raw: res.content.slice(0, 200)}; }
  };
  const xFirst = await ask(x, y, 'xy');
  const yFirst = await ask(y, x, 'yx');
  const pick = (r, firstIsX) => (r.winner === 'tie' ? 'tie' : r.winner === 'A' ? (firstIsX ? 'x' : 'y') : r.winner === 'B' ? (firstIsX ? 'y' : 'x') : 'fail');
  const a = pick(xFirst, true);
  const b = pick(yFirst, false);
  return {xFirst, yFirst, picks: [a, b], result: a === b ? a : 'split'};
}

function summarize(dir) {
  const rows = fs.readFileSync(path.join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const by = {};
  for (const r of rows) {
    if (r.out === undefined) continue;
    const k = /judge/.test(r.label || '') ? 'judge' : r.which;
    const t = by[k] = by[k] || {calls: 0, in: 0, out: 0, cost: 0, length: 0, latency: 0};
    t.calls += 1; t.in += r.in; t.out += r.out; t.cost += r.cost; t.latency += r.latencyMs; if (r.finishReason === 'length') t.length += 1;
  }
  for (const k in by) { by[k].meanLatencyMs = Math.round(by[k].latency / by[k].calls); delete by[k].latency; }
  by.http429 = rows.filter((r) => r.http429).length;
  by.errors = rows.filter((r) => r.error).length;
  return by;
}

module.exports = {MODELS, PRICE, OUT, call, judgePair, summarize, sleep};
