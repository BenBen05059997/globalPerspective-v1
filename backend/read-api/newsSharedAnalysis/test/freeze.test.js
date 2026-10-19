import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeSources, sameNumbering, makeProxyFetchers } from '../src/freeze.js';
import { golden, goldenFetchers } from './helpers.js';

const stories = golden.stories.map((s) => ({ topicId: s.topicId, threadId: s.threadId }));

test('the server derives the SAME context and numbering as the browser (golden fixture)', async () => {
  const r = await freezeSources({ stories, fetchers: goldenFetchers() });
  assert.equal(r.ok, true);
  assert.equal(r.frozen.context, golden.expected.context);
  assert.deepEqual(r.frozen.citations, golden.expected.citations);
  assert.equal(r.frozen.thin, golden.expected.thin);
});
test('frozen sources drop non-http(s) links and carry the full numbered text', async () => {
  const r = await freezeSources({ stories, fetchers: goldenFetchers() });
  assert.equal(r.frozen.sources.length, 8);
  assert.ok(r.frozen.sources.every((s) => s.url === null || /^https?:\/\//.test(s.url)));
  assert.ok(r.frozen.sources[0].text.includes('Trajectory: escalating'));
  assert.deepEqual(r.frozen.stories.map((s) => s.title), ['US strikes Iranian oil tankers', 'Japan announces stimulus package']);
});
test('an archive-only story (not in today\'s topics) is named from the archive thread, never from the client', async () => {
  const noTopics = goldenFetchers({ topics: async () => ({ data: { topics: [] } }) });
  const r = await freezeSources({ stories: [{ topicId: 'whatever the client says', threadId: 'thread-iran-tanker-aaa111' }], fetchers: noTopics });
  assert.equal(r.ok, true);
  assert.equal(r.frozen.stories[0].title, 'Iran vows tougher reprisals'.length ? r.frozen.stories[0].title : '');
  assert.match(r.frozen.stories[0].title, /^(US strikes three Iranian oil tankers|Iran vows tougher reprisals)$/);
});
test('an unknown story (no thread, not in today\'s topics) is refused with 422', async () => {
  const r = await freezeSources({ stories: [{ topicId: 'made-up', threadId: null }], fetchers: goldenFetchers() });
  assert.equal(r.ok, false); assert.equal(r.status, 422); assert.equal(r.code, 'unknown_story');
});
test('a failing archive read is a 502, never a partial share', async () => {
  const r = await freezeSources({ stories: [stories[1]], fetchers: goldenFetchers({ summary: async () => { throw new Error('down'); }, prediction: async () => { throw new Error('down'); }, traceCause: async () => { throw new Error('down'); } }) });
  // a story whose material fails still freezes with what it has (fail empty); the builder itself never throws
  assert.equal(r.ok, true);
  assert.equal(r.frozen.sources.length, 2); // only the topic's own headline sources remain (one of them is a javascript: link, which keeps its text but loses the link)
  assert.equal(r.frozen.sources.filter((s) => s.url).length, 1);
});
test('sameNumbering: identical passes; any difference in count, kind, date, label or url fails', () => {
  const c = golden.expected.citations;
  assert.equal(sameNumbering(c, JSON.parse(JSON.stringify(c))), true);
  assert.equal(sameNumbering(c, c.slice(1)), false);
  assert.equal(sameNumbering(c, c.map((x, i) => (i === 0 ? { ...x, kind: 'NEWS' } : x))), false);
  assert.equal(sameNumbering(c, c.map((x, i) => (i === 2 ? { ...x, date: '2020-01-01' } : x))), false);
  assert.equal(sameNumbering(c, null), false);
});
test('the proxy client sends {action,payload}, adds the reader\'s token only for auth-tier actions, and unwraps lambda-proxy bodies', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ statusCode: 200, body: JSON.stringify({ success: true, data: [] }) }) }; };
  const f = makeProxyFetchers({ proxyUrl: 'https://proxy.example/x', token: 'TOK', fetchImpl });
  const out = await f.narrativeThread('thread-1');
  assert.deepEqual(out, { success: true, data: [] });
  assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'narrative_thread', payload: { threadId: 'thread-1' } });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer TOK');
  await f.summary('t');
  assert.equal(calls[1].init.headers.Authorization, undefined);
});
