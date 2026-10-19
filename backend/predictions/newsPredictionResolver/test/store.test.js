'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeStore } = require('./helpers');

test('putOnce is immutable: the second write of the same key is refused and changes nothing', async () => {
  const s = fakeStore();
  assert.equal(await s.putOnce({ PK: 'Q#a', SK: 'VERDICT', verdict: 'yes' }), true);
  assert.equal(await s.putOnce({ PK: 'Q#a', SK: 'VERDICT', verdict: 'no' }), false);
  assert.equal((await s.get('Q#a', 'VERDICT')).verdict, 'yes');
  // a correction is a new row
  assert.equal(await s.putOnce({ PK: 'Q#a', SK: 'VERDICT#2', verdict: 'no' }), true);
});

let hasSdk = true;
try { require.resolve('@aws-sdk/lib-dynamodb'); } catch { hasSdk = false; }
// the Lambda runtime provides the AWS SDK; locally it may not be installed
test('the real store module loads and exposes the same interface', { skip: !hasSdk }, () => {
  const { makeStore } = require('../src/store');
  const st = makeStore('T', 'ap-northeast-1');
  for (const k of ['putOnce', 'get', 'listCommits', 'predRows', 'listQuestionRows', 'queryPK']) assert.equal(typeof st[k], 'function');
});
