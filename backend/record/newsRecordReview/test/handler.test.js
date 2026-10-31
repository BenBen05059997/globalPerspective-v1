'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const {world: mkWorld, P, WEEK} = require('./fixture');
const {makeHandler} = require('../src/index');
const {readingId} = require('../src/readings');
const {PROMPT_VERSION} = require('../src/prompt');

const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const ajv = new Ajv({allErrors: true, strict: false});
const load = (...p) => JSON.parse(readFileSync(resolve(__dirname, '../schema', ...p), 'utf8'));
const validReading = ajv.compile(load('reading.schema.json'));
const validRun = ajv.compile(load('review-run.schema.json'));

const NOW = '2026-10-23T22:00:00.000Z'; // Friday; the week that ended before is 2026-W42
const answers = {
  'thread-a': {
    line: {text: 'The dispute ended; the border reopened.', cites: ['a2'], confidence: 'high'},
    chapters: [{title: 'The dispute', summary: 'Closure and end.', cites: ['a1', 'a2'], confidence: 'medium'}],
    mergeProposals: [{otherThreadId: 'thread-b', why: 'same event', cites: ['a1', 'b1e'], confidence: 'high'}],
    links: [], aliases: [{variants: ['name:tusk'], canonical: 'name:donald tusk', wikidataId: null, cites: ['a1'], confidence: 'high'}],
  },
  'thread-b': {line: {text: 'B stands.', cites: ['b1e'], confidence: 'medium'}, mergeProposals: [{otherThreadId: 'thread-a', why: 'same event', cites: ['a1', 'b1e'], confidence: 'high'}]},
  'thread-c': {line: {text: 'C stands.', cites: ['nope'], confidence: 'high'}},
};
const stub = (map = answers, calls = []) => async (opts) => {
  const bundle = JSON.parse(opts.user.slice(opts.user.indexOf('Bundle:\n') + 8));
  calls.push({opts, threadId: bundle.threadId});
  if (map[bundle.threadId] instanceof Error) throw map[bundle.threadId];
  return {content: JSON.stringify(map[bundle.threadId] || {}), model: 'stub-model'};
};
const make = (f, chat = stub(), over = {}) => makeHandler({store: f.store, chat, model: 'deepseek-large', now: () => NOW, ...over});
const only = {threadIds: ['thread-a', 'thread-b', 'thread-c']};

test('end to end with a stub model: readings, Run and the merge inbox are written under the shadow prefix, rejections recorded', async () => {
  const f = mkWorld();
  const calls = [];
  const out = await make(f, stub(answers, calls))({...only});
  assert.deepEqual([out.week, out.status, out.runId], [WEEK, 'ok', `review-${WEEK}-1`]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].opts, {step: 'review', provider: 'deepseek', model: 'deepseek-large', system: calls[0].opts.system, user: calls[0].opts.user, maxTokens: 6000, temperature: 0, json: true});
  const lines = f.lines(`${P}readings/${WEEK}.jsonl`);
  assert.ok(lines.every((l) => validReading(l)), JSON.stringify(lines.map((l) => validReading.errors)));
  assert.deepEqual(lines.map((l) => `${l.threadId}:${l.subtype}`).sort(), ['thread-a:chapter', 'thread-a:line', 'thread-a:merge_proposal', 'thread-b:line', 'thread-b:merge_proposal']);
  assert.ok(lines.every((l) => l.model === 'stub-model' && l.promptVersion === PROMPT_VERSION && l.run === `review-${WEEK}-1` && l.supersedes === null));
  assert.deepEqual(lines.find((l) => l.subtype === 'line' && l.threadId === 'thread-a').covers, {from: '2026-10-13', to: '2026-10-18'});
  const run = f.json(`${P}runs/review-${WEEK}.json`);
  assert.equal(validRun(run), true, JSON.stringify(validRun.errors));
  assert.deepEqual([run.status, run.counts.read, run.counts.failed, run.counts.autoMerges, run.counts.rejected], ['ok', 3, 0, 1, 2]);
  assert.deepEqual(run.rejections.map((r) => `${r.threadId}:${r.subtype}:${r.reason}`).sort(), [
    'thread-a:alias:alias_no_wikidata', 'thread-c:line:unknown_eventId']);
  assert.deepEqual(run.counts.readings, {line: 2, chapter: 1, link: 0, merge_proposal: 2, alias: 0, assignment: 0});
  assert.deepEqual(run.skipped, []);
  // both stories proposed the same merge: one inbox line, the older story (thread-a, born first) survives
  const inbox = f.lines(`${P}inbox/merges/2026-10-23.jsonl`);
  assert.equal(inbox.length, 1);
  assert.deepEqual([inbox[0].from, inbox[0].into, inbox[0].at, inbox[0].cites.sort()], ['thread-b', 'thread-a', NOW, ['a1', 'b1e']]);
  assert.ok(lines.filter((l) => l.subtype === 'merge_proposal').some((l) => l.readingId === inbox[0].readingId));
  // nothing was written outside the shadow prefix, and only the review's own keys
  assert.ok(f.puts.every((p) => p.Key.startsWith(P)), 'no write outside record/shadow/');
  assert.deepEqual([...new Set(f.puts.map((p) => p.Key.replace(/\d{4}-W\d{2}|\d{4}-\d{2}-\d{2}/, 'X')))].sort(), [`${P}inbox/merges/X.jsonl`, `${P}readings/X.jsonl`, `${P}runs/review-X.json`]);
});

