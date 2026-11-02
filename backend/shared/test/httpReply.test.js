'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { httpReply } = require('../src/httpReply');

test('status, JSON content type and the body serialised', () => {
  assert.deepEqual(httpReply(200, { ok: true, n: [1, 2] }), { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{"ok":true,"n":[1,2]}' });
  assert.deepEqual(httpReply(400, { error: 'x' }), { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: '{"error":"x"}' });
});

test('same bytes as the three copies it replaced for a spread of bodies', () => {
  const old = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const [code, body] of [[200, {}], [200, []], [204, null], [500, { error: 'boom', detail: 'ü' }], [200, 'text'], [200, 7], [200, undefined]]) {
    assert.deepEqual(httpReply(code, body), old(code, body));
  }
});

test('never emits an Access-Control-* header (the Function-URL CORS config owns CORS for the Lambdas that use it)', () => {
  const keys = Object.keys(httpReply(200, {}).headers).map((k) => k.toLowerCase());
  assert.deepEqual(keys, ['content-type']);
  assert.equal(keys.some((k) => k.startsWith('access-control-')), false);
});
