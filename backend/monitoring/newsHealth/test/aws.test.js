'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { insights, parseUsageRows, parseDifferRows, parseErrorSeries, USAGE_QUERY } = require('../src/aws');
const { run } = require('../src/index');

const fields = (o) => Object.entries(o).map(([field, value]) => ({ field, value }));

test('the usage query reads the logged fields and groups by hour, fn, step and model', () => {
  for (const f of ['fn', 'step', 'model', 'prompt_tokens', 'completion_tokens', 'prompt_cache_hit_tokens']) assert.ok(USAGE_QUERY.includes(`"${f}"`), f);
  assert.match(USAGE_QUERY, /by bin\(1h\) as hr, fn, step, model/);
  // the regexes find the fields in a real [usage] line
  const line = '2026-11-04T10:50:29.166Z\tid\tINFO\t[usage] {"fn":"newsSituationIngest","step":"classify_batch","model":"deepseek-flash","prompt_tokens":1788,"completion_tokens":2424,"total_tokens":4212,"prompt_tokens_details":{"cached_tokens":256},"prompt_cache_hit_tokens":256,"prompt_cache_miss_tokens":1532}';
  assert.equal(/"prompt_tokens":(\d+)/.exec(line)[1], '1788');
  assert.equal(/"prompt_cache_hit_tokens":(\d+)/.exec(line)[1], '256');
  assert.equal(/"fn":"([^"]*)"/.exec(line)[1], 'newsSituationIngest');
});

test('parsers: usage rows, DIFFER rows by function, error series by day', () => {
  assert.deepEqual(parseUsageRows([{ hr: '2026-11-03 05:00:00.000', fn: 'newsAgent', step: 'summary', model: 'deepseek-flash', calls: '3', ptok: '100', ctok: '50', hitok: '' }, { hr: '2026-11-03 06:00:00.000' }]),
    [{ hourIso: '2026-11-03T05:00:00.000Z', fn: 'newsAgent', step: 'summary', model: 'deepseek-flash', calls: 3, promptTokens: 100, completionTokens: 50, cacheHitTokens: 0 }]);
  assert.deepEqual(parseDifferRows([{ day: '2026-11-03 00:00:00.000', '@log': '280362093938:/aws/lambda/newsAgent', n: '2' }, { day: '2026-11-03 00:00:00.000', '@log': '280362093938:/aws/lambda/newsAgent', n: '1' }]), { newsAgent: { '2026-11-03': 3 } });
  assert.deepEqual(parseErrorSeries([{ Label: 'newsA', Timestamps: ['2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'], Values: [0, 4] }]), { newsA: { '2026-11-02': 0, '2026-11-03': 4 } });
});

test('insights polls until Complete, drops @ptr, and splits more than 50 groups', async () => {
  const started = []; let polls = 0;
  const logs = {
    startQuery: async (q) => { started.push(q.logGroupNames.length); return { queryId: `q${started.length}` }; },
    getQueryResults: async () => (++polls % 2 ? { status: 'Running', results: [] } : { status: 'Complete', results: [fields({ a: '1', '@ptr': 'x' })] }),
  };
  const rows = await insights(logs, { groups: Array.from({ length: 51 }, (_, i) => `g${i}`), queryString: 'q', startMs: 0, endMs: 1000, wait: async () => {} });
  assert.deepEqual(started, [50, 1]);
  assert.deepEqual(rows, [{ a: '1' }, { a: '1' }]);
});

test('insights fails loudly on Failed and on a wait that runs out', async () => {
  const mk = (status) => ({ startQuery: async () => ({ queryId: 'q' }), getQueryResults: async () => ({ status, results: [] }) });
  await assert.rejects(insights(mk('Failed'), { groups: ['g'], queryString: 'q', startMs: 0, endMs: 1, wait: async () => {} }), /Failed/);
  await assert.rejects(insights(mk('Running'), { groups: ['g'], queryString: 'q', startMs: 0, endMs: 1, maxWaitMs: 3000, pollMs: 1000, wait: async () => {} }), /still Running after 3 s/);
  assert.deepEqual(await insights(mk('Complete'), { groups: [], queryString: 'q', startMs: 0, endMs: 1 }), []);
});

// The whole run on a fake world.
const NOW = Date.parse('2026-11-04T12:00:00Z');
function fakeAws(files, over = {}) {
  const puts = [];
  return {
    puts,
    readText: async (key) => { const v = files[key]; if (v instanceof Error) throw v; return v == null ? null : { text: v, at: null }; },
    putJson: async (key, obj, cc) => { puts.push([key, obj, cc]); },
    resolverStatus: async () => ({ sampled: 1, due: 0, drafted: 0, verdicts: 0, commits: [] }),
    lambdaErrors: async () => ({}),
    compareCounts: async () => ({}),
    usageRows: async () => [],
    costByService: async () => [{ day: '2026-11-03', service: 'S3', usd: 0.1 }],
    listKeys: async () => [],
    clientErrorRows: async () => [],
    auditLog: async () => null,
    ...over,
  };
}
const quiet = () => {};

test('run writes health.json and ops.json (no-cache), dry writes nothing', async () => {
  const aws = fakeAws({});
  const out = await run({ aws, now: NOW, log: quiet });
  assert.deepEqual(aws.puts.map((p) => [p[0], p[2]]), [['record/views/health.json', 'no-cache'], ['monitoring/ops.json', 'no-cache']]);
  assert.equal(out.ops.aws.yesterday.usd, 0.1);
  const dry = fakeAws({});
  await run({ aws: dry, now: NOW, dry: true, log: quiet });
  assert.equal(dry.puts.length, 0);
});

test('run: Cost Explorer is called once per UTC day, not every hour', async () => {
  let calls = 0;
  const aws = fakeAws({}, { costByService: async () => { calls += 1; return []; } });
  const first = await run({ aws, now: NOW, log: quiet });
  assert.equal(calls, 1);
  const aws2 = fakeAws({ 'monitoring/ops.json': JSON.stringify(first.ops) }, { costByService: async () => { calls += 1; return []; } });
  await run({ aws: aws2, now: NOW + 3600000, log: quiet });
  assert.equal(calls, 1);
  await run({ aws: aws2, now: NOW + 3600000, skipCost: true, log: quiet });
  assert.equal(calls, 1);
});

test('run: a source that fails is named in the files, the run still writes', async () => {
  const aws = fakeAws({}, { usageRows: async () => { throw new Error('query Failed'); }, costByService: async () => { throw new Error('ce denied'); } });
  const out = await run({ aws, now: NOW, log: quiet });
  assert.equal(out.ops.deepseek.error, 'query Failed');
  assert.equal(out.ops.aws.error, 'ce denied');
  assert.equal(aws.puts.length, 2);
});

test('run: an earlier file that cannot be read is not overwritten (its history would be lost), and the run fails', async () => {
  const aws = fakeAws({ 'monitoring/ops.json': new Error('AccessDenied') });
  await assert.rejects(run({ aws, now: NOW, log: quiet }), /monitoring\/ops\.json not written/);
  assert.deepEqual(aws.puts.map((p) => p[0]), ['record/views/health.json']);
});
