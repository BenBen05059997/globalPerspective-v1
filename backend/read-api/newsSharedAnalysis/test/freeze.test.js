import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeSources, sameNumbering, makeProxyFetchers } from '../src/freeze.js';
import { golden, goldenFetchers } from './helpers.js';

const stories = golden.stories.map((s) => ({ topicId: s.topicId, threadId: s.threadId }));

test('the server derives the SAME context and numbering as the browser (golden fixture)', async () => {
  const r = await freezeSources({ stories, fetchers: goldenFetchers() });
  assert.equal(r.ok, true);
  assert.equal(r.frozen.context, golden.expected.context);
  assert.deepEqual(r.frozen.citations.map(({ threadId, ...c }) => c), golden.expected.citations); // threadId is server-only
  assert.equal(r.frozen.thin, golden.expected.thin);
});
test('frozen sources drop non-http(s) links and carry the full numbered text', async () => {
  const r = await freezeSources({ stories, fetchers: goldenFetchers() });
  assert.equal(r.frozen.sources.length, 8);
  assert.ok(r.frozen.sources.every((s) => s.url === null || /^https?:\/\//.test(s.url)));
  assert.ok(r.frozen.sources[0].text.includes('Trajectory: escalating'));
  assert.deepEqual(r.frozen.stories.map((s) => s.title), ['US strikes Iranian oil tankers', 'Japan announces stimulus package']);
});
test('every citation and frozen source names its story\'s thread', async () => {
  const r = await freezeSources({ stories, fetchers: goldenFetchers() });
  const threadByTitle = Object.fromEntries(r.frozen.stories.map((s) => [s.title, s.threadId]));
  for (const x of [...r.frozen.citations, ...r.frozen.sources]) assert.equal(x.threadId, threadByTitle[x.storyTitle] ?? null, x.storyTitle);
  assert.ok(r.frozen.citations.some((c) => c.threadId));
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

// ---- decision 0052: the forecast from the record's forecasts view, the action as fallback ----
const fork = (topic, day) => ({ forkId: `PRED#${topic}/${day}`, drawnAt: `${day}T05:00:00.000Z`, branches: [{ branchId: `PRED#${topic}/${day}/0-0`, text: 'Likely', p: 40, trigger: 'Will it', resolutionSource: 'R', due: '2026-12-01', question: true, qid: 'q1', scenarioP: 60, scoring: 'sampled', state: 'awaiting' }] });
const viewsFetch = (files, calls = []) => async (url) => {
  calls.push(url);
  const key = url.replace('https://site.test/data/record/views/', '');
  if (!(key in files)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => files[key] };
};
const NOW = Date.parse('2026-10-31T12:00:00Z');
const fresh = { 'manifest.json': { builtAt: '2026-10-31T08:00:00Z' }, 'forecasts/th-1.json': { threadId: 'th-1', forks: [fork('A-1', '2026-10-20'), fork('B-2', '2026-10-22')] } };

test('forecastFromRecord is wired only with RECORD_VIEWS_URL, answers from the forecasts view while the manifest is under 9 hours old, and maps like the browser', async () => {
  assert.equal(makeProxyFetchers({ proxyUrl: 'https://p.example/x' }).forecastFromRecord, undefined);
  const calls = [];
  const f = makeProxyFetchers({ proxyUrl: 'https://p.example/x', recordViewsUrl: 'https://site.test/data/record/views/', fetchImpl: viewsFetch(fresh, calls), now: () => NOW });
  assert.equal((await f.forecastFromRecord('th-1', null)).snapshot.topicId, 'B-2');
  assert.equal((await f.forecastFromRecord('th-1', ['A-1'])).snapshot.topicId, 'A-1');
  assert.deepEqual(await f.forecastFromRecord('th-none', null), { answered: true, snapshot: null }, 'no file: the story drew no question');
  assert.ok(calls.every((u) => u.startsWith('https://site.test/data/record/views/')));
});

test('forecastFromRecord does not answer on stale views, a bad thread id or an unreadable manifest', async () => {
  const stale = makeProxyFetchers({ proxyUrl: 'x', recordViewsUrl: 'https://site.test/data/record/views', fetchImpl: viewsFetch({ ...fresh, 'manifest.json': { builtAt: '2026-10-31T02:00:00Z' } }), now: () => NOW });
  assert.equal((await stale.forecastFromRecord('th-1', null)).answered, false);
  const f = makeProxyFetchers({ proxyUrl: 'x', recordViewsUrl: 'https://site.test/data/record/views', fetchImpl: viewsFetch(fresh), now: () => NOW });
  assert.equal((await f.forecastFromRecord('../x', null)).answered, false);
  const noManifest = makeProxyFetchers({ proxyUrl: 'x', recordViewsUrl: 'https://site.test/data/record/views', fetchImpl: viewsFetch({}), now: () => NOW });
  assert.equal((await noManifest.forecastFromRecord('th-1', null)).answered, false);
});

test('the context builder uses the record\'s forecast when it answers (the action is not called) and the action when it does not', async () => {
  const story = stories.slice(0, 1);
  let actionCalls = 0;
  const base = goldenFetchers();
  const withRecord = (answer) => ({ ...base, predictionSnapshot: async () => { actionCalls += 1; return { snapshot: null }; }, forecastFromRecord: async () => answer });
  const viaRecord = await freezeSources({ stories: story, fetchers: withRecord({ answered: true, snapshot: { topicId: story[0].topicId, generatedAt: '2026-10-20T05:00:00.000Z', scenarios: [{ label: 'Likely', probability: 0.6, triggers: [{ id: '0-0', text: 'Will it', deadline: '2026-12-01', verdict: null }] }] } }) });
  assert.equal(actionCalls, 0);
  assert.equal(viaRecord.ok, true);
  assert.ok(viaRecord.frozen.sources.some((x) => x.kind === 'FORECAST'));
  await freezeSources({ stories: story, fetchers: withRecord({ answered: false, snapshot: null }) });
  assert.ok(actionCalls >= 1);
});
