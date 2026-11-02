'use strict';
// s3NoteWriter(prefix): the SDK is replaced, so the test sees which region, bucket and keys the writer uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { s3NoteWriter, DEFAULT_WORLD_BUCKET } = require('../src/s3NoteWriter');
const notes = require('../src/notes');

const item = {
  countryName: 'Iran', asOf: '2026-07-30', since: '2026-07-29', changeScore: { from: 90, to: 95, delta: 5 }, changeDimensions: { economic: { from: 80, to: 90, delta: 10 } },
  priorHeadline: 'p', currentHeadline: 'c', currentRiskScore: 95, currentRiskLevel: 'severe', currentLead: 'conflict',
  triggerEvent: { topicId: 'x-1', threadId: 'thread-x', title: 'X', date: '2026-07-30' }, whyChanged: 'Because X.', noSingleDriver: false,
  generatedAt: '2026-07-31T05:30:02.114Z',
};

// Replace @aws-sdk/client-s3 for one writer: nothing exists yet (GetObject -> NoSuchKey), every PutObject succeeds and is recorded.
function withFakeSdk(fn) {
  const sent = []; const clients = [];
  const original = Module._load;
  Module._load = function load(name, ...args) {
    if (name !== '@aws-sdk/client-s3') return original.call(this, name, ...args);
    class GetObjectCommand { constructor(input) { this.input = input; } }
    class PutObjectCommand { constructor(input) { this.input = input; } }
    class S3Client {
      constructor(cfg) { clients.push(cfg); }
      async send(cmd) {
        sent.push([cmd.constructor.name, cmd.input.Bucket, cmd.input.Key]);
        if (cmd instanceof GetObjectCommand) { const e = new Error('NoSuchKey'); e.name = 'NoSuchKey'; throw e; }
        return { ETag: '"e"' };
      }
    }
    return { S3Client, GetObjectCommand, PutObjectCommand };
  };
  return fn({ sent, clients }).finally(() => { Module._load = original; });
}
const withEnv = async (env, fn) => {
  const saved = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};
const driftNote = () => notes.driftNote({ item, iso3: 'IRN', model: 'm', producer: { lambda: 'newsDriftCorrector', runId: 'r' } });

test('defaults: ap-northeast-1, the world bucket, notes under the given prefix', () => withEnv({ AWS_REGION: undefined, WORLD_BUCKET: undefined }, () => withFakeSdk(async ({ sent, clients }) => {
  const r = await s3NoteWriter('record/shadow/').write('drift', [driftNote()]);
  assert.equal(r.appended, 1);
  assert.deepEqual(clients, [{ region: 'ap-northeast-1' }]);
  assert.ok(sent.length >= 3);
  for (const [, bucket] of sent) assert.equal(bucket, DEFAULT_WORLD_BUCKET);
  const keys = sent.map(([, , key]) => key);
  assert.ok(keys.includes('record/shadow/notes/drift/manifest.json'), keys.join());
  assert.ok(keys.includes('record/shadow/notes/drift/2026-07-31.jsonl'), keys.join());
  assert.ok(keys.every((k) => k.startsWith('record/shadow/notes/drift/')));
})));

test('env WORLD_BUCKET and AWS_REGION are read when the writer is built', () => withEnv({ AWS_REGION: 'us-east-1', WORLD_BUCKET: 'other-bucket' }, () => withFakeSdk(async ({ sent, clients }) => {
  await s3NoteWriter('record/').write('drift', [driftNote()]);
  assert.deepEqual(clients, [{ region: 'us-east-1' }]);
  assert.ok(sent.every(([, bucket]) => bucket === 'other-bucket'));
  assert.ok(sent.every(([, , key]) => key.startsWith('record/notes/drift/')));
})));

test('the SDK is required when the writer is built, not when the module loads', () => {
  assert.equal(typeof s3NoteWriter, 'function'); // this file loaded the module with no @aws-sdk installed or stubbed
});
