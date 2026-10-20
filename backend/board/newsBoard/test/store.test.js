'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeStoreOn, BOARD_PREFIX } = require('../src/store');
const { ENV } = require('./helpers');

// The real store over a fake `send` that records command inputs (needs the AWS SDK installed in src/node_modules).
let C = null;
try { C = require('../src/node_modules/@aws-sdk/lib-dynamodb'); } catch { /* not installed */ }

test('setFollows SETs exactly the followed* attributes given and nothing else', { skip: !C }, async () => {
  const sent = [];
  const store = makeStoreOn(async (cmd) => { sent.push(cmd.input); return {}; }, C, ENV);
  await store.setFollows('u1', { followedThreads: ['t'], followedCountries: ['Iran'], digestOptIn: false });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].TableName, 'prefs');
  assert.deepEqual(sent[0].Key, { uid: 'u1' });
  assert.equal(sent[0].UpdateExpression, 'SET followedThreads = :followedThreads');
  assert.deepEqual(sent[0].ExpressionAttributeValues, { ':followedThreads': ['t'] });
  await store.setFollows('u1', { followedThreads: ['t'], followedActors: ['a'] });
  assert.equal(sent[1].UpdateExpression, 'SET followedThreads = :followedThreads, followedActors = :followedActors');
  await store.setFollows('u1', { followedCountries: ['x'] });
  assert.equal(sent.length, 2, 'nothing to set -> no call');
});

test('board reads and writes use savedKey board#<id> and the board prefix query', { skip: !C }, async () => {
  const sent = [];
  const store = makeStoreOn(async (cmd) => { sent.push(cmd.input); return { Items: [], Item: undefined }; }, C, ENV);
  await store.getBoards('u1');
  await store.getBoard('u1', 'b1');
  await store.deleteBoard('u1', 'b1');
  assert.equal(sent[0].ExpressionAttributeValues[':sk'], BOARD_PREFIX);
  assert.deepEqual(sent[0].ExpressionAttributeNames, { '#pk': 'uid', '#sk': 'savedKey' });
  assert.deepEqual(sent[1].Key, { uid: 'u1', savedKey: 'board#b1' });
  assert.deepEqual(sent[2].Key, { uid: 'u1', savedKey: 'board#b1' });
  assert.equal(sent[1].TableName, 'saved');
});

test('getFollows defaults to empty lists; batchGet pages in 100s and retries unprocessed keys', { skip: !C }, async () => {
  const sent = [];
  let unprocessedOnce = true;
  const store = makeStoreOn(async (cmd) => {
    sent.push(cmd.input);
    if (cmd.input.RequestItems) {
      const keys = cmd.input.RequestItems.world.Keys;
      if (keys.length === 100 && unprocessedOnce) { unprocessedOnce = false; return { Responses: { world: keys.slice(0, 90) }, UnprocessedKeys: { world: { Keys: keys.slice(90) } } }; }
      return { Responses: { world: keys } };
    }
    return {};
  }, C, ENV);
  assert.deepEqual(await store.getFollows('u1'), { followedThreads: [], followedActors: [] });
  const keys = Array.from({ length: 150 }, (_, i) => ({ PK: `T${i}`, SK: 'S' }));
  const out = await store.batchGet('world', keys);
  assert.equal(out.length, 150);
});
