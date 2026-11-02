'use strict';
// newsClientErrors: the public, unauthenticated sink for uncaught frontend errors. The size cap, the field clamps and the fingerprint (identical
// errors collapse into one counter row) are the only abuse protection, so they are what these tests pin. Offline: the AWS SDK is replaced by a
// fake DynamoDB client that records every command. The Function-URL CORS config owns CORS (see monitoring/alarms/client-errors-cors.test.mjs),
// so no response may carry an Access-Control-* header.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = { CLIENT_ERRORS_TABLE: 'ErrT', ERROR_TTL_DAYS: undefined };

let aws; let sent; let respond;
// Load the handler fresh. Every DynamoDB command is logged in `sent` as { name, input }; `respond` answers it (throw to fail the write).
function load(env = ENV) {
  if (aws) aws.restore();
  sent = [];
  respond = () => ({});
  aws = stubAws({ ddb: (input, name) => { sent.push({ name, input }); return respond(name, input); } });
  return aws.load(INDEX, { CLIENT_ERRORS_TABLE: undefined, ERROR_TTL_DAYS: undefined, ...env }).handler;
}

test.beforeEach(() => { for (const m of ['info', 'warn', 'error']) test.mock.method(console, m, () => {}); });
test.afterEach(() => { test.mock.restoreAll(); if (aws) { aws.restore(); aws = null; } });

const post = (h, body, extra = {}) => h({ requestContext: { http: { method: 'POST' } }, body: typeof body === 'string' ? body : JSON.stringify(body), ...extra });
const json = (res) => JSON.parse(res.body);
const noCors = (res) => assert.deepEqual(Object.keys(res.headers).filter((h) => /^access-control-/i.test(h)), [], 'no Access-Control-* header');
const stackOf = (line, col) => `Error: boom\n    at render (https://globalperspective.net/assets/index-abc123.js:${line}:${col})\n    at other (x.js:1:1)`;

test('a valid report is stored with one UpdateItem and answered 202 {ok:true}', async () => {
  const h = load();
  const res = await post(h, { message: 'Cannot read properties of undefined', stack: stackOf(10, 5), url: 'https://globalperspective.net/today', userAgent: 'UA/1', kind: 'unhandledrejection' });
  assert.equal(res.statusCode, 202);
  assert.deepEqual(json(res), { ok: true });
  assert.equal(res.headers['Content-Type'], 'application/json');
  noCors(res);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, 'UpdateCommand');
  const { input } = sent[0];
  const v = input.ExpressionAttributeValues;
  assert.equal(input.TableName, 'ErrT');
  assert.match(input.Key.errKey, /^\d{4}-\d{2}-\d{2}#[0-9a-f]{16}$/);
  assert.equal(input.Key.errKey, `${v[':day']}#${v[':hash']}`);
  assert.equal(v[':day'], new Date().toISOString().slice(0, 10));
  assert.deepEqual([v[':msg'], v[':stack'], v[':url'], v[':ua'], v[':kind'], v[':one']],
    ['Cannot read properties of undefined', stackOf(10, 5), 'https://globalperspective.net/today', 'UA/1', 'unhandledrejection', 1]);
  assert.equal(new Date(v[':now']).toISOString(), v[':now']);
  // A repeat is a counter bump, the first sighting keeps its stack/url/ua/firstSeen, the newest message/lastSeen win.
  const expr = input.UpdateExpression;
  assert.match(expr, /ADD #count :one$/);
  for (const field of ['firstSeen', 'sampleStack', 'sampleUrl', 'sampleUa']) assert.match(expr, new RegExp(`${field} = if_not_exists\\(${field}, :`));
  assert.match(expr, /lastSeen = :now/);
  assert.deepEqual(input.ExpressionAttributeNames, { '#day': 'day', '#hash': 'hashId', '#kind': 'kind', '#msg': 'message', '#count': 'count', '#ttl': 'ttl' });
});

test('every row gets a 30-day TTL by default, and ERROR_TTL_DAYS overrides it', async () => {
  const before = Math.floor(Date.now() / 1000);
  let h = load();
  await post(h, { message: 'm' });
  const t30 = sent[0].input.ExpressionAttributeValues[':ttl'];
  assert.ok(t30 >= before + 30 * 86400 && t30 <= before + 30 * 86400 + 5, String(t30 - before));
  h = load({ ...ENV, ERROR_TTL_DAYS: '7' });
  await post(h, { message: 'm' });
  const t7 = sent[0].input.ExpressionAttributeValues[':ttl'];
  assert.ok(t7 >= before + 7 * 86400 && t7 <= before + 7 * 86400 + 5, String(t7 - before));
});

test('any method but POST is refused with 405 and nothing is written (OPTIONS is the only other answer)', async () => {
  const h = load();
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
    const res = await h({ requestContext: { http: { method } }, body: JSON.stringify({ message: 'm' }) });
    assert.equal(res.statusCode, 405, method);
    assert.deepEqual(json(res), { ok: false, error: 'Method not allowed' });
    noCors(res);
  }
  const legacy = await h({ httpMethod: 'GET' });
  assert.equal(legacy.statusCode, 405);
  assert.equal((await h({})).statusCode, 405); // no method at all
  assert.deepEqual(sent, []);
});

