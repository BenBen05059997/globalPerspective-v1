'use strict';
// Self-healing (src/heal.js), offline: S3, the Lambda invokes and the staging read are in-memory fakes that can simulate what the
// invoked Lambda would have written. Day D = 2026-11-04 (Wednesday); the hourly tick is at :34 (rule TriggerHealth, created 11:34 UTC).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { heal, effectiveMode, inScheduledWindow, inAgentWindow, stagingState, healFacts } = require('../src/heal');
const { agentRow, buildHealth } = require('../src/health');
const { run } = require('../src/index');

const D = '2026-11-04';
const iso = (ms) => new Date(ms).toISOString();
const lines = (n) => Array.from({ length: n }, (_, i) => JSON.stringify({ i })).join('\n') + '\n';
const ENTRIES = `record/inbox/entries/${D}.jsonl`;
const LEDGER = `monitoring/heal/${D}.json`;
const RECOVER = `monitoring/heal/recover/${D}.json`;
const FRESH = { generationId: `gen-${Date.parse(`${D}T20:15:30Z`)}`, updatedAt: `${D}T20:15:30.000Z`, agentProcessedAt: null };
const STALE = { generationId: `gen-${Date.parse(`${D}T04:15:30Z`)}`, updatedAt: `${D}T04:15:30.000Z`, agentProcessedAt: `${D}T04:26:00.000Z` };

function makeWorld({ staging = FRESH } = {}) {
  const w = { files: new Map(), calls: [], puts: [], now: 0, staging, failPut: null, failInvoke: null, failRead: null, onInvoke: {}, reads: 0, emptyDays: new Set() };
  w.ports = {
    readText: async (k) => {
      w.reads += 1;
      if (w.failRead && w.failRead(k)) throw new Error('AccessDenied');
      const f = w.files.get(k);
      if (!f && /^record\/inbox\/entries\/\d{4}-\d{2}-\d{2}\.jsonl$/.test(k) && k !== ENTRIES && !w.emptyDays.has(k)) return { text: lines(30), at: iso(w.now) };   // every other day is healthy
      return f ? { text: f.text, at: f.at } : null;
    },
    putJson: async (k, o) => { if (w.failPut && w.failPut(k)) throw new Error('put denied'); w.files.set(k, { text: JSON.stringify(o), at: iso(w.now) }); w.puts.push(k); },
    invoke: async (fn, payload) => { w.calls.push({ fn, payload, at: iso(w.now) }); if (w.failInvoke === fn) throw new Error('invoke refused'); if (w.onInvoke[fn]) w.onInvoke[fn](payload, w); },
    staging: async () => w.staging,
  };
  w.set = (k, text) => w.files.set(k, { text, at: iso(w.now) });
  w.ledger = () => JSON.parse(w.files.get(LEDGER).text);
  w.tick = (t, mode = 'on') => { w.now = Date.parse(t); return heal({ ports: w.ports, now: w.now, mode }); };
  w.fns = () => w.calls.map((c) => c.fn);
  return w;
}
const agentWrites = (n = 30) => (_, w) => w.set(ENTRIES, lines(n));
const recoverGives = (status, inboxLines, extra = {}) => ({ day }, w) => w.set(`monitoring/heal/recover/${day}.json`, JSON.stringify({ day, status, error: null, startedAt: iso(w.now + 5000), finishedAt: iso(w.now + 90000), gkg: { status: status === 'failed' ? 'failed' : 'ok' }, counts: { appended: inboxLines, inboxLines }, failureCount: 0, ...extra }));
const recordGives = (status = 'ok', failures = []) => ({ date }, w) => w.set(`record/runs/${date}.json`, JSON.stringify({ runId: `${date}-2`, date, status, notes: 'recovery', inputs: { archiveDay: 'missing', recovered: true }, failures, finishedAt: iso(w.now + 60000) }));
/** Ticks at :34 of every hour from `from` (inclusive) to `to` (inclusive). */
async function ticks(w, from, to) { for (let t = Date.parse(from); t <= Date.parse(to); t += 3600000) await w.tick(iso(t)); }

