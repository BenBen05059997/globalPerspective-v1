'use strict';
// story-text.js: the agent's text steps as functions of their inputs (decision 0061 lifted them out of the handler for the recovery script).
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/story-text');

const topic = { id: 'Quake-0', title: 'Quake', categories: ['disaster'], sources: [{ source: 'bbc.com', snippet: 'A quake struck.' }] };

test('textPrompt serves a summary and a cause chain and nothing else (no forecast prompt is reachable)', () => {
  assert.match(T.textPrompt('summary', topic, 'November 14, 2026'), /Summarize, in 3-4 bullet points/);
  assert.match(T.textPrompt('trace_cause', topic, 'November 14, 2026'), /Council of Experts/);
  assert.throws(() => T.textPrompt('prediction', topic, 'November 14, 2026'), /no text prompt for kind prediction/);
  assert.deepEqual(T.TEXT_KINDS, ['summary', 'trace_cause']);
});

test('storyChatOptions and storyAnswer: the live call options, and an empty answer throws', () => {
  const o = T.storyChatOptions({ prompt: 'P', maxTokens: 1500, model: 'm', step: 'summary', json: false, temperature: 0.2, topP: 0.9 });
  assert.deepEqual(o, { step: 'summary', model: 'm', user: 'P', maxTokens: 1500, temperature: 0.2, topP: 0.9, json: false, timeoutMs: 180000, retries: 1 });
  assert.deepEqual(T.storyAnswer({ content: '```\nhi\n```', model: 'm', latencyMs: 5, usage: { u: 1 } }), { modelId: 'm', content: 'hi', latencyMs: 5, usage: { u: 1 } });
  assert.throws(() => T.storyAnswer({ content: '', model: 'm' }), /Empty response from m/);
});

test('finishText strips the fence of a cause chain and leaves a summary alone', () => {
  assert.equal(T.finishText('trace_cause', { content: '```json\n{"a":1}\n```' }).content, '{"a":1}');
  assert.equal(T.finishText('summary', { content: '- a' }).content, '- a');
});

test('buildCacheItem is the stored row: keys, json flag, the write time it is given', () => {
  const nowMs = Date.parse('2026-11-17T01:02:03.000Z');
  const item = T.buildCacheItem({ pk: 'TOPIC#Quake-0', sk: 'TRACE_CAUSE', topic, kind: 'trace_cause', response: { content: '{"a":1}', modelId: 'm', latencyMs: 9 }, ttlSeconds: 100, generationId: 'g', fingerprint: 'fp', threadId: 'thread-x', nowMs });
  assert.equal(item.contentFormat, 'json');
  assert.equal(item.generatedAt, '2026-11-17T01:02:03.000Z');
  assert.equal(item.ttl, Math.floor(nowMs / 1000) + 100);
  assert.deepEqual([item.PK, item.SK, item.topicId, item.action, item.model, item.sourceFingerprint, item.threadId], ['TOPIC#Quake-0', 'TRACE_CAUSE', 'Quake-0', 'trace_cause', 'm', 'fp', 'thread-x']);
});

test('storyDefaults reads the agent caps from its env, with the old fallbacks', () => {
  assert.deepEqual(T.storyDefaults({}), { maxTokens: 600, temperature: 0.2, topP: 0.9 });
  assert.deepEqual(T.storyDefaults({ MAX_TOKENS: '1500', TEMPERATURE: '0.5', TOP_P: '0.8' }), { maxTokens: 1500, temperature: 0.5, topP: 0.8 });
});

test('buildArchiveEntry stamps the archive time it is given', () => {
  const e = T.buildArchiveEntry(topic, { summary: 's' }, 'g', 10, 'thread-x', '2026-11-17T01:02:03.000Z');
  assert.equal(e.archivedAt, '2026-11-17T01:02:03.000Z');
  assert.equal(e.category, 'disaster');
});
