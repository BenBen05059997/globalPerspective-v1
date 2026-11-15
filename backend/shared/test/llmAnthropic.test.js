'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { chat, buildRequest, resolveProvider } = require('../src/llm');

const ANTHROPIC_KEY = 'sk-ant-TEST-KEY-123';
const DEEPSEEK_KEY = 'sk-deepseek-TEST-KEY-456';
const ENV = ['GROK_API_URL', 'XAI_API_KEY', 'ANTHROPIC_API_KEY', 'AWS_LAMBDA_FUNCTION_NAME'].map((k) => [k, process.env[k]]);
test.beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = ANTHROPIC_KEY;
  process.env.XAI_API_KEY = DEEPSEEK_KEY;
  delete process.env.GROK_API_URL;
});
test.afterEach(() => { for (const [k, v] of ENV) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

function stubFetch(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status || 200 });
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
  body: {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
    content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 4 }, ...extra,
  },
});

test('resolveProvider: known prefix wins and is stripped; bare model and unknown prefixes are untouched', () => {
  assert.deepEqual(resolveProvider({ model: 'anthropic:claude-haiku-5-5' }), { provider: 'anthropic', model: 'claude-haiku-5-5' });
  assert.deepEqual(resolveProvider({ provider: 'openrouter', model: 'anthropic:claude-haiku-5-5' }), { provider: 'anthropic', model: 'claude-haiku-5-5' });
  assert.deepEqual(resolveProvider({ model: 'deepseek:deepseek-flash' }), { provider: 'deepseek', model: 'deepseek-flash' });
  assert.deepEqual(resolveProvider({ model: 'deepseek-flash' }), { provider: 'deepseek', model: 'deepseek-flash' });
  assert.deepEqual(resolveProvider({ provider: 'openrouter', model: 'x/y:free' }), { provider: 'openrouter', model: 'x/y:free' });
  assert.deepEqual(resolveProvider({ provider: 'gemini', model: 'gemini-2.5-flash' }), { provider: 'gemini', model: 'gemini-2.5-flash' });
  assert.deepEqual(resolveProvider({ model: 'nope:thing' }), { provider: 'deepseek', model: 'nope:thing' });
  assert.deepEqual(resolveProvider({}), { provider: 'deepseek', model: undefined });
});

