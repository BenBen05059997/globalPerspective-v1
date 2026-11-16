'use strict';
// Claude comparison of the source-audit step (2026-11-16). Runs the Lambda's own handler (src/index.js) unchanged, once per model, with:
//   - SNS stubbed (nothing is sent; SNS_TOPIC_ARN unset as live),
//   - the Lambda's PROXY_ENDPOINT set to the public read proxy the site uses (read-only 'topics' and 'summary' actions; answers cached so both
//     models see the same inputs),
//   - the Lambda's article fetches passed through (public GET of each source URL, cached for the second model),
//   - the model call (shared llm.js chat) wrapped to log the exact system/user text, the answer and the usage. Model comes from AUDIT_MODEL.
// Nothing is written to AWS. AUDIT_N=5.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const L = require('../../../shared/scripts/claude-compare-lib');

const dir = path.join(L.OUT, 'audit');
fs.mkdirSync(path.join(dir, 'inputs'), {recursive: true});
const PROXY = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy'; // public, from the site's served config.js
const realFetch = global.fetch;
const cache = new Map();
global.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('api.anthropic.com')) return realFetch(url, init);
  const key = u + (init.body || '');
  if (!cache.has(key)) {
    let rec;
    try { const r = await realFetch(url, init); rec = {status: r.status, text: await r.text()}; } catch (e) { rec = {error: e}; }
    cache.set(key, rec);
  }
  const rec = cache.get(key);
  if (rec.error) throw rec.error;
  return new Response(rec.text, {status: rec.status});
};

// stub the SNS client: the Lambda requires it at load; it is never called (no SNS_TOPIC_ARN)
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { return request === '@aws-sdk/client-sns' ? request : origResolve.call(this, request, ...rest); };
require.cache['@aws-sdk/client-sns'] = {id: '@aws-sdk/client-sns', filename: '@aws-sdk/client-sns', loaded: true, exports: {SNSClient: class { async send() { throw new Error('SNS must not be called'); } }, PublishCommand: class {}}};

const llm = require('../src/_shared/llm');
const realChat = llm.chat;

async function runOne(which) {
  const captured = [];
  llm.chat = async (opts) => {
    const res = await L.call(which, {...opts}, dir, `audit:${which}:${captured.length}`);
    captured.push({system: opts.system, user: opts.user, maxTokens: opts.maxTokens, content: res.content, finishReason: res.finishReason, usage: res.usage, latencyMs: res.latencyMs});
    return res;
  };
  process.env.PROXY_ENDPOINT = PROXY;
  process.env.AUDIT_N = '5';
  process.env.AUDIT_MODEL = L.MODELS[which];
  delete process.env.SNS_TOPIC_ARN;
  delete require.cache[require.resolve('../src/index.js')];
  const {handler} = require('../src/index.js');
  const logs = [];
  const ol = console.log; const oe = console.error;
  console.log = (...a) => { logs.push(a.join(' ')); }; console.error = (...a) => { logs.push('ERR ' + a.join(' ')); };
  let result;
  try { result = await handler(); } finally { console.log = ol; console.error = oe; }
  llm.chat = realChat;
  return {result, logs: logs.filter((l) => !l.startsWith('[usage]')), calls: captured};
}

(async () => {
  fs.writeFileSync(path.join(dir, 'calls.jsonl'), '');
  const res = {};
  for (const which of ['haiku', 'sonnet']) res[which] = await runOne(which);
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(res, null, 1));
  const n = Math.min(res.haiku.calls.length, res.sonnet.calls.length);
  const judge = [];
  for (let i = 0; i < n; i++) {
    const h = res.haiku.calls[i]; const s = res.sonnet.calls[i];
    if (h.user !== s.user) { judge.push({i, skipped: 'inputs differ'}); continue; }
    fs.writeFileSync(path.join(dir, 'inputs', `${i}.txt`), `SYSTEM:\n${h.system}\n\nUSER:\n${h.user}`);
    judge.push({i, ...(await L.judgePair(`${h.system}\n\n${h.user}`, h.content.trim(), s.content.trim(), dir, `audit:${i}:hs`))});
    fs.writeFileSync(path.join(dir, 'judge.json'), JSON.stringify(judge, null, 1));
  }
  console.log(JSON.stringify(L.summarize(dir)));
})().catch((e) => { console.error(e.message); process.exit(1); });
