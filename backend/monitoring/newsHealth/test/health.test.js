'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildHealth } = require('../src/health');
const { lastDays, isClosed, isoWeek } = require('../src/days');

const NOW = Date.parse('2026-11-04T12:00:00Z'); // a Wednesday
const lines = (n) => Array.from({ length: n }, (_, i) => JSON.stringify({ i })).join('\n') + '\n';
const run = (day, extra = {}) => JSON.stringify({ date: day, status: 'ok', inputs: { rawDay: 'present' }, counts: { entry: 30, forecast_drawn: 12 }, failures: [], finishedAt: `${day}T23:46:00Z`, ...extra });

/** A fake world: files is { key: text | Error }, anything else is "no such key". */
function ports(files, extra = {}) {
  return {
    readText: async (key) => {
      const v = files[key];
      if (v instanceof Error) throw v;
      return v == null ? null : { text: v, at: '2026-11-04T05:00:00.000Z' };
    },
    resolverStatus: async () => ({ sampled: 88, due: 11, drafted: 200, verdicts: 25, commits: ['a', 'b'] }),
    lambdaErrors: async () => ({ newsA: { '2026-11-02': 2, '2026-11-03': 9 } }),
    compareCounts: async () => ({ newsAgent: { '2026-11-03': 1 } }),
    ...extra,
  };
}
const world = (over = {}) => JSON.stringify({ generated_at: '2026-11-04T11:40:00Z', stale: false, sources: { newsDegraded: false, gdacsDegraded: false }, situations: [{ state: 'peak' }, { state: 'closed' }, { state: 'cooling' }], ...over });
const base = () => ({
  'record/views/manifest.json': JSON.stringify({ builtAt: '2026-11-04T05:20:00Z', factsThrough: '2026-11-03', provisionalThrough: '2026-11-04' }),
  'world/latest.json': world(),
  'record/views/health/settle-tick.json': JSON.stringify({ at: '2026-11-04T10:30:00Z', committed: 0, drawn: 0, drafted: 40, settled: 4, errors: 0 }),
  'record/runs/2026-11-03.json': run('2026-11-03'),
  'record/inbox/entries/2026-11-03.jsonl': lines(47),
  'record/notes/daily_brief/2026-11-03.jsonl': lines(1),
  'record/notes/country/2026-11-03.jsonl': lines(3),
  'record/inbox/entries/2026-11-04.jsonl': lines(8),
});
const cell = (health, day, stage) => health.days.find((d) => d.date === day).rows.find((r) => r.stage === stage);

test('days: 14 UTC days ending today, closing rule, ISO week', () => {
  const days = lastDays(NOW, 14);
  assert.equal(days.length, 14);
  assert.equal(days[13], '2026-11-04');
  assert.equal(days[0], '2026-10-22');
  assert.equal(isClosed('2026-11-03', NOW, 1), true);
  assert.equal(isClosed('2026-11-04', NOW, 1), false);
  assert.equal(isClosed('2026-11-03', Date.parse('2026-11-04T00:30:00Z'), 1), false);
  assert.equal(isoWeek('2026-11-02'), '2026-W45');
  assert.equal(isoWeek('2026-11-01'), '2026-W44');
  assert.equal(isoWeek('2026-01-01'), '2026-W01');
});

test('a healthy closed day: every file-backed stage is ok and names its source', async () => {
  const { health } = await buildHealth(ports(base()), NOW);
  assert.equal(health.days.length, 14);
  for (const stage of ['ingest', 'agent', 'record', 'views', 'briefs']) assert.equal(cell(health, '2026-11-03', stage).status, 'ok', stage);
  const agent = cell(health, '2026-11-03', 'agent');
  assert.equal(agent.facts.entries, 47);
  assert.match(agent.source, /record\/inbox\/entries\/2026-11-03\.jsonl/);
  assert.equal(cell(health, '2026-11-03', 'record').facts.counts.entry, 30);
  assert.ok(cell(health, '2026-11-03', 'record').at);
});

test('thresholds: 47 ok, 20 ok, 19 thin, 0 or missing file missing; an open day is never judged', async () => {
  const files = { ...base(), 'record/inbox/entries/2026-11-02.jsonl': lines(19), 'record/inbox/entries/2026-11-01.jsonl': lines(20), 'record/inbox/entries/2026-10-31.jsonl': '' };
  const { health } = await buildHealth(ports(files), NOW);
  assert.equal(cell(health, '2026-11-03', 'agent').status, 'ok');
  assert.equal(cell(health, '2026-11-02', 'agent').status, 'thin');
  assert.equal(cell(health, '2026-11-01', 'agent').status, 'ok');
  assert.equal(cell(health, '2026-10-31', 'agent').status, 'missing');
  assert.equal(cell(health, '2026-10-30', 'agent').status, 'missing'); // no file at all
  const today = cell(health, '2026-11-04', 'agent');
  assert.equal(today.status, 'nodata');
  assert.equal(today.note, 'day in progress');
  assert.equal(today.facts.entries, 8);
});

