// Run: node --test backend/monitoring/newsModelGuard/test/
// The @aws-sdk/* packages are provided by the Lambda Node 20 runtime, not the repo, so they are stubbed here.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@aws-sdk/client-lambda') {
    return { LambdaClient: class { async send() { return { Functions: [] }; } }, ListFunctionsCommand: class {} };
  }
  if (request === '@aws-sdk/client-sns') {
    return { SNSClient: class { async send() {} }, PublishCommand: class {} };
  }
  return origLoad.call(this, request, ...rest);
};
process.env.DEEPSEEK_API_KEY = 'test-key-not-real';
process.env.SNS_TOPIC_ARN = 'arn:test';
const { checkDeepSeekBalance } = require(path.join(__dirname, '..', 'src', 'index.js'));
Module._load = origLoad;

const quiet = () => { console.warn = () => {}; console.log = () => {}; };
beforeEach(() => { quiet(); });

function balanceFetch(body, ok = true, status = 200) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok, status, json: async () => body };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}
function recorder() {
  const published = [];
  return { published, publish: async (m) => { published.push(m); } };
}
const usd = (total, available = true) => ({
  is_available: available,
  balance_infos: [{ currency: 'USD', total_balance: total, granted_balance: '0.00', topped_up_balance: total }],
});

test('below threshold publishes exactly one alert with balance and days', async () => {
  const rec = recorder();
  const f = balanceFetch(usd('2.50'));
  const r = await checkDeepSeekBalance({ fetchImpl: f, publish: rec.publish });
  assert.equal(rec.published.length, 1);
  assert.equal(rec.published[0].subject, 'DeepSeek balance low: $2.50');
  assert.match(rec.published[0].message, /~6 days/);
  assert.equal(r.alerted, true);
  assert.equal(f.calls[0].url, 'https://api.deepseek.com/user/balance');
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer test-key-not-real');
});

test('above threshold publishes nothing', async () => {
  const rec = recorder();
  const r = await checkDeepSeekBalance({ fetchImpl: balanceFetch(usd('12.00')), publish: rec.publish });
  assert.equal(rec.published.length, 0);
  assert.equal(r.alerted, false);
});

test('is_available false publishes even with a healthy USD balance', async () => {
  const rec = recorder();
  await checkDeepSeekBalance({ fetchImpl: balanceFetch(usd('50.00', false)), publish: rec.publish });
  assert.equal(rec.published.length, 1);
  assert.match(rec.published[0].subject, /is_available=false/);
});

test('fetch error publishes nothing and does not throw', async () => {
  const rec = recorder();
  const boom = async () => { throw new Error('network down'); };
  const r = await checkDeepSeekBalance({ fetchImpl: boom, publish: rec.publish });
  assert.equal(rec.published.length, 0);
  assert.equal(r, null);
  const r2 = await checkDeepSeekBalance({ fetchImpl: balanceFetch({}, false, 500), publish: rec.publish });
  assert.equal(rec.published.length, 0);
  assert.equal(r2, null);
});
