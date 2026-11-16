// Helpers for the 2026-11-16 prompt-fix before/after tests. Calls go ONLY through the shared chat() with the Lambda's own options and
// an Anthropic model; the key is read from ~/.gp-anthropic-key.txt into this process and never printed or logged. At most 2 calls in flight,
// wait-and-retry on HTTP 429 (counted), spend ledger with a hard stop. No AWS, no DeepSeek (buildRequest is checked before every call).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
process.env.ANTHROPIC_API_KEY = fs.readFileSync(path.join(os.homedir(), '.gp-anthropic-key.txt'), 'utf8').trim();
const require = createRequire(import.meta.url);
export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const { chat, buildRequest, jsonText, stripCodeFence } = require(path.join(ROOT, 'backend/shared/src/llm.js'));
export const MODELS = { haiku: 'anthropic:claude-haiku-5-5', sonnet: 'anthropic:claude-sonnet-5-5' };
const PRICE = { haiku: [0.10, 0.50], sonnet: [2, 10] };
export const OUT = process.env.OUT;
if (!OUT) throw new Error('set OUT (a scratch directory for raw outputs and the spend ledger)');
fs.mkdirSync(OUT, { recursive: true });
const ledgerFile = path.join(OUT, '_spend.json');
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { usd: 0, calls: 0, retries429: 0, perTag: {} };
const CAP = Number(process.env.CAP_USD || 5);
export const spent = () => ledger.usd;
export const stats = ledger;
let inflight = 0;
const waiters = [];
const slot = async () => { while (inflight >= 2) await new Promise((r) => waiters.push(r)); inflight++; };
const free = () => { inflight--; const w = waiters.shift(); if (w) w(); };

/** One call: tag for the ledger, m = 'haiku'|'sonnet', opts = the caller's chat() options (no model). */
export async function call(tag, m, opts) {
  if (ledger.usd >= CAP) throw new Error(`spend cap reached (${ledger.usd.toFixed(2)} USD)`);
  const o = { ...opts, model: MODELS[m] };
  if (buildRequest(o).provider !== 'anthropic') throw new Error('guard: not an Anthropic request');
  await slot();
  try {
    for (let a = 0; ; a++) {
      try {
        const r = await chat(o);
        const usd = ((r.usage?.prompt_tokens || 0) * PRICE[m][0] + (r.usage?.completion_tokens || 0) * PRICE[m][1]) / 1e6;
        ledger.usd += usd; ledger.calls++; ledger.perTag[tag] = (ledger.perTag[tag] || 0) + usd;
        fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
        return { content: r.content, finishReason: r.finishReason, usage: r.usage, usd };
      } catch (e) {
        if ((e.status === 429 || /LLM 429/.test(e.message)) && a < 6) { ledger.retries429++; await new Promise((x) => setTimeout(x, 20000 * (a + 1))); continue; }
        throw e;
      }
    }
  } finally { free(); }
}
export const pool = (items, fn) => Promise.all(items.map((x, i) => fn(x, i)));
export const write = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };
export const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
