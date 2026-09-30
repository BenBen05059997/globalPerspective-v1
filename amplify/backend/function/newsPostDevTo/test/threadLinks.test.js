'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveStoryThreadId, resolveStoryThreadIds } = require('../src/threadLinks');

// Real 2026-09-30 titles (daily brief topStories vs archive entries).
const ENTRIES = [
  { title: 'US Supreme Court Allows Third-Country Deportations to Resume', threadId: 'thread-scotus-c1602d' },
  { title: 'Trump Claims Iran War Will End \'Very Soon\' Without Details', threadId: 'thread-trump-iran-442c7f' },
  { title: 'Israeli Settlers Attack West Bank Village, Injuring Israeli Activists', threadId: 'thread-settlers-f079e8' },
  { title: 'Qatar PM Slams Israel\'s Atrocities in Gaza, Says Ceasefire Unraveling', threadId: 'thread-qatar-50fb69' },
  { title: 'Iran War Talks Stall', threadId: 'thread-a' },
  { title: 'Iran War Talks Stall', threadId: 'thread-b' },
  { title: 'No thread here', threadId: null },
];

test('exact normalized title (case / punctuation insensitive)', () => {
  assert.strictEqual(resolveStoryThreadId('us supreme court allows third country deportations to resume!', ENTRIES), 'thread-scotus-c1602d');
});
test('paraphrase by containment (model shortened the title)', () => {
  assert.strictEqual(resolveStoryThreadId('Israeli Settlers Attack West Bank Village', ENTRIES), 'thread-settlers-f079e8');
});
test('paraphrase by token overlap (>= 0.6 Jaccard)', () => {
  assert.strictEqual(resolveStoryThreadId('Qatar PM slams Israel atrocities in Gaza, says ceasefire unraveling', ENTRIES), 'thread-qatar-50fb69');
});
test('no match -> null (never a guess)', () => {
  assert.strictEqual(resolveStoryThreadId('Completely unrelated volcano story', ENTRIES), null);
  assert.strictEqual(resolveStoryThreadId('', ENTRIES), null);
});
test('short title cannot match by containment', () => {
  assert.strictEqual(resolveStoryThreadId('Iran', ENTRIES), null);
});
test('ambiguous (two different threads with the same best title) -> null, unless exactly one has an analysis', () => {
  assert.strictEqual(resolveStoryThreadId('Iran War Talks Stall', ENTRIES), null);
  assert.strictEqual(resolveStoryThreadId('Iran War Talks Stall', ENTRIES, { 'thread-b': { threadTitle: 'x' } }), 'thread-b');
});
test('entries without a threadId are ignored', () => {
  assert.strictEqual(resolveStoryThreadId('No thread here', ENTRIES), null);
});
test('resolveStoryThreadIds keeps other fields, adds threadId, never throws on junk', () => {
  const out = resolveStoryThreadIds([{ title: 'US Supreme Court Allows Third-Country Deportations to Resume', prediction: 'p', sourceCount: 3 }, null, { title: 'zzz' }], ENTRIES);
  assert.strictEqual(out[0].threadId, 'thread-scotus-c1602d');
  assert.strictEqual(out[0].prediction, 'p');
  assert.strictEqual(out[1], null);
  assert.strictEqual(out[2].threadId, null);
  assert.deepStrictEqual(resolveStoryThreadIds(undefined, ENTRIES), []);
});
