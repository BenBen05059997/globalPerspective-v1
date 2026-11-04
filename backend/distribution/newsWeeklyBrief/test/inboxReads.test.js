'use strict';
// ARCHIVE_READS=inbox (decision 0035 step 5d): the week's archive comes from the entries inbox, with no NewsCache read.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { withLambda, fakeDdb, fakeS3, fakeLlm, inboxObjects } = require('../../../shared/test/pipelineHarness');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = { TOPICS_DDB_TABLE: 'topics', SUMMARIZE_PREDICT_TABLE: 'summary', XAI_API_KEY: 'k', NOTES_READS: undefined, NOTES_PREFIX: undefined, WORLD_BUCKET: 'bkt', ARCHIVE_READS: 'inbox', ENTRIES_INBOX_PREFIX: 'record/' };
const entry = (topicId, threadId) => ({ topicId, threadId, title: `Headline ${topicId}`, regions: ['Japan'], category: 'economy', archivedAt: new Date().toISOString(), sources: [{ source: 'Reuters', url: `https://example.com/${topicId}` }], ai: {} });
const REPLY = JSON.stringify({ signals: [{ threadId: 'thr-a', lede: 'Lede', fact: 'A fact' }] });

test('the weekly brief is built from the entries inbox: the model sees the thread, DynamoDB is not asked for archive rows', async () => {
  const ddb = fakeDdb();
  const llm = fakeLlm(REPLY);
  const s3 = fakeS3(inboxObjects({ 1: [entry('a-2', 'thr-a')], 2: [entry('a-1', 'thr-a')] }));
  await withLambda(INDEX, { env: ENV, ddb, s3, llm }, async ({ mod }) => {
    const out = await mod.handler({});
    assert.equal(out.skipped, undefined);
  });
  assert.equal(llm.calls.length, 1);
  assert.match(llm.calls[0].user, /thr-a/);
  assert.ok(!ddb.sent.some((c) => c.name === 'GetCommand' && c.input.TableName === 'topics'), 'no NewsCache read');
  assert.equal(ddb.puts.length, 1);
});

test('a week with no inbox files is the normal empty skip, not an error', async () => {
  const ddb = fakeDdb();
  await withLambda(INDEX, { env: ENV, ddb, s3: fakeS3(), llm: fakeLlm(REPLY) }, async ({ mod }) => {
    assert.equal((await mod.handler({})).skipped, 'no-archive-entries');
  });
  assert.equal(ddb.puts.length, 0);
});