test('shadow false writes under record/ and reads the real views', async () => {
  const f = mkWorld();
  for (const [k, v] of [...f.objs]) f.objs.set(k.replace('record/shadow/', 'record/'), v);
  const out = await make(f)({...only, shadow: false});
  assert.equal(out.status, 'ok');
  assert.ok(f.puts.every((p) => p.Key.startsWith('record/') && !p.Key.startsWith('record/shadow/')));
  assert.ok(f.objs.has(`record/readings/${WEEK}.jsonl`));
});

test('reading ids are deterministic: the same week and thing always gets the same id, different things differ', async () => {
  const a = readingId(WEEK, 'thread-a', 'chapter', {from: '2026-10-13'});
  assert.equal(a, readingId(WEEK, 'thread-a', 'chapter', {from: '2026-10-13', title: 'other text'}));
  assert.notEqual(a, readingId(WEEK, 'thread-a', 'chapter', {from: '2026-10-14'}));
  assert.notEqual(a, readingId('2026-W43', 'thread-a', 'chapter', {from: '2026-10-13'}));
  assert.match(a, /^[0-9a-f]{40}$/);
  const f1 = mkWorld();
  const f2 = mkWorld();
  await make(f1)({...only});
  await make(f2)({...only});
  assert.equal(f1.objs.get(`${P}readings/${WEEK}.jsonl`).body, f2.objs.get(`${P}readings/${WEEK}.jsonl`).body);
});

test('a re-run of the same week writes the full file again, replacing the stories it read and keeping the others', async () => {
  const f = mkWorld();
  await make(f)({...only});
  const first = f.lines(`${P}readings/${WEEK}.jsonl`);
  const changed = {...answers, 'thread-b': {line: {text: 'B changed.', cites: ['b1e'], confidence: 'low'}}};
  const out = await make(f, stub(changed))({threadIds: ['thread-b']});
  assert.equal(out.runId, `review-${WEEK}-2`);
  const second = f.lines(`${P}readings/${WEEK}.jsonl`);
  assert.equal(second.filter((l) => l.threadId === 'thread-a').length, first.filter((l) => l.threadId === 'thread-a').length);
  assert.deepEqual(second.filter((l) => l.threadId === 'thread-b').map((l) => [l.subtype, l.payload.text, l.run]), [['line', 'B changed.', `review-${WEEK}-2`]]);
  assert.equal(second.length, new Set(second.map((l) => l.readingId)).size);
});

