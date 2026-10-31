'use strict';
// Golden-week run (decision 0039 testing): loads the frozen fixture into an in-memory S3, builds the views with newsStoryRecord's
// publisher, then runs this Lambda's handler for 2026-W42 (shadow prefix, nothing leaves the process). Not a test file.
//
//   node golden-week.js capture      bundles/<threadId>.txt and system.txt: exactly what the model is sent (no model call)
//   node golden-week.js real         the model through shared llm.js (env GROK_API_URL, XAI_API_KEY, REVIEW_MODEL)
//   node golden-week.js replay DIR   DIR/<threadId>.json answers (e.g. a drafted answer key) through the same check
//
// Output: fixtures/golden-week/runs/<promptVersion>-<mode>/ (readings.jsonl, run.json, and bundles/ for capture).
const fs = require('node:fs');
const path = require('node:path');
const {fakeS3} = require('../../newsStoryRecord/test/fake-s3');
const {makePublisher} = require('../../newsStoryRecord/src/publish');
const {makeHandler} = require('../src/index');
const {makeStore} = require('../src/store');
const {PROMPT_VERSION} = require('../src/prompt');

const FIX = path.join(__dirname, '..', 'fixtures', 'golden-week');
const P = 'record/shadow/';
const WEEK = '2026-W42';
const [mode = 'capture', replayDir] = process.argv.slice(2);
const out = path.join(FIX, 'runs', `${PROMPT_VERSION}-${mode === 'replay' ? path.basename(replayDir) : mode}`);
const threadOf = (user) => JSON.parse(user.slice(user.indexOf('Bundle:\n') + 8)).threadId;

class Put { constructor(input) { this.input = input; } }

function chatFor() {
  if (mode === 'real') return require('../src/_shared/llm').chat;
  if (mode === 'replay') return async (opts) => ({content: fs.readFileSync(path.join(replayDir, `${threadOf(opts.user)}.json`), 'utf8'), model: `replay:${path.basename(replayDir)}`});
  fs.mkdirSync(path.join(out, 'bundles'), {recursive: true});
  return async (opts) => {
    fs.writeFileSync(path.join(out, 'bundles', `${threadOf(opts.user)}.txt`), opts.user);
    fs.writeFileSync(path.join(out, 'system.txt'), opts.system);
    return {content: '{}', model: 'capture'};
  };
}

(async () => {
  const f = fakeS3();
  const {days} = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));
  for (const d of days) f.objs.set(`${P}facts/${d}.jsonl`, {body: fs.readFileSync(path.join(FIX, 'facts', `${d}.jsonl`), 'utf8'), etag: '"fx"'});
  f.put(`${P}facts/manifest.json`, {schemaVersion: 1, days});
  await makePublisher({s3json: f.s3json}).publish({prefix: P, today: '2026-10-19', builtAt: '2026-10-19T23:59:00.000Z', runId: 'golden', changedDays: days});

  const store = makeStore({s3json: f.s3json, client: f.client, PutObjectCommand: Put, bucket: 'golden'});
  const handler = makeHandler({store, chat: chatFor(), model: process.env.REVIEW_MODEL || mode, now: () => '2026-10-20T01:00:00.000Z'});
  // A partial Run throws after the readings and the Run are written; keep both.
  const summary = await handler({week: WEEK, shadow: true}).catch((e) => ({error: e.message}));
  fs.mkdirSync(out, {recursive: true});
  const readings = f.objs.get(`${P}readings/${WEEK}.jsonl`);
  fs.writeFileSync(path.join(out, 'readings.jsonl'), readings ? readings.body : '');
  fs.writeFileSync(path.join(out, 'run.json'), f.objs.get(`${P}runs/review-${WEEK}.json`).body);
  console.log(out);
  console.log(JSON.stringify(summary).slice(0, 800));
})().catch((e) => { console.error(e); process.exit(1); });