test('OPTIONS is answered 200 with an empty body and no Access-Control-* header', async () => {
  const h = load();
  for (const event of [{ requestContext: { http: { method: 'OPTIONS' } } }, { httpMethod: 'OPTIONS' }]) {
    const res = await h(event);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '');
    noCors(res);
  }
  assert.deepEqual(sent, []);
});

test('CLIENT_ERRORS_TABLE missing: 500 "Server misconfiguration" and nothing is written', async () => {
  const h = load({});
  const res = await post(h, { message: 'm' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json(res), { ok: false, error: 'Server misconfiguration' });
  assert.deepEqual(sent, []);
});

test('a body over 16 KB is refused with 413 before it is parsed; exactly 16 KB is accepted', async () => {
  const h = load();
  const wrap = (n) => { const base = JSON.stringify({ message: 'm', stack: '' }).length; return JSON.stringify({ message: 'm', stack: 'a'.repeat(n - base) }); };
  const over = wrap(16 * 1024 + 1);
  assert.equal(Buffer.byteLength(over), 16 * 1024 + 1);
  const res = await post(h, over);
  assert.equal(res.statusCode, 413);
  assert.deepEqual(json(res), { ok: false, error: 'Payload too large' });
  noCors(res);
  assert.equal((await post(h, 'x'.repeat(17 * 1024))).statusCode, 413); // not even JSON: the size check comes first
  assert.deepEqual(sent, []);
  const exact = wrap(16 * 1024);
  assert.equal(Buffer.byteLength(exact), 16 * 1024);
  assert.equal((await post(h, exact)).statusCode, 202);
  assert.equal(sent.length, 1);
});

test('the 16 KB cap counts bytes, not characters (multi-byte text cannot slip past it)', async () => {
  const h = load();
  const body = JSON.stringify({ message: 'm', stack: '漢'.repeat(6000) }); // 6000 characters, 18000 bytes
  assert.ok(body.length < 16 * 1024 && Buffer.byteLength(body) > 16 * 1024);
  assert.equal((await post(h, body)).statusCode, 413);
  assert.deepEqual(sent, []);
});

test('invalid JSON, and a body without a usable message, are 400s and nothing is written', async () => {
  const h = load();
  let res = await post(h, '{"message": "unterminated');
  assert.equal(res.statusCode, 400);
  assert.deepEqual(json(res), { ok: false, error: 'Invalid JSON body' });
  for (const body of ['', '{}', '{"message":""}', '{"message":123}', '{"message":null}', '{"message":["a"]}', '{"stack":"only a stack"}']) {
    res = await post(h, body);
    assert.equal(res.statusCode, 400, body);
    assert.deepEqual(json(res), { ok: false, error: 'message is required' });
  }
  res = await h({ requestContext: { http: { method: 'POST' } } }); // no body at all
  assert.equal(res.statusCode, 400);
  assert.deepEqual(sent, []);
});

test('an event body already parsed to an object is accepted', async () => {
  const h = load();
  const res = await h({ requestContext: { http: { method: 'POST' } }, body: { message: 'from an object' } });
  assert.equal(res.statusCode, 202);
  assert.equal(sent[0].input.ExpressionAttributeValues[':msg'], 'from an object');
});

test('each field is clamped to its limit: message 2000, stack 8000, url 1000, userAgent 500, kind 40', async () => {
  const h = load();
  // 16 KB is the body cap, so the biggest fields are exercised one at a time.
  const stored = async (fields) => { sent.length = 0; const res = await post(h, { message: 'm', ...fields }); assert.equal(res.statusCode, 202); return sent[0].input.ExpressionAttributeValues; };
  let v = await stored({ message: 'a'.repeat(5000) });
  assert.equal(v[':msg'].length, 2000);
  v = await stored({ stack: 's'.repeat(9000) });
  assert.equal(v[':stack'].length, 8000);
  v = await stored({ url: 'u'.repeat(3000) });
  assert.equal(v[':url'].length, 1000);
  v = await stored({ userAgent: 'g'.repeat(3000) });
  assert.equal(v[':ua'].length, 500);
  v = await stored({ kind: 'k'.repeat(300) });
  assert.equal(v[':kind'].length, 40);
  // at the limit nothing is cut
  v = await stored({ message: 'a'.repeat(2000), url: 'u'.repeat(1000), userAgent: 'g'.repeat(500), kind: 'k'.repeat(40) });
  assert.deepEqual([v[':msg'].length, v[':url'].length, v[':ua'].length, v[':kind'].length], [2000, 1000, 500, 40]);
});

test('missing or non-string optional fields are stored as empty strings, and kind defaults to "error"', async () => {
  const h = load();
  const res = await post(h, { message: 'm', stack: 42, url: { a: 1 }, userAgent: null, kind: '' });
  assert.equal(res.statusCode, 202);
  const v = sent[0].input.ExpressionAttributeValues;
  assert.deepEqual([v[':stack'], v[':url'], v[':ua'], v[':kind']], ['', '', '', 'error']);
});

test('the same bug from different sessions shares one row: line:col, other numbers, spacing and case do not change the key', async () => {
  const h = load();
  const keyOf = async (message, stack) => { sent.length = 0; await post(h, { message, stack }); return sent[0].input.Key.errKey; };
  const a = await keyOf('Cannot read property x of undefined (id 123)', stackOf(10, 5));
  assert.equal(await keyOf('Cannot read property x of undefined (id 98765)', stackOf(4821, 77)), a, 'numbers and line:col');
  assert.equal(await keyOf('  CANNOT   read property X of undefined (id 1) ', stackOf(1, 1)), a, 'case and whitespace');
  assert.equal(await keyOf('Cannot read property x of undefined (id 1)', stackOf(10, 5)), a, 'same input twice');
  // Different bugs do not merge
  assert.notEqual(await keyOf('Cannot read property y of undefined (id 123)', stackOf(10, 5)), a, 'different message');
  assert.notEqual(await keyOf('Cannot read property x of undefined (id 123)', 'Error: boom\n    at otherFunction (https://globalperspective.net/assets/index-abc123.js:10:5)'), a, 'different first frame');
});

test('the fingerprint uses only the first stack frame, so deeper frames do not split a group', async () => {
  const h = load();
  const keyOf = async (stack) => { sent.length = 0; await post(h, { message: 'm', stack }); return sent[0].input.Key.errKey; };
  const top = '    at a (x.js:1:1)';
  assert.equal(await keyOf(`Error: m\n${top}\n    at b (y.js:2:2)`), await keyOf(`Error: m\n${top}\n    at c (z.js:9:9)\n    at d (w.js:3:3)`));
  assert.equal(await keyOf(undefined), await keyOf('no frames here'), 'a stack with no "at" or "@" line adds nothing');
  // Firefox/Safari frames ("fn@url:line:col") count as a first frame too.
  assert.notEqual(await keyOf('fnA@https://x/y.js:1:1'), await keyOf('fnB@https://x/y.js:1:1'));
});

test('the key is <UTC day>#<16 hex>, so the same error on another day is a new row', async () => {
  const h = load();
  test.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-05T23:59:59Z') });
  await post(h, { message: 'm' });
  test.mock.timers.setTime(Date.parse('2026-10-06T00:00:01Z'));
  await post(h, { message: 'm' });
  const [d1, d2] = sent.map((s) => s.input.Key.errKey.split('#'));
  assert.deepEqual([d1[0], d2[0]], ['2026-10-05', '2026-10-06']);
  assert.equal(d1[1], d2[1]);
  assert.equal(sent[0].input.ExpressionAttributeValues[':now'], '2026-10-05T23:59:59.000Z');
});

test('a DynamoDB failure is a 500 "Write failed" with no internals leaked', async () => {
  const h = load();
  respond = () => { throw new Error('ProvisionedThroughputExceeded: arn:aws:dynamodb:...'); };
  const res = await post(h, { message: 'm' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json(res), { ok: false, error: 'Write failed' });
  noCors(res);
});

test('an unexpected throw is caught as a 502 JSON reply without Access-Control-* headers', async () => {
  const h = load();
  const res = await h({ get requestContext() { throw new Error('event exploded'); } });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(json(res), { ok: false, error: 'event exploded' });
  noCors(res);
});
