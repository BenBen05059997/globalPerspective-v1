'use strict';
// The settle check reading the record (SETTLE_SOURCE=record, decision 0052): three public files under /data/record/views/, through the handler.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.SETTLE_SOURCE = 'record';
process.env.SITE_URL = 'https://site.test';
process.env.SNS_TOPIC_ARN = 'arn:test';
const load = Module._load;
Module._load = function (request, ...rest) { return request === '@aws-sdk/client-sns' ? { SNSClient: class {}, PublishCommand: class {} } : load.call(this, request, ...rest); };
const { handler } = require('../src/index');
Module._load = load;

const NOW = '2026-10-27T12:30:00Z';
const view = (h = {}) => ({ schemaVersion: 1, questions: { firstCommit: { weekId: '2026-W41', committedAt: '2026-10-01T10:30:00.000Z' }, counts: { locked: 3, resolved: 1, void: 0, awaiting: 2, pastDeadlineUnchecked: 0 }, settleHealth: { expectedDrawWeek: null, drawMissed: false, commitMissing: false, lastVerdictAt: null, dueUnsettled: 0, oldestDueUnsettledDays: null, ...h } } });
function serve(files) {
  const asked = [];
  global.fetch = async (url) => {
    asked.push(url);
    const key = url.replace('https://site.test/data/record/views/', '');
    const f = files[key];
    if (f === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => f };
  };
  return asked;
}
const ok = { 'track-record.json': view(), 'manifest.json': { builtAt: '2026-10-27T11:00:00Z' }, 'health/settle-tick.json': { at: '2026-10-27T10:30:00Z' } };

test('record source: the three files are read from SITE_URL/data/record/views and a healthy board is silent', async () => {
  const asked = serve(ok);
  const r = await handler({ settleCheckOnly: true, dryRun: true, now: NOW });
  assert.deepEqual(asked.sort(), ['health/settle-tick.json', 'manifest.json', 'track-record.json'].map((k) => `https://site.test/data/record/views/${k}`));
  assert.deepEqual([r.settleCheck.alert, r.settleCheck.reasons], [false, []]);
});

test('record source: a missed draw and a stale tick are named, with the message a dry run returns', async () => {
  serve({ ...ok, 'track-record.json': view({ drawMissed: true, expectedDrawWeek: '2026-W43' }), 'health/settle-tick.json': { at: '2026-10-20T10:30:00Z' } });
  const r = await handler({ settleCheckOnly: true, dryRun: true, now: NOW });
  assert.deepEqual(r.settleCheck.reasons, ['draw_missed', 'tick_stale']);
  assert.match(r.settleCheck.message.body, /draw for 2026-W43 was not written/);
  assert.equal(r.settleCheck.sent, false);
});

test('record source: no heartbeat yet waits (skipped, never an alarm); a missing view or manifest is skipped too', async () => {
  serve({ ...ok, 'health/settle-tick.json': undefined });
  assert.match((await handler({ settleCheckOnly: true, dryRun: true, now: NOW })).settleCheck.skipped, /heartbeat not written yet/);
  serve({ ...ok, 'track-record.json': undefined });
  assert.match((await handler({ settleCheckOnly: true, dryRun: true, now: NOW })).settleCheck.skipped, /track-record view not generated/);
  serve({ ...ok, 'manifest.json': undefined });
  assert.match((await handler({ settleCheckOnly: true, dryRun: true, now: NOW })).settleCheck.skipped, /manifest not generated/);
});