test('a reading of a later week supersedes the earlier week\'s reading of the same thing', async () => {
  const f = mkWorld({days: {
    '2026-10-06': [require('./fixture').entry('thread-a', '2026-10-06', 'old1', 'Old')],
    '2026-10-13': [require('./fixture').entry('thread-a', '2026-10-13', 'a1', 'A one')],
  }});
  await make(f, stub({'thread-a': {line: {text: 'W41 line', cites: ['old1'], confidence: 'high'}}}))({week: '2026-W41', threadIds: ['thread-a']});
  const w41 = f.lines(`${P}readings/2026-W41.jsonl`)[0];
  assert.equal(w41.supersedes, null);
  await make(f, stub({'thread-a': {line: {text: 'W42 line', cites: ['a1'], confidence: 'high'}}}))({week: WEEK, threadIds: ['thread-a']});
  const w42 = f.lines(`${P}readings/${WEEK}.jsonl`)[0];
  assert.equal(w42.supersedes, w41.readingId);
  assert.notEqual(w42.readingId, w41.readingId);
  // W42 fully read thread-a; the next run for the same week skips nothing, and a week with no new fact since is skipped
  f.put(`${P}views/manifest.json`, {...f.json(`${P}views/manifest.json`), factsThrough: '2026-10-25'});
  const w43 = await make(f, stub({}))({week: '2026-W43', threadIds: ['thread-a']});
  assert.deepEqual(f.json(`${P}runs/review-2026-W43.json`).skipped, [{threadId: 'thread-a', reason: 'no_new_fact', since: '2026-10-18'}]);
  assert.equal(w43.counts.read, 0);
});

test('a story whose model call fails is recorded and the Run is partial; the others are still written; the run throws', async () => {
  const f = mkWorld();
  await assert.rejects(make(f, stub({...answers, 'thread-b': new Error('LLM 500: boom')}))({...only}), /partial.*thread-b: LLM 500: boom/);
  const run = f.json(`${P}runs/review-${WEEK}.json`);
  assert.equal(validRun(run), true, JSON.stringify(validRun.errors));
  assert.deepEqual([run.status, run.counts.read, run.counts.failed, run.failures], ['partial', 2, 1, [{stage: 'read', threadId: 'thread-b', message: 'LLM 500: boom'}]]);
  assert.ok(f.lines(`${P}readings/${WEEK}.jsonl`).some((l) => l.threadId === 'thread-a'));
  assert.ok(run.finishedAt);
});

test('a non-JSON answer fails only that story', async () => {
  const f = mkWorld();
  const chat = async (o) => ({content: JSON.parse(o.user.slice(o.user.indexOf('Bundle:\n') + 8)).threadId === 'thread-b' ? 'not json' : '{}', model: 'm'});
  await assert.rejects(make(f, chat)({...only}), /partial/);
  assert.equal(f.json(`${P}runs/review-${WEEK}.json`).counts.failed, 1);
});

test('the Run is written as started first, then overwritten; a thrown error leaves a failed Run and rethrows', async () => {
  const f = mkWorld();
  const seen = [];
  const chat = async (o) => { seen.push(f.json(`${P}runs/review-${WEEK}.json`).status); return {content: '{}', model: 'm'}; };
  await make(f, chat)({threadIds: ['thread-a']});
  assert.equal(seen[0], 'started');
  assert.equal(f.json(`${P}runs/review-${WEEK}.json`).status, 'ok');

  const g = mkWorld();
  g.failPut = (i) => i.Key.includes('readings/');
  await assert.rejects(make(g)({...only}), /InternalError/);
  const run = g.json(`${P}runs/review-${WEEK}.json`);
  assert.deepEqual([run.status, run.failures[0].stage, validRun(run)], ['failed', 'fatal', true]);
  assert.ok(run.finishedAt);
});

test('views not built through the week end: a failed Run and a throw, nothing read', async () => {
  const f = mkWorld({factsThrough: '2026-10-16'});
  await assert.rejects(make(f)({...only}), /views not built through 2026-10-18/);
  assert.equal(f.json(`${P}runs/review-${WEEK}.json`).status, 'failed');
  assert.equal(f.lines(`${P}readings/${WEEK}.jsonl`).length, 0);
});