test('a bare model builds the same DeepSeek request as before; an anthropic: model never uses the DeepSeek url or key', () => {
  process.env.GROK_API_URL = 'https://api.deepseek.com';
  const d = buildRequest({ model: 'deepseek-flash', user: 'u', maxTokens: 5 });
  assert.equal(d.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(d.headers.Authorization, `Bearer ${DEEPSEEK_KEY}`);
  const a = buildRequest({ model: 'anthropic:claude-haiku-5-5', user: 'u', maxTokens: 5, url: 'https://api.deepseek.com' });
  assert.equal(a.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(JSON.stringify(a.headers).includes(DEEPSEEK_KEY), false);
  assert.equal(JSON.stringify(a.body).includes(DEEPSEEK_KEY), false);
  assert.equal(JSON.stringify(d.headers).includes(ANTHROPIC_KEY), false);
});

test('anthropic request: headers, top-level system, no sampling params, thinking off, model prefix stripped', () => {
  const r = buildRequest({
    model: 'anthropic:claude-haiku-5-5', system: 'Be brief.', user: 'Hello', maxTokens: 300, temperature: 0.2, topP: 0.9,
  });
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(r.headers, { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2026-10-21' });
  assert.deepEqual(r.body, {
    model: 'claude-haiku-5-5', max_tokens: 300, system: 'Be brief.', messages: [{ role: 'user', content: 'Hello' }], thinking: { type: 'disabled' },
  });
  for (const k of ['temperature', 'top_p', 'top_k', 'response_format']) assert.equal(k in r.body, false);
});

test('anthropic request: no system -> no system field; max_tokens defaults to 4096; thinking:true sends no thinking field', () => {
  const r = buildRequest({ model: 'anthropic:claude-haiku-5-5', user: 'U', thinking: true });
  assert.deepEqual(r.body, { model: 'claude-haiku-5-5', max_tokens: 4096, messages: [{ role: 'user', content: 'U' }] });
});

test('anthropic request: Sonnet 5.5 turns thinking off with between_tools, never disabled', () => {
  const r = buildRequest({ model: 'anthropic:claude-sonnet-5-5', user: 'U', maxTokens: 10 });
  assert.deepEqual(r.body.thinking, { type: 'between_tools' });
});

test('anthropic request: system-role messages move to the top-level system field', () => {
  const r = buildRequest({
    model: 'anthropic:claude-haiku-5-5',
    messages: [{ role: 'system', content: 'S1' }, { role: 'user', content: 'U1' }, { role: 'assistant', content: 'A1' }, { role: 'user', content: 'U2' }],
    system: 'ignored when messages are given', maxTokens: 9,
  });
  assert.equal(r.body.system, 'S1');
  assert.deepEqual(r.body.messages, [{ role: 'user', content: 'U1' }, { role: 'assistant', content: 'A1' }, { role: 'user', content: 'U2' }]);
});

test('anthropic json:true asks for JSON in the system text, after the caller system text, and sends no response_format', () => {
  const sentence = 'Reply with a single JSON value only: no code fences and no commentary before or after it.';
  const withSystem = buildRequest({ model: 'anthropic:claude-haiku-5-5', system: 'You are X.', user: 'U', json: true, maxTokens: 9 });
  assert.equal(withSystem.body.system, `You are X.\n\n${sentence}`);
  const without = buildRequest({ model: 'anthropic:claude-haiku-5-5', user: 'U', json: true, maxTokens: 9 });
  assert.equal(without.body.system, sentence);
  assert.equal('response_format' in without.body, false);
});

test('anthropic without a key throws a clear error that holds no key value', () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.throws(() => buildRequest({ model: 'anthropic:claude-haiku-5-5', user: 'u' }), (e) => /ANTHROPIC_API_KEY is not set/.test(e.message) && !e.message.includes(DEEPSEEK_KEY));
});

test('anthropic response: text blocks only (thinking blocks skipped), usage mapped to the [usage] names, stop -> stop', async (t) => {
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'fnA';
  const logs = captureLogs(t);
  const calls = stubFetch(t, [reply('x', {
    content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'Hello, ' }, { type: 'text', text: 'world' }],
    usage: { input_tokens: 100, output_tokens: 7, cache_read_input_tokens: 40, cache_creation_input_tokens: 0 },
  })]);
  const r = await chat({ step: 'unit', model: 'anthropic:claude-haiku-5-5', user: 'hi', maxTokens: 50 });
  assert.equal(r.content, 'Hello, world');
  assert.equal(r.model, 'claude-haiku-5-5');
  assert.equal(r.finishReason, 'stop');
  assert.deepEqual(r.usage, { prompt_tokens: 140, completion_tokens: 7, prompt_cache_hit_tokens: 40 });
  assert.equal(r.raw.id, 'msg_1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(logs, ['[usage] {"fn":"fnA","step":"unit","model":"claude-haiku-5-5","prompt_tokens":140,"completion_tokens":7,"prompt_cache_hit_tokens":40}']);
});

test('anthropic response: usage without cache fields has no prompt_cache_hit_tokens', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('ok')]);
  const r = await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', maxTokens: 5 });
  assert.deepEqual(r.usage, { prompt_tokens: 10, completion_tokens: 4 });
});

test('anthropic stop_reason max_tokens -> finishReason length, content kept (callers salvage truncated output)', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('{"topics":[{"a":1},{"b":', { stop_reason: 'max_tokens' })]);
  const r = await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', maxTokens: 5, json: true });
  assert.equal(r.finishReason, 'length');
  assert.equal(r.content, '{"topics":[{"a":1},{"b":');
});

test('anthropic stop_reason stop_sequence -> stop; other reasons pass through', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('a', { stop_reason: 'stop_sequence' }), reply('b', { stop_reason: 'pause_turn' })]);
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u' })).finishReason, 'stop');
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u' })).finishReason, 'pause_turn');
});

test('anthropic stop_reason refusal throws a clear error and logs no usage', async (t) => {
  const logs = captureLogs(t);
  stubFetch(t, [reply('', { stop_reason: 'refusal', content: [], stop_details: { category: 'general_harms' } })]);
  await assert.rejects(
    chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u' }),
    (e) => e.message === 'LLM refusal (general_harms): the model declined this request' && e.stopReason === 'refusal',
  );
  assert.equal(logs.length, 0);
});

test('anthropic json:true: clean JSON and fenced JSON come back as the model wrote them', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('{"a":1}'), reply('```json\n{"a":1}\n```')]);
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true })).content, '{"a":1}');
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true })).content, '```json\n{"a":1}\n```');
});

test('anthropic json:true: prose around the JSON is cut off in the helper, so callers still parse', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('Here is the result:\n{"a":[1,2],"b":"x"}\nHope that helps.'), reply('Sure! [1,2,3]'), reply('no json at all')]);
  const { parseJsonContent } = require('../src/llm');
  const a = await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true });
  assert.deepEqual(parseJsonContent(a.content), { a: [1, 2], b: 'x' });
  assert.deepEqual(JSON.parse((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true })).content), [1, 2, 3]);
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', json: true })).content, 'no json at all');
});