test('a day with no files at all (the October gap): missing, never a made-up value', async () => {
  const { health } = await buildHealth(ports(base()), NOW);
  assert.equal(cell(health, '2026-10-24', 'record').status, 'missing');
  assert.equal(cell(health, '2026-10-24', 'agent').status, 'missing');
  assert.equal(cell(health, '2026-10-24', 'ingest').status, 'nodata');
  assert.equal(cell(health, '2026-10-24', 'briefs').status, 'missing');
});

test('record run: partial is thin, failed or any failure is failed', async () => {
  const files = {
    ...base(),
    'record/runs/2026-11-02.json': run('2026-11-02', { status: 'partial', failures: [{ stage: 'views', message: 'boom' }] }),
    'record/runs/2026-11-01.json': run('2026-11-01', { status: 'failed', failures: [{ stage: 'facts', message: 'x'.repeat(500) }] }),
    'record/runs/2026-10-31.json': run('2026-10-31', { inputs: { rawDay: 'missing' } }),
  };
  const { health } = await buildHealth(ports(files), NOW);
  assert.equal(cell(health, '2026-11-02', 'record').status, 'thin');
  const failed = cell(health, '2026-11-01', 'record');
  assert.equal(failed.status, 'failed');
  assert.ok(failed.facts.failures[0].length < 200);
  assert.equal(cell(health, '2026-10-31', 'ingest').status, 'missing');
});

test('a source that cannot be read: nodata with the error text, other stages unaffected', async () => {
  const files = { ...base(), 'record/runs/2026-11-03.json': Object.assign(new Error('AccessDenied'), {}), 'world/latest.json': '{not json' };
  const { health } = await buildHealth(ports(files, { lambdaErrors: async () => { throw new Error('GetMetricData denied'); } }), NOW);
  const rec = cell(health, '2026-11-03', 'record');
  assert.equal(rec.status, 'nodata');
  assert.match(rec.error, /AccessDenied/);
  assert.equal(cell(health, '2026-11-03', 'agent').status, 'ok');
  assert.equal(cell(health, '2026-11-04', 'situations').status, 'nodata');
  assert.ok(cell(health, '2026-11-04', 'situations').error);
  const err = cell(health, '2026-11-03', 'errors');
  assert.equal(err.status, 'nodata');
  assert.match(err.error, /GetMetricData denied/);
  assert.deepEqual(err.facts, {});
});

test('errors and compare counts: thin from one error, failed from five; a DIFFER makes the day thin', async () => {
  const { health } = await buildHealth(ports(base(), { lambdaErrors: async () => ({ newsA: { '2026-11-01': 1, '2026-11-02': 5 }, newsB: { '2026-11-02': 1 } }) }), NOW);
  assert.equal(cell(health, '2026-11-01', 'errors').status, 'thin');
  assert.equal(cell(health, '2026-11-02', 'errors').status, 'failed');
  assert.deepEqual(cell(health, '2026-11-02', 'errors').facts.byFunction, { newsA: 5, newsB: 1 });
  assert.equal(cell(health, '2026-10-30', 'errors').status, 'ok');
  assert.equal(cell(health, '2026-11-03', 'compare').status, 'thin');
  assert.equal(cell(health, '2026-11-03', 'compare').facts.total, 1);
});

test('situations: age, stale, degraded and the open count', async () => {
  const at = async (over) => cell((await buildHealth(ports({ ...base(), 'world/latest.json': world(over) }), NOW)).health, '2026-11-04', 'situations');
  const ok = await at({});
  assert.equal(ok.status, 'ok');
  assert.equal(ok.facts.open, 2);
  assert.equal(ok.facts.ageHours, 0.3);
  assert.equal((await at({ stale: true })).status, 'thin');
  assert.equal((await at({ sources: { newsDegraded: true, gdacsDegraded: false } })).status, 'thin');
  assert.equal((await at({ generated_at: '2026-11-04T08:00:00Z' })).status, 'thin');
  assert.equal((await at({ generated_at: '2026-11-04T04:00:00Z' })).status, 'failed');
});

test('resolver: the heartbeat day gets the tick and the live status; due work with nothing settled is thin', async () => {
  let { health } = await buildHealth(ports(base()), NOW);
  const r = cell(health, '2026-11-04', 'resolver');
  assert.equal(r.status, 'ok');
  assert.equal(r.facts.settled, 4);
  assert.equal(r.facts.due, 11);
  assert.deepEqual(health.now.resolver, { sampled: 88, due: 11, drafted: 200, verdicts: 25, commits: 2, error: null });
  const idle = { ...base(), 'record/views/health/settle-tick.json': JSON.stringify({ at: '2026-11-04T10:30:00Z', settled: 0, errors: 0 }) };
  ({ health } = await buildHealth(ports(idle), NOW));
  assert.equal(cell(health, '2026-11-04', 'resolver').status, 'thin');
  const bad = { ...base(), 'record/views/health/settle-tick.json': JSON.stringify({ at: '2026-11-04T10:30:00Z', settled: 3, errors: 2 }) };
  assert.equal(cell((await buildHealth(ports(bad), NOW)).health, '2026-11-04', 'resolver').status, 'failed');
});

