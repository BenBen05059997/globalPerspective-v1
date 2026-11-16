'use strict';
// One retry on unparseable JSON, Anthropic only (llm.js chat()).
const test = require('node:test');
const assert = require('node:assert');
const { chat } = require('../src/llm');

const ENV = ['GROK_API_URL', 'XAI_API_KEY', 'ANTHROPIC_API_KEY'].map((k) => [k, process.env[k]]);
test.beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-TEST';
  process.env.XAI_API_KEY = 'sk-ds-TEST';
  delete process.env.GROK_API_URL;
});
test.afterEach(() => { for (const [k, v] of ENV) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

function stubFetch(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ body: JSON.parse(init.body) });
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  });
  return calls;
}
function captureLogs(t) {
  const lines = [];
  t.mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
  t.mock.method(console, 'warn', (...a) => lines.push(a.join(' ')));
  return lines;
}
const reply = (text, extra = {}) => ({
  type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 4 }, ...extra,
});
const usageLines = (logs) => logs.filter((l) => l.startsWith('[usage]')).length;
const ask = (o = {}) => chat({ step: 'j', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true, ...o });

test('parses first time (prose around it counts) -> one request, one usage line', async (t) => {
  const logs = captureLogs(t);
  const calls = stubFetch(t, [reply('Here:\n{"a":1}\nDone')]);
  assert.equal((await ask()).content, '{"a":1}');
  assert.equal(calls.length, 1);
  assert.equal(usageLines(logs), 1);
});

test('broken then good -> two identical requests, two usage lines, a warn, second returned', async (t) => {
  const logs = captureLogs(t);
  const calls = stubFetch(t, [reply('{"a":[1,2}'), reply('{"a":[1,2]}')]);
  assert.equal((await ask()).content, '{"a":[1,2]}');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(usageLines(logs), 2);
  assert.ok(logs.includes('[llm] j: unparseable JSON; retry'));
});

test('broken twice -> the second answer is returned, no third request', async (t) => {
  captureLogs(t);
  const calls = stubFetch(t, [reply('{"a":'), reply('{"b" 2}'), reply('{"c":3}')]);
  assert.equal((await ask()).content, '{"b" 2}');
  assert.equal(calls.length, 2);
});

test('a cut-off (length) answer is returned as is, no retry', async (t) => {
  captureLogs(t);
  const calls = stubFetch(t, [reply('{"a":[1,', { stop_reason: 'max_tokens' }), reply('{"a":1}')]);
  const r = await ask();
  assert.equal(r.content, '{"a":[1,');
  assert.equal(r.finishReason, 'length');
  assert.equal(calls.length, 1);
});

test('without json:true there is no retry', async (t) => {
  captureLogs(t);
  const calls = stubFetch(t, [reply('not json')]);
  assert.equal((await ask({ json: false })).content, 'not json');
  assert.equal(calls.length, 1);
});

test('DeepSeek with broken JSON is never retried', async (t) => {
  captureLogs(t);
  const calls = stubFetch(t, [{ choices: [{ message: { content: '{"a":' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }]);
  assert.equal((await chat({ step: 'd', model: 'deepseek-flash', user: 'u', json: true })).content, '{"a":');
  assert.equal(calls.length, 1);
});