test('a missing REVIEW_MODEL fails the run before any read; bad events are refused', async () => {
  const f = mkWorld();
  await assert.rejects(makeHandler({store: f.store, chat: stub(), model: undefined, now: () => NOW})({...only}), /REVIEW_MODEL/);
  await assert.rejects(make(f)({week: '2026-42'}), /week must be/);
  await assert.rejects(make(f)({threadIds: 'thread-a'}), /threadIds/);
});

test('the default week is the ISO week that ended before now', async () => {
  const f = mkWorld();
  const out = await make(f)({threadIds: ['thread-a']});
  assert.equal(out.week, WEEK);
  assert.ok(f.objs.has(`${P}readings/${WEEK}.jsonl`));
});

test('dryRun selects and assembles only: no model call, no write', async () => {
  const f = mkWorld();
  const calls = [];
  const out = await make(f, stub(answers, calls))({...only, dryRun: true});
  assert.equal(calls.length, 0);
  assert.equal(f.puts.length, 0);
  assert.deepEqual(out.selected.map((s) => s.threadId), ['thread-a', 'thread-b', 'thread-c']);
  assert.ok(out.selected.every((s) => s.bundleChars > 100));
  assert.equal(out.run.status, 'ok');
});

test('time almost out: stories not reached are recorded and the Run is not ok', async () => {
  const f = mkWorld();
  await assert.rejects(make(f, stub(), {timeLeft: () => 1000})({...only}), /failed/);
  const run = f.json(`${P}runs/review-${WEEK}.json`);
  assert.deepEqual([run.status, run.counts.notReached, run.counts.read], ['failed', 3, 0]);
  assert.equal(f.lines(`${P}readings/${WEEK}.jsonl`).length, 0);
});

test('a second run on the same day keeps the stored inbox lines and adds only new readings', async () => {
  const f = mkWorld();
  await make(f)({...only});
  const before = f.lines(`${P}inbox/merges/2026-10-23.jsonl`);
  await make(f)({...only});
  assert.deepEqual(f.lines(`${P}inbox/merges/2026-10-23.jsonl`), before);
});

test('Y3: an accepted assignment proposal is a reading (subtype assignment) and nothing else: no inbox line, no fact, no view; a rejected one is a rejection', async () => {
  const f = mkWorld();
  const map = {'thread-a': {assignments: [
    {entryId: 'a2', threadId: 'thread-b', why: 'about the other event', cites: ['a2', 'b1e'], confidence: 'medium'},
    {entryId: 'a1', threadId: 'thread-zz', why: 'no such story', cites: ['a1'], confidence: 'high'},
  ]}};
  const before = [...f.objs.keys()].sort();
  const out = await make(f, stub(map))({threadIds: ['thread-a']});
  assert.equal(out.status, 'ok');
  const lines = f.lines(`${P}readings/${WEEK}.jsonl`);
  assert.deepEqual(lines.map((l) => [l.subtype, l.payload]), [['assignment', {entryId: 'a2', threadId: 'thread-b', why: 'about the other event'}]]);
  assert.ok(lines.every((l) => validReading(l)), JSON.stringify(validReading.errors));
  const run = f.json(`${P}runs/review-${WEEK}.json`);
  assert.equal(run.counts.readings.assignment, 1);
  assert.deepEqual(run.rejections.map((r) => `${r.subtype}:${r.reason}`), ['assignment:unknown_story']);
  assert.ok(validRun(run), JSON.stringify(validRun.errors));
  const written = [...f.objs.keys()].filter((k) => !before.includes(k)).sort();
  assert.deepEqual(written, [`${P}readings/${WEEK}.jsonl`, `${P}runs/review-${WEEK}.json`]);
});

test('concurrency option caps the model calls in flight (REVIEW_CONCURRENCY in the runtime)', async () => {
  const peak = async (concurrency) => {
    let now = 0, max = 0;
    const chat = async (opts) => { now += 1; max = Math.max(max, now); await new Promise((r) => setImmediate(r)); now -= 1; return stub()(opts); };
    await make(mkWorld(), chat, {concurrency})({...only});
    return max;
  };
  assert.equal(await peak(1), 1);
  assert.equal(await peak(2), 2);
});
