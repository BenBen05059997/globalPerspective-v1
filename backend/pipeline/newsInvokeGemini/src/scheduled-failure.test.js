const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// A failed model call on a scheduled run must reject (Lambda Errors metric, no "processed" day),
// while a direct HTTP invocation keeps its 5xx response shape. AWS SDK modules are stubbed (not installed locally).
function loadHandler(env, fetchImpl) {
  const file = require.resolve('./index.js');
  const real = createRequire(file);
  const cmd = class { constructor(i) { this.input = i; } };
  const stub = (n) => (n === '@aws-sdk/lib-dynamodb'
    ? new Proxy({ DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) } }, { get: (t, k) => (k in t ? t[k] : cmd) })
    : new Proxy({}, { get: () => cmd }));
  const context = {
    exports: {}, process: { env }, console: { log() {}, warn() {}, error() {} }, Date, setTimeout, clearTimeout,
    URL, AbortController, TextDecoder, fetch: fetchImpl,
    require: (n) => (n.startsWith('@aws-sdk/') ? stub(n) : real(n)),
  };
  context.module = { exports: context.exports };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return context.exports.handler;
}
const down = async () => { throw new Error('upstream down'); };
const scheduled = { source: 'aws.events', 'detail-type': 'Scheduled Event' };

test('scheduled event with a failing model call rejects instead of returning status:error', async () => {
  const handler = loadHandler({ XAI_API_KEY: 'k', GROK_API_URL: 'http://127.0.0.1:1' }, down);
  await assert.rejects(handler(scheduled));
});

test('missing API key on a scheduled event rejects', async () => {
  await assert.rejects(loadHandler({}, down)(scheduled), /XAI_API_KEY/);
});

test('direct HTTP invocation keeps the 5xx response', async () => {
  const r = await loadHandler({}, down)({ queryStringParameters: {} });
  assert.equal(r.statusCode, 500);
});