test('windows: never inside a scheduled run; the agent re-run only from 21:00 to 23:00 UTC of the day itself', () => {
  const at = (hhmm, day = D) => Date.parse(`${day}T${hhmm}:00Z`);
  for (const q of ['04:10', '04:25', '04:34', '04:55', '12:34', '20:25', '20:34', '20:55', '23:40', '23:45', '23:59', '00:00', '00:10']) assert.equal(inScheduledWindow(at(q)), true, q);
  for (const f of ['00:34', '03:34', '05:34', '13:34', '21:34', '22:34', '23:34']) assert.equal(inScheduledWindow(at(f)), false, f);
  assert.equal(inAgentWindow(D, at('21:00')), true);
  assert.equal(inAgentWindow(D, at('21:34')), true);
  assert.equal(inAgentWindow(D, at('22:59')), true);
  assert.equal(inAgentWindow(D, at('23:00')), false);
  assert.equal(inAgentWindow(D, at('20:59')), false);
  assert.equal(inAgentWindow(D, at('21:34', '2026-11-05')), false);   // the next day's 21:34 is not day D's window
});

test('staging counts as fresh only when it was generated on the day and not yet processed', () => {
  assert.equal(stagingState(FRESH, D).fresh, true);
  assert.match(stagingState(STALE, D).why, /already processed/);
  assert.match(stagingState({ ...FRESH, generationId: `gen-${Date.parse('2026-11-03T20:15:00Z')}` }, D).why, /not on 2026-11-04/);
  assert.match(stagingState(null, D).why, /no staging item/);
  assert.equal(stagingState({ updatedAt: `${D}T20:15:00Z` }, D).fresh, true);   // no gen- id: updatedAt
});

test('a forced-missing day heals without a hand: one agent re-run at 21:34, confirmed at 22:34, nothing after', async () => {
  const w = makeWorld();
  w.onInvoke.newsAgent = agentWrites(31);
  await ticks(w, `${D}T13:34:00Z`, `${D}T20:34:00Z`);           // the day is still open, and 20:34 is inside the 20:25 run's window
  assert.deepEqual(w.calls, []);
  assert.deepEqual(w.puts, []);                                   // nothing to say, no ledger yet
  const r = await w.tick(`${D}T21:34:00Z`);
  assert.deepEqual(w.calls, [{ fn: 'newsAgent', payload: {}, at: `${D}T21:34:00.000Z` }]);
  assert.deepEqual(r.actions.map((a) => [a.day, a.step, a.fn, a.dry]), [[D, 'agent', 'newsAgent', false]]);
  assert.equal(w.ledger().agent.invokedAt, `${D}T21:34:00.000Z`);
  await w.tick(`${D}T22:34:00Z`);
  const L = w.ledger();
  assert.equal(L.outcome, 'healed');
  assert.match(L.why, /agent re-run at 21:34 UTC wrote 31 entries/);
  await ticks(w, `${D}T23:34:00Z`, '2026-11-06T06:34:00Z');
  assert.deepEqual(w.fns(), ['newsAgent']);                       // still one call, two days later
});

test('staging that is not today\'s: the ingest runs first (21:34), the agent follows on the next tick (22:34), confirmed at 23:34', async () => {
  const w = makeWorld({ staging: STALE });
  w.onInvoke.newsIngest = (_, ww) => { ww.staging = FRESH; };
  w.onInvoke.newsAgent = agentWrites(28);
  await w.tick(`${D}T21:34:00Z`);
  assert.deepEqual(w.fns(), ['newsIngest']);
  assert.match(w.ledger().ingest.reason, /already processed/);
  await w.tick(`${D}T22:34:00Z`);
  assert.deepEqual(w.fns(), ['newsIngest', 'newsAgent']);
  await w.tick(`${D}T23:34:00Z`);
  assert.equal(w.ledger().outcome, 'healed');
  await ticks(w, `2026-11-05T00:34:00Z`, '2026-11-05T09:34:00Z');
  assert.deepEqual(w.fns(), ['newsIngest', 'newsAgent']);
});