test('resolver and situations: a closed day keeps the row written for it; with none it says so', async () => {
  const first = (await buildHealth(ports(base()), Date.parse('2026-11-03T22:00:00Z'))).health;
  const tickToday = cell(first, '2026-11-03', 'resolver');
  assert.equal(tickToday.status, 'nodata'); // heartbeat is 11-04 in this fake: no tick that day yet
  const prev = JSON.parse(JSON.stringify(first));
  cell(prev, '2026-11-03', 'resolver').status = 'ok';
  cell(prev, '2026-11-03', 'situations').status = 'thin';
  const { health } = await buildHealth(ports(base()), NOW, prev);
  assert.equal(cell(health, '2026-11-03', 'resolver').status, 'ok');
  assert.equal(cell(health, '2026-11-03', 'situations').status, 'thin');
  const none = cell(health, '2026-11-01', 'situations');
  assert.equal(none.status, 'nodata');
  assert.match(none.note, /no snapshot/);
});

test('resolver status failure is named, not guessed', async () => {
  const files = base();
  delete files['record/views/health/settle-tick.json'];
  const { health } = await buildHealth(ports(files, { resolverStatus: async () => { throw new Error('invoke denied'); } }), NOW);
  assert.equal(cell(health, '2026-11-04', 'resolver').status, 'nodata');
  assert.equal(health.now.resolver.error, 'invoke denied');
});

test('briefs: the weekly brief is expected on Sundays only', async () => {
  const files = { ...base(), 'record/notes/daily_brief/2026-11-01.jsonl': lines(1), 'record/notes/daily_brief/2026-10-25.jsonl': lines(1), 'record/notes/weekly_brief/2026-10-25.jsonl': lines(1) };
  const { health } = await buildHealth(ports(files), NOW);
  assert.equal(cell(health, '2026-11-01', 'briefs').status, 'missing'); // Sunday, no weekly
  assert.deepEqual(cell(health, '2026-11-01', 'briefs').facts, { daily: true, weekly: false });
  assert.equal(cell(health, '2026-10-25', 'briefs').status, 'ok');
  assert.equal(cell(health, '2026-11-03', 'briefs').facts.weekly, null);
});

test('views: a day past the build is missing; a stale build is thin for today', async () => {
  const stale = { ...base(), 'record/views/manifest.json': JSON.stringify({ builtAt: '2026-11-04T01:00:00Z', factsThrough: '2026-11-02', provisionalThrough: '2026-11-03' }) };
  const { health } = await buildHealth(ports(stale), NOW);
  assert.equal(cell(health, '2026-11-03', 'views').status, 'ok');
  assert.equal(cell(health, '2026-11-04', 'views').status, 'missing');
  const lateToday = { ...base(), 'record/views/manifest.json': JSON.stringify({ builtAt: '2026-11-04T01:00:00Z', factsThrough: '2026-11-03', provisionalThrough: '2026-11-04' }) };
  assert.equal(cell((await buildHealth(ports(lateToday), NOW)).health, '2026-11-04', 'views').status, 'thin');
});

test('raw: the money panel gets run counts, country notes and the brief per day', async () => {
  const { raw } = await buildHealth(ports(base()), NOW);
  assert.deepEqual(raw['2026-11-03'], { counts: { entry: 30, forecast_drawn: 12 }, countryNotes: 3, dailyBrief: 1 });
  assert.deepEqual(raw['2026-10-24'], { counts: null, countryNotes: null, dailyBrief: 0 });
});

test('health.json matches its schema', async (t) => {
  let Ajv;
  try { Ajv = require(require.resolve('ajv', { paths: [path.resolve(__dirname, '../../../../global-perspectives-starter/frontend')] })); } catch { return t.skip('ajv is not installed (frontend npm ci)'); }
  const ajv = new Ajv({ allErrors: true, strict: false });
  try { require(require.resolve('ajv-formats', { paths: [path.resolve(__dirname, '../../../../global-perspectives-starter/frontend')] }))(ajv); } catch { /* formats optional */ }
  const validate = ajv.compile(require('../../../record/schema/health.schema.json'));
  const { health } = await buildHealth(ports(base()), NOW);
  assert.equal(validate(health), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...health, schemaVersion: 2 }), false);
  assert.equal(validate({ ...health, days: [{ date: 'x', closed: true, rows: [{ stage: 'a', status: 'great', facts: {}, source: 's', at: null, error: null, note: null }] }] }), false);
});
