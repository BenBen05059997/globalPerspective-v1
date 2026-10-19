'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { chat, buildRequest, stripCodeFence, parseJsonContent } = require('../src/llm');

const ENV = { GROK_API_URL: process.env.GROK_API_URL, XAI_API_KEY: process.env.XAI_API_KEY, OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY };
test.afterEach(() => { for (const [k, v] of Object.entries(ENV)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

// Stub fetch with a queue of responses ({status, body} or an Error to throw); records every request.
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
const ok = (content, extra = {}) => ({ body: { model: 'deepseek-flash', choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 }, ...extra } });
function captureLogs(t) {
  const lines = [];
  t.mock.method(console, 'log', (...a) => lines.push(a.join(' ')));
  t.mock.method(console, 'warn', () => {});
  return lines;
}

test('deepseek body: thinking off by default, only the params given, JSON mode on request', () => {
  process.env.XAI_API_KEY = 'k';
  process.env.GROK_API_URL = 'https://api.deepseek.com/chat/completions';
  const r = buildRequest({ model: 'deepseek-flash', user: 'Return JSON', maxTokens: 6000, temperature: 0.2, topP: 0.9, json: true });
  assert.equal(r.url, 'https://api.deepseek.com/chat/completions');
  assert.deepEqual(r.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer k' });
  assert.deepEqual(r.body, {
    model: 'deepseek-flash', messages: [{ role: 'user', content: 'Return JSON' }],
    max_tokens: 6000, temperature: 0.2, top_p: 0.9, response_format: { type: 'json_object' }, thinking: { type: 'disabled' },
  });
  for (const k of ['generationConfig', 'thinking_budget', 'reasoning_effort', 'extra_body']) assert.equal(k in r.body, false);
});

test('system + user messages; omitted params are not sent; thinking:true sends nothing', () => {
  const r = buildRequest({ model: 'm', system: 'S', user: 'U', thinking: true, url: 'https://x' });
  assert.deepEqual(r.body, { model: 'm', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }] });
});

test('messages overrides system/user', () => {
  const messages = [{ role: 'system', content: 'a' }, { role: 'user', content: 'b' }];
  assert.deepEqual(buildRequest({ model: 'm', messages, user: 'ignored', url: 'https://x' }).body.messages, messages);
});

test('url: base or full, trailing slash, default DeepSeek (never x.ai)', () => {
  delete process.env.GROK_API_URL;
  assert.equal(buildRequest({ model: 'm', user: 'u' }).url, 'https://api.deepseek.com/chat/completions');
  for (const u of ['https://api.deepseek.com', 'https://api.deepseek.com/', 'https://api.deepseek.com/chat/completions']) {
    process.env.GROK_API_URL = u;
    assert.equal(buildRequest({ model: 'm', user: 'u' }).url, 'https://api.deepseek.com/chat/completions');
  }
  assert.equal(buildRequest({ model: 'm', user: 'u', url: 'https://g.example/v1beta/openai/' }).url, 'https://g.example/v1beta/openai/chat/completions');
});

test('openrouter: fixed URL, OPENROUTER_API_KEY, no thinking field', () => {
  process.env.OPENROUTER_API_KEY = 'or';
  const r = buildRequest({ provider: 'openrouter', model: 'x/y:free', user: 'u', maxTokens: 400, temperature: 0.7 });
  assert.equal(r.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(r.headers.Authorization, 'Bearer or');
  assert.deepEqual(r.body, { model: 'x/y:free', messages: [{ role: 'user', content: 'u' }], max_tokens: 400, temperature: 0.7 });
});

test('gemini: thinking off is thinking_budget 0 in extra_body, never reasoning_effort', () => {
  const r = buildRequest({ provider: 'gemini', url: 'https://g/v1beta/openai', apiKey: 'g', model: 'gemini-2.5-flash', user: 'u', json: true });
  assert.deepEqual(r.body.extra_body, { google: { thinking_config: { thinking_budget: 0 } } });
  assert.equal('thinking' in r.body, false);
  assert.equal('reasoning_effort' in r.body, false);
  assert.throws(() => buildRequest({ provider: 'gemini', model: 'm', user: 'u' }), /no url/);
});

test('extraBody is merged last; unknown provider throws', () => {
  assert.equal(buildRequest({ model: 'm', user: 'u', url: 'https://x', extraBody: { seed: 1 } }).body.seed, 1);
  assert.throws(() => buildRequest({ provider: 'nope', model: 'm', user: 'u' }), /unknown provider/);
});

test('chat: returns raw content + model + usage and logs one [usage] line', async (t) => {
  process.env.XAI_API_KEY = 'k';
  process.env.AWS_LAMBDA_FUNCTION_NAME = 'fnX';
  const logs = captureLogs(t);
  const calls = stubFetch(t, [ok('```json\n{"a":1}\n```')]);
  const r = await chat({ step: 'unit', model: 'deepseek-flash', user: 'hi', maxTokens: 10 });
  assert.equal(r.content, '```json\n{"a":1}\n```');
  assert.equal(r.model, 'deepseek-flash');
  assert.equal(r.finishReason, 'stop');
  assert.deepEqual(r.usage, { prompt_tokens: 3, completion_tokens: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(logs, ['[usage] {"fn":"fnX","step":"unit","model":"deepseek-flash","prompt_tokens":3,"completion_tokens":2}']);
});

test('chat: array content parts are joined; missing content is empty string', async (t) => {
  captureLogs(t);
  stubFetch(t, [ok([{ type: 'text', text: 'a' }, 'b']), { body: { choices: [{ message: {} }] } }]);
  assert.equal((await chat({ step: 's', model: 'm', user: 'u', url: 'https://x' })).content, 'ab');
  const r = await chat({ step: 's', model: 'm', user: 'u', url: 'https://x' });
  assert.equal(r.content, '');
  assert.equal(r.model, 'm');
});

test('chat: 4xx throws with the provider message, no retry', async (t) => {
  captureLogs(t);
  const calls = stubFetch(t, [{ status: 400, body: { error: { message: 'bad model' } } }]);
  await assert.rejects(chat({ step: 's', model: 'm', user: 'u', url: 'https://x' }), (e) => e.message === 'LLM 400: bad model' && e.status === 400);
  assert.equal(calls.length, 1);
});

test('chat: 5xx / 429 / network errors retry (transport only), then succeed', async (t) => {
  const logs = captureLogs(t);
  t.mock.method(globalThis, 'setTimeout', (fn) => { fn(); return 0; });
  const calls = stubFetch(t, [{ status: 503, body: 'down' }, new TypeError('fetch failed'), { status: 429, body: {} }, ok('fine')]);
  const r = await chat({ step: 's', model: 'm', user: 'u', url: 'https://x', retries: 3 });
  assert.equal(r.content, 'fine');
  assert.equal(calls.length, 4);
  assert.equal(logs.filter((l) => l.startsWith('[usage]')).length, 1);
});

test('chat: retries exhausted -> last error; retries:0 -> no retry', async (t) => {
  captureLogs(t);
  t.mock.method(globalThis, 'setTimeout', (fn) => { fn(); return 0; });
  stubFetch(t, [{ status: 500, body: 'x' }, { status: 502, body: 'gateway' }]);
  await assert.rejects(chat({ step: 's', model: 'm', user: 'u', url: 'https://x' }), /LLM 502: gateway/);
  const calls = stubFetch(t, [{ status: 500, body: 'x' }]);
  await assert.rejects(chat({ step: 's', model: 'm', user: 'u', url: 'https://x', retries: 0 }), /LLM 500/);
  assert.equal(calls.length, 1);
});

test('chat: timeout becomes "LLM timeout after Nms"', async (t) => {
  captureLogs(t);
  t.mock.method(globalThis, 'fetch', async () => { const e = new Error('aborted'); e.name = 'TimeoutError'; throw e; });
  await assert.rejects(chat({ step: 's', model: 'm', user: 'u', url: 'https://x', timeoutMs: 20000, retries: 0 }), /LLM timeout after 20000ms/);
});

test('chat: step is required; non-JSON 200 throws', async (t) => {
  captureLogs(t);
  await assert.rejects(chat({ model: 'm', user: 'u', url: 'https://x' }), /step is required/);
  stubFetch(t, [{ body: 'not json' }]);
  await assert.rejects(chat({ step: 's', model: 'm', user: 'u', url: 'https://x' }), /non-JSON/);
});

test('stripCodeFence: both fence forms, trailing commas only on request, non-strings pass through', () => {
  assert.equal(stripCodeFence('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(stripCodeFence('```\n{"a":[1,]}\n```'), '{"a":[1,]}');
  assert.equal(stripCodeFence('{"a":[1,],}', { trailingCommas: true }), '{"a":[1]}');
  assert.equal(stripCodeFence(null), null);
});

test('parseJsonContent: fences stripped, empty -> {}, bad JSON throws', () => {
  assert.deepEqual(parseJsonContent('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonContent(''), {});
  assert.throws(() => parseJsonContent('nope'));
});