test('an ingest re-run that leaves no fresh staging: no agent run is tried on stale topics; recovery takes over after midnight', async () => {
  const w = makeWorld({ staging: STALE });
  w.onInvoke.newsRecover = recoverGives('ok', 1600);
  w.onInvoke.newsStoryRecord = recordGives();
  await ticks(w, `${D}T21:34:00Z`, `${D}T22:34:00Z`);
  assert.deepEqual(w.fns(), ['newsIngest']);
  assert.equal(w.ledger().agent.outcome, 'skipped');
  assert.match(w.ledger().agent.why, /ingest re-run left no fresh staging/);
  await ticks(w, `${D}T23:34:00Z`, '2026-11-05T02:34:00Z');
  assert.deepEqual(w.fns(), ['newsIngest', 'newsRecover', 'newsStoryRecord']);
  assert.equal(w.ledger().outcome, 'recovered');
});

test('the agent re-run changes nothing: after midnight the day is recovered from public records, then marked recovered', async () => {
  const w = makeWorld();
  w.onInvoke.newsRecover = recoverGives('ok', 1624);
  w.onInvoke.newsStoryRecord = recordGives();
  await ticks(w, `${D}T21:34:00Z`, `${D}T23:34:00Z`);
  assert.deepEqual(w.fns(), ['newsAgent']);
  assert.equal(w.ledger().agent.outcome, 'no_archive');          // set at 22:34, 60 min after the re-run; no second run
  await w.tick('2026-11-05T00:10:00Z');                           // inside the nightly record window
  assert.deepEqual(w.fns(), ['newsAgent']);
  await w.tick('2026-11-05T00:20:00Z');                           // D+1 00:20: GDELT's last quarter-hour file may not be out yet
  assert.deepEqual(w.fns(), ['newsAgent']);
  await w.tick('2026-11-05T00:34:00Z');
  assert.deepEqual(w.calls[1], { fn: 'newsRecover', payload: { day: D }, at: '2026-11-05T00:34:00.000Z' });
  await w.tick('2026-11-05T01:34:00Z');
  assert.deepEqual(w.calls[2], { fn: 'newsStoryRecord', payload: { recovery: true, date: D }, at: '2026-11-05T01:34:00.000Z' });
  await w.tick('2026-11-05T02:34:00Z');
  const L = w.ledger();
  assert.equal(L.outcome, 'recovered');
  assert.equal(L.recovered.articles, 1624);
  await ticks(w, '2026-11-05T03:34:00Z', '2026-11-07T12:34:00Z');
  assert.deepEqual(w.fns(), ['newsAgent', 'newsRecover', 'newsStoryRecord']);
});

test('a day that cannot heal stays missing and does not loop: 1 agent run, 3 recovery attempts, then it stops', async () => {
  const w = makeWorld();
  w.onInvoke.newsRecover = recoverGives('failed', 0, { error: null, gkg: { status: 'failed' } });
  await ticks(w, `${D}T21:34:00Z`, '2026-11-08T00:34:00Z');
  assert.deepEqual(w.fns(), ['newsAgent', 'newsRecover', 'newsRecover', 'newsRecover']);
  const L = w.ledger();
  assert.equal(L.outcome, 'unhealed');
  assert.match(L.why, /recovery failed after 3 attempt\(s\)/);
  assert.equal(L.recovery.attempts.length, 3);
  assert.equal(w.files.has(`record/runs/${D}.json`), false);      // nothing was built from nothing
  const puts = w.puts.length;
  await ticks(w, '2026-11-08T01:34:00Z', '2026-11-09T01:34:00Z');
  assert.equal(w.puts.length, puts);                              // settled: not even rewritten
  // and the health row stays missing, with the reason
  const row = agentRow(D, true, { lines: 0, at: null }, { json: L });
  assert.equal(row.status, 'missing');
  assert.match(row.note, /unhealed, recovery failed after 3 attempt/);
});

test('recovery that returns fewer than 300 articles is not a day: unhealed after one attempt (status ok is not retried), no record run', async () => {
  const w = makeWorld();
  w.onInvoke.newsRecover = recoverGives('ok', 120);
  await ticks(w, `${D}T21:34:00Z`, '2026-11-05T05:34:00Z');
  assert.deepEqual(w.fns(), ['newsAgent', 'newsRecover']);
  assert.match(w.ledger().why, /120 articles, under the 300/);
  assert.equal(w.ledger().outcome, 'unhealed');
});

