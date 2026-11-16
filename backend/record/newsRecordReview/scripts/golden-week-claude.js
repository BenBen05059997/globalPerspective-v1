'use strict';
// Claude comparison of the golden week (decision 0056 point 1, 0059). Same fixture, same handler, same prompt as golden-week.js
// (in-memory S3, nothing leaves the process except the model call through shared llm.js), plus a per-call log.
//   node golden-week-claude.js haiku|sonnet [concurrency=2] [limit]
// Output: .board/reviews/model-quality-claude-2026-11-16/record/review/<model>/ (readings.jsonl, run.json, calls.jsonl, answers/, gates.json)
// The Anthropic key is read from ~/.gp-anthropic-key.txt into process.env here and is never logged.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.ANTHROPIC_API_KEY = fs.readFileSync(path.join(os.homedir(), '.gp-anthropic-key.txt'), 'utf8').trim();
const {fakeS3} = require('../../newsStoryRecord/test/fake-s3');
const {makePublisher} = require('../../newsStoryRecord/src/publish');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {PROMPT_VERSION} = require('../src/prompt');
const {chat} = require('../src/_shared/llm');

const FIX = path.join(__dirname, '..', 'fixtures', 'golden-week');
const P = 'record/shadow/';
const WEEK = '2026-W42';
const [which = 'haiku', conc = '2', limit] = process.argv.slice(2);
const MODELS = {haiku: 'anthropic:claude-haiku-5-5', sonnet: 'anthropic:claude-sonnet-5-5'};
const PRICE = {haiku: [0.10, 0.50], sonnet: [2, 10]};
const model = MODELS[which];
const out = path.join(__dirname, '..', '..', '..', '..', '.board', 'reviews', 'model-quality-claude-2026-11-16', 'record', 'review', which);
fs.mkdirSync(path.join(out, 'answers'), {recursive: true});
const threadOf = (user) => JSON.parse(user.slice(user.indexOf('Bundle:\n') + 8)).threadId;
class Put { constructor(input) { this.input = input; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calls = [];

async function loggedChat(opts) {
  const threadId = threadOf(opts.user);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await chat(opts);
      const u = res.usage || {};
      const rec = {threadId, finishReason: res.finishReason, latencyMs: res.latencyMs, in: u.prompt_tokens, out: u.completion_tokens, cacheHit: u.prompt_cache_hit_tokens || 0, chars: res.content.length,
        cost: (u.prompt_tokens * PRICE[which][0] + u.completion_tokens * PRICE[which][1]) / 1e6};
      calls.push(rec);
      fs.writeFileSync(path.join(out, 'answers', `${threadId}.json`), res.content);
      fs.appendFileSync(path.join(out, 'calls.jsonl'), JSON.stringify(rec) + '\n');
      return res;
    } catch (e) {
      if (e.status === 429 && attempt < 6) { console.warn(`429 on ${threadId}; waiting`); fs.appendFileSync(path.join(out, 'calls.jsonl'), JSON.stringify({threadId, http429: true}) + '\n'); await sleep(20000); continue; }
      fs.appendFileSync(path.join(out, 'calls.jsonl'), JSON.stringify({threadId, error: e.message.slice(0, 300)}) + '\n');
      throw e;
    }
  }
}

(async () => {
  fs.writeFileSync(path.join(out, 'calls.jsonl'), '');
  const f = fakeS3();
  const {days} = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));
  for (const d of days) f.objs.set(`${P}facts/${d}.jsonl`, {body: fs.readFileSync(path.join(FIX, 'facts', `${d}.jsonl`), 'utf8'), etag: '"fx"'});
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days});
  await makePublisher({s3json: f.s3json}).publish({prefix: P, today: '2026-10-19', builtAt: '2026-10-19T23:59:00.000Z', runId: 'golden', changedDays: days});
  const store = makeStore({s3json: f.s3json, client: f.client, PutObjectCommand: Put, bucket: 'golden'});
  const handler = makeHandler({store, chat: loggedChat, model, concurrency: Number(conc), now: () => '2026-10-20T01:00:00.000Z'});
  const event = {week: WEEK, shadow: true};
  if (limit) event.threadIds = JSON.parse(fs.readFileSync(path.join(FIX, 'stories.json'), 'utf8')).stories.slice(0, Number(limit)).map((s) => s.threadId);
  const summary = await handler(event).catch((e) => ({error: e.message}));
  const readings = f.objs.get(`${P}readings/${WEEK}.jsonl`);
  fs.writeFileSync(path.join(out, 'readings.jsonl'), readings ? readings.body : '');
  fs.writeFileSync(path.join(out, 'run.json'), f.objs.get(`${P}runs/review-${WEEK}.json`).body);
  const ok = calls.filter((c) => c.out !== undefined);
  const sum = (k) => ok.reduce((a, c) => a + c[k], 0);
  const tot = {promptVersion: PROMPT_VERSION, model, calls: ok.length, lengthCutoffs: ok.filter((c) => c.finishReason === 'length').length, in: sum('in'), out: sum('out'), cost: sum('cost'), meanLatencyMs: Math.round(sum('latencyMs') / ok.length)};
  fs.writeFileSync(path.join(out, 'totals.json'), JSON.stringify(tot, null, 1));
  console.log(JSON.stringify(tot));
  console.log(JSON.stringify(summary).slice(0, 600));
})().catch((e) => { console.error(e.message); process.exit(1); });
