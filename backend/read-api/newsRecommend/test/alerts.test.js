'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// Stub the AWS SDK: record every command and answer from `state`.
const state = { sent: [], item: null, items: [] };
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: (t, k) => {
    if (k === 'DynamoDBDocumentClient') return { from: () => ({ send: async (c) => { state.sent.push(c); return c.constructor.name === 'GetCommand' ? { Item: state.item } : { Items: state.items }; } }) };
    return { [k]: class { constructor(i) { this.input = i; } } }[k];
  } });
  return orig.call(this, req, ...r);
};
const { listAlerts, getAlert } = require('../src/index.js');
Module._load = orig;

test('listAlerts scans for confirmed rows only', async () => {
  state.sent = []; state.items = [{ alertKey: 'a', title: 'T', confirmedAt: '2026-10-20T00:00:00Z' }];
  const out = await listAlerts();
  assert.strictEqual(out.length, 1);
  const input = state.sent[0].input;
  assert.strictEqual(input.FilterExpression, '#s = :confirmed');
  assert.deepStrictEqual(input.ExpressionAttributeValues, { ':confirmed': 'confirmed' });
});

test('getAlert serves confirmed rows and hides sent, proposed and rejected', async () => {
  for (const status of ['sent', 'proposed', 'rejected']) {
    state.item = { alertKey: 'a', status, title: 'T' };
    assert.strictEqual(await getAlert('a'), null, status);
  }
  state.item = { alertKey: 'a', status: 'confirmed', title: 'T', confirmedAt: '2026-10-20T00:00:00Z' };
  assert.strictEqual((await getAlert('a')).id, 'a');
});