test('a recovery attempt that fails once is retried on the next tick and can still recover the day', async () => {
  const w = makeWorld();
  let n = 0;
  w.onInvoke.newsRecover = (p, ww) => (++n === 1 ? recoverGives('failed', 0)(p, ww) : recoverGives('partial', 1500)(p, ww));
  w.onInvoke.newsStoryRecord = recordGives();
  await ticks(w, `${D}T21:34:00Z`, '2026-11-05T04:34:00Z');
  assert.deepEqual(w.fns(), ['newsAgent', 'newsRecover', 'newsRecover', 'newsStoryRecord']);
  assert.equal(w.ledger().outcome, 'recovered');
  assert.equal(w.ledger().recovered.articles, 1500);
});

test('a recovery invoke that wrote no result file is an error after 20 minutes, not a success', async () => {
  const w = makeWorld();
  await ticks(w, `${D}T21:34:00Z`, '2026-11-05T01:34:00Z');
  const a = w.ledger().recovery.attempts;
  assert.equal(a[0].result.status, 'error');
  assert.match(a[0].result.error, /no result file/);
  assert.equal(a.length, 2);
});

test('the record run never shows up: one more try, then unhealed (recovery is never claimed without the run)', async () => {
  const w = makeWorld();
  w.onInvoke.newsRecover = recoverGives('ok', 1600);
  await ticks(w, `${D}T21:34:00Z`, '2026-11-05T04:34:00Z');
  assert.deepEqual(w.fns().filter((f) => f === 'newsStoryRecord').length, 2);
  assert.equal(w.ledger().outcome, 'unhealed');
  assert.match(w.ledger().why, /left no recovery run/);
});

test('a record run that ended with failures is not "recovered"', async () => {
  const w = makeWorld();
  w.onInvoke.newsRecover = recoverGives('ok', 1600);
  w.onInvoke.newsStoryRecord = recordGives('partial', [{ stage: 'views', message: 'x' }]);
  await ticks(w, `${D}T21:34:00Z`, '2026-11-05T05:34:00Z');
  assert.equal(w.ledger().outcome, 'unhealed');
  assert.match(w.ledger().why, /ended partial with 1 failure/);
});

test('at most once per step: two ticks in the same minute, a failed ledger write and a refused invoke all leave one attempt', async () => {
  const a = makeWorld();
  await a.tick(`${D}T21:34:00Z`); await a.tick(`${D}T21:34:00Z`); await a.tick(`${D}T21:40:00Z`);
  assert.deepEqual(a.fns(), ['newsAgent']);

  const b = makeWorld();
  b.failPut = (k) => k === LEDGER;
  const r = await b.tick(`${D}T21:34:00Z`);
  assert.deepEqual(b.calls, []);                                  // no record of the attempt, no invoke
  assert.match(r.errors[0].error, /put denied/);
  b.failPut = null;
  await b.tick(`${D}T22:34:00Z`);
  assert.deepEqual(b.fns(), ['newsAgent']);

  const c = makeWorld();
  c.failInvoke = 'newsAgent';
  await c.tick(`${D}T21:34:00Z`);
  assert.match(c.ledger().agent.error, /invoke refused/);
  await c.tick(`${D}T22:34:00Z`);
  assert.deepEqual(c.fns(), ['newsAgent']);                       // the refused invoke used the day's attempt
});

test('nothing starts inside a scheduled window: recovery waits from 04:34 to 05:34', async () => {
  const w = makeWorld();
  w.set(LEDGER, JSON.stringify({ schemaVersion: 1, day: D, createdAt: `${D}T21:34:00.000Z`, outcome: null, agent: { invokedAt: null, outcome: 'not_attempted', why: 'x' }, ingest: null, recovery: null, record: null, events: [] }));
  w.onInvoke.newsRecover = recoverGives('ok', 1600);
  await w.tick('2026-11-05T04:34:00Z');
  assert.deepEqual(w.calls, []);
  await w.tick('2026-11-05T05:34:00Z');
  assert.deepEqual(w.fns(), ['newsRecover']);
});