test('anthropic without json:true leaves the text alone', async (t) => {
  captureLogs(t);
  stubFetch(t, [reply('Here: {"a":1} done')]);
  assert.equal((await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u' })).content, 'Here: {"a":1} done');
});

test('anthropic errors: 4xx throws LLM <status>: <message> with e.status, no retry, and no key in the message', async (t) => {
  const logs = captureLogs(t);
  const calls = stubFetch(t, [{ status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: required' } } }]);
  await assert.rejects(chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u' }), (e) => e.message === 'LLM 400: max_tokens: required' && e.status === 400 && !e.message.includes(ANTHROPIC_KEY));
  assert.equal(calls.length, 1);
  assert.equal(logs.join('\n').includes(ANTHROPIC_KEY), false);
});

test('anthropic errors: 429, 500 and 529 retry; 401 does not', async (t) => {
  const logs = captureLogs(t);
  t.mock.method(globalThis, 'setTimeout', (fn) => { fn(); return 0; });
  const calls = stubFetch(t, [
    { status: 529, body: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } },
    { status: 429, body: {} }, { status: 500, body: 'x' }, reply('fine'),
  ]);
  const r = await chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', retries: 3 });
  assert.equal(r.content, 'fine');
  assert.equal(calls.length, 4);
  const calls2 = stubFetch(t, [{ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }]);
  await assert.rejects(chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', retries: 3 }), (e) => e.status === 401);
  assert.equal(calls2.length, 1);
  assert.equal(logs.join('\n').includes(ANTHROPIC_KEY), false);
});

test('anthropic timeout: "LLM timeout after Nms"; the usage log of a call never holds a key', async (t) => {
  const logs = captureLogs(t);
  t.mock.method(globalThis, 'fetch', async () => { const e = new Error('aborted'); e.name = 'TimeoutError'; throw e; });
  await assert.rejects(chat({ step: 's', model: 'anthropic:claude-haiku-5-5', user: 'u', timeoutMs: 1000, retries: 0 }), /LLM timeout after 1000ms/);
  assert.equal(logs.join('\n').includes(ANTHROPIC_KEY), false);
});

test('a DeepSeek call is unchanged by the Anthropic path: OpenAI body, bearer key, usage as returned', async (t) => {
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'fnD';
  const logs = captureLogs(t);
  const calls = stubFetch(t, [{ body: { model: 'deepseek-flash', choices: [{ message: { content: 'hi' }, finish_reason: 'length' }], usage: { prompt_tokens: 3, completion_tokens: 2, prompt_cache_hit_tokens: 1 } } }]);
  const r = await chat({ step: 'd', model: 'deepseek-flash', user: 'u', maxTokens: 5, json: true });
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${DEEPSEEK_KEY}`);
  assert.equal('x-api-key' in calls[0].init.headers, false);
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.equal(r.finishReason, 'length');
  assert.equal(r.content, 'hi');
  assert.deepEqual(logs, ['[usage] {"fn":"fnD","step":"d","model":"deepseek-flash","prompt_tokens":3,"completion_tokens":2,"prompt_cache_hit_tokens":1}']);
});

test('a deepseek: prefix is stripped from the request and the usage log', async (t) => {
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'fnP';
  const logs = captureLogs(t);
  const calls = stubFetch(t, [{ body: { choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } } }]);
  const r = await chat({ step: 'p', model: 'deepseek:deepseek-flash', user: 'u' });
  assert.equal(calls[0].body.model, 'deepseek-flash');
  assert.equal(r.model, 'deepseek-flash');
  assert.ok(logs[0].includes('"model":"deepseek-flash"'));
});

test('jsonText: clean JSON equals stripCodeFence; fenced, prose before/after and arrays give the JSON; truncated or non-JSON comes back fence-stripped as is', () => {
  const { jsonText, stripCodeFence } = require('../src/llm');
  for (const s of ['{"a":1}', '  {"a":1}\n', '```json\n{"a":1}\n```', '```\n{"a":[1,]}\n```', '']) assert.equal(jsonText(s), stripCodeFence(s));
  assert.equal(jsonText('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(jsonText('Here you go:\n{"a":{"b":2}}\nDone.'), '{"a":{"b":2}}');
  assert.equal(jsonText('Sure:\n```json\n{"a":1}\n```\nHope it helps'), '{"a":1}');
  assert.equal(jsonText('Result [1,2,3] ok'), '[1,2,3]');
  assert.equal(jsonText('{"topics":[{"a":1},{"b":'), '{"topics":[{"a":1},{"b":');
  assert.equal(jsonText('```json\n{"a":1,\n```'), '{"a":1,');
  assert.equal(jsonText('no json'), 'no json');
});