test('days that are fine are left alone: a thin day, a day older than two days, and a day that is open before 21:00', async () => {
  const w = makeWorld();
  w.set(ENTRIES, lines(10));
  w.emptyDays.add('record/inbox/entries/2026-11-01.jsonl');       // D-3, empty
  await ticks(w, `${D}T12:34:00Z`, '2026-11-05T09:34:00Z');
  assert.deepEqual(w.calls, []);
  assert.deepEqual(w.puts, []);
});

test('an unreadable archive or ledger is skipped, never treated as missing', async () => {
  const w = makeWorld();
  w.failRead = (k) => k === ENTRIES;
  const r = await w.tick(`${D}T21:34:00Z`);
  assert.deepEqual(w.calls, []);
  assert.match(r.skipped[0].why, /entries unreadable: AccessDenied/);
  w.failRead = (k) => k === LEDGER;
  const r2 = await w.tick(`${D}T21:34:00Z`);
  assert.deepEqual(w.calls, []);
  assert.match(r2.skipped[0].why, /ledger unreadable/);
});

test('dry mode reports what it would do and writes and invokes nothing; off does not even read', async () => {
  const w = makeWorld();
  const r = await w.tick(`${D}T21:34:00Z`, 'dry');
  assert.deepEqual(r.actions.map((a) => [a.step, a.dry]), [['agent', true]]);
  assert.deepEqual(w.calls, []);
  assert.deepEqual(w.puts, []);
  w.reads = 0;
  const off = await w.tick(`${D}T21:34:00Z`, 'off');
  assert.equal(off.mode, 'off');
  assert.equal(w.reads, 0);
  assert.equal((await heal({ ports: w.ports, now: Date.parse(`${D}T21:34:00Z`), mode: 'nonsense' })).mode, 'off');
});

test('effectiveMode: a flag can lower the mode, never raise it', () => {
  assert.equal(effectiveMode('on', null), 'on');
  assert.equal(effectiveMode('on', 'dry'), 'dry');
  assert.equal(effectiveMode('on', 'off'), 'off');
  assert.equal(effectiveMode('dry', 'on'), 'dry');
  assert.equal(effectiveMode('off', 'on'), 'off');
  assert.equal(effectiveMode('weird', null), 'off');
});

test('the health row: recovered is its own status with the numbers and the reason; healed is ok; in progress is no data with the note', () => {
  const rec = { outcome: 'recovered', outcomeAt: '2026-11-05T02:34:00.000Z', why: 'x', recovered: { articles: 1624 }, agent: { outcome: 'no_archive' }, recovery: { attempts: [{ invokedAt: 'a', result: { status: 'ok' } }] }, ingest: null, record: { invokedAt: 'b' } };
  const row = agentRow(D, true, { missing: true }, { json: rec });
  assert.equal(row.status, 'recovered');
  assert.equal(row.facts.entries, 0);
  assert.equal(row.facts.heal.recoveredArticles, 1624);
  assert.match(row.note, /1624 raw articles/);
  assert.match(row.note, /no story entries and no forecasts/);
  assert.match(row.source, /monitoring\/heal\/2026-11-04\.json/);
  assert.equal(agentRow(D, true, { lines: 31, at: 'z' }, { json: { outcome: 'healed', why: 'the agent re-run at 21:34 UTC wrote 31 entries', agent: { invokedAt: 'q' } } }).status, 'ok');
  const open = agentRow(D, false, { missing: true }, { json: { outcome: null, agent: { invokedAt: '2026-11-04T21:34:00.000Z' } } });
  assert.equal(open.status, 'nodata');
  assert.match(open.note, /day in progress\. Self-healing: in progress/);
  assert.equal(healFacts(null), null);
  assert.match(agentRow(D, true, { missing: true }, { error: 'AccessDenied' }).note, /ledger unreadable: AccessDenied/);
  // no ledger: the row is what it was before phase 4
  assert.equal(agentRow(D, true, { missing: true }, { missing: true }).note, null);
});

// ---- the whole run: heal first, then health.json shows it ----
const NOW0 = Date.parse('2026-11-05T02:34:00Z');
function fakeAws(w) {
  return {
    readText: w.ports.readText, putJson: w.ports.putJson, invoke: w.ports.invoke, staging: w.ports.staging,
    resolverStatus: async () => ({ sampled: 1, due: 0, drafted: 0, verdicts: 0, commits: [] }),
    lambdaErrors: async () => ({}), compareCounts: async () => ({}), usageRows: async () => [], costByService: async () => [],
    listKeys: async () => [], clientErrorRows: async () => [], auditLog: async () => null,
  };
}

test('run(): a recovered day is in health.json as agent "recovered" and now.heal says what this tick did; the file matches its schema', async (t) => {
  const w = makeWorld();
  w.now = Date.parse('2026-11-05T01:34:00Z');
  w.set(LEDGER, JSON.stringify({ schemaVersion: 1, day: D, createdAt: `${D}T21:34:00.000Z`, outcome: null, ingest: null, agent: { invokedAt: `${D}T21:34:00.000Z`, outcome: 'no_archive' },
    recovery: { attempts: [{ invokedAt: '2026-11-05T00:34:00.000Z', result: { status: 'ok', appended: 1624, inboxLines: 1624 } }] }, record: null, events: [] }));
  w.onInvoke.newsStoryRecord = recordGives();
  const first = await run({ aws: fakeAws(w), now: w.now, healMode: 'on', skipReaders: true, skipQuality: true, skipCost: true, log: () => {} });
  assert.deepEqual(first.health.now.heal.actions.map((a) => [a.day, a.step, a.dry]), [[D, 'record', false]]);
  assert.equal(first.health.days.find((d) => d.date === D).rows.find((r) => r.stage === 'agent').status, 'nodata'.replace('nodata', 'missing'));
  w.now = NOW0;
  const second = await run({ aws: fakeAws(w), now: NOW0, healMode: 'on', skipReaders: true, skipQuality: true, skipCost: true, log: () => {} });
  const agent = second.health.days.find((d) => d.date === D).rows.find((r) => r.stage === 'agent');
  assert.equal(agent.status, 'recovered');
  assert.equal(second.health.now.heal.mode, 'on');
  let Ajv;
  try { Ajv = require(require.resolve('ajv', { paths: [path.resolve(__dirname, '../../../../global-perspectives-starter/frontend')] })); } catch { return t.skip('ajv is not installed (frontend npm ci)'); }
  const ajv = new Ajv({ allErrors: true, strict: false });
  try { require(require.resolve('ajv-formats', { paths: [path.resolve(__dirname, '../../../../global-perspectives-starter/frontend')] }))(ajv); } catch { /* formats optional */ }
  const validate = ajv.compile(require('../../../record/schema/health.schema.json'));
  assert.equal(validate(second.health), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...second.health, now: { ...second.health.now, heal: { ...second.health.now.heal, mode: 'maybe' } } }), false);
});

test('run(): with HEAL off (the default) nothing is read for healing and health.json says mode off', async () => {
  const w = makeWorld();
  w.now = Date.parse(`${D}T21:34:00Z`);
  const out = await run({ aws: fakeAws(w), now: w.now, skipReaders: true, skipQuality: true, skipCost: true, log: () => {} });
  assert.equal(out.health.now.heal.mode, 'off');
  assert.deepEqual(w.calls, []);
  const dry = await run({ aws: fakeAws(w), now: w.now, healMode: 'on', dry: true, skipReaders: true, skipQuality: true, skipCost: true, log: () => {} });
  assert.equal(dry.health.now.heal.mode, 'dry');
  assert.deepEqual(w.calls, []);
});

test('buildHealth still works against a world with no ledger files at all (14 reads that find nothing)', async () => {
  const w = makeWorld();
  const { health } = await buildHealth({ readText: w.ports.readText, resolverStatus: async () => ({}), lambdaErrors: async () => ({}), compareCounts: async () => ({}) }, Date.parse(`${D}T12:00:00Z`));
  assert.equal(health.days.length, 14);
});
