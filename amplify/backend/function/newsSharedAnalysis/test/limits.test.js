import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPayload, proseBytes, MAX_PROSE_BYTES, utcDayStart } from '../src/limits.js';
import { handleRequest } from '../src/index.js';
import { goodBody, makeDeps, event, makeToken } from './helpers.js';

const sec = (prose) => ({ lensId: 'freeform', mode: 'freeform', prose, webSources: [] });

test('the 32 KB cap is in BYTES, not characters', () => {
  const ascii = 'a'.repeat(MAX_PROSE_BYTES);
  assert.equal(checkPayload(goodBody({ sections: [sec(ascii)] })).ok, true);
  assert.equal(checkPayload(goodBody({ sections: [sec(ascii + 'a')] })).status, 413);
  const jp = '日'.repeat(Math.floor(MAX_PROSE_BYTES / 3) + 1); // 3 bytes each: fewer characters, over the cap
  assert.ok(jp.length < MAX_PROSE_BYTES);
  assert.equal(checkPayload(goodBody({ sections: [sec(jp)] })).status, 413);
});
test('the cap is over all sections together', () => {
  const half = 'a'.repeat(MAX_PROSE_BYTES / 2 + 1);
  assert.equal(checkPayload(goodBody({ sections: [sec(half), sec(half)] })).status, 413);
  assert.equal(proseBytes([sec('ab'), sec('cd')]), 4);
});
test('story and section caps, unknown lens or mode, empty text', () => {
  const stories = Array.from({ length: 9 }, (_, i) => ({ topicId: `t${i}` }));
  assert.equal(checkPayload(goodBody({ stories })).code, 'too_many_stories');
  assert.equal(checkPayload(goodBody({ sections: Array.from({ length: 5 }, () => sec('x')) })).code, 'too_many_sections');
  assert.equal(checkPayload(goodBody({ sections: [{ ...sec('x'), lensId: 'nope' }] })).code, 'bad_request');
  assert.equal(checkPayload(goodBody({ sections: [{ ...sec('x'), mode: 'sneaky' }] })).code, 'bad_request');
  assert.equal(checkPayload(goodBody({ sections: [sec('   ')] })).code, 'bad_request');
  assert.equal(checkPayload(goodBody({ stories: [] })).code, 'bad_request');
  assert.equal(checkPayload(null).code, 'bad_request');
});
test('script markup and javascript: links in the prose are refused, control characters stripped', () => {
  assert.equal(checkPayload(goodBody({ sections: [sec('hello <script>alert(1)</script>')] })).code, 'unsafe_content');
  assert.equal(checkPayload(goodBody({ sections: [sec('[x](javascript:alert(1))')] })).code, 'unsafe_content');
  const r = checkPayload(goodBody({ sections: [sec('a\u0000b\u0007c')] }));
  assert.equal(r.value.sections[0].prose, 'abc');
});
test('web sources: http(s) links kept, everything else loses the link but keeps its place; capped at 20', () => {
  const ws = [{ n: 1, title: 'Ok', url: 'https://ex.com/a' }, { n: 2, title: 'Bad', url: 'javascript:alert(1)' }, ...Array.from({ length: 30 }, (_, i) => ({ n: i + 3, title: 't', url: 'https://x.com' }))];
  const r = checkPayload(goodBody({ sections: [{ ...sec('x'), webSources: ws }] }));
  assert.equal(r.value.sections[0].webSources.length, 20);
  assert.equal(r.value.sections[0].webSources[0].url, 'https://ex.com/a');
  assert.equal(r.value.sections[0].webSources[1].url, null);
});
test('the daily cap: the 21st share of a UTC day is refused, the next day starts fresh', async () => {
  const deps = makeDeps();
  const token = makeToken({ uid: 'busy' });
  for (let i = 0; i < 20; i++) deps.store.rows.set(`s${i}`, { id: `s${i}`, uid: 'busy', createdAt: '2026-10-05T01:00:00.000Z' });
  const r = await handleRequest(event('POST', { token, body: goodBody() }), deps);
  assert.equal(r.statusCode, 429);
  assert.equal(JSON.parse(r.body).error, 'daily_limit');
  const other = await handleRequest(event('POST', { token: makeToken({ uid: 'someone-else' }), body: goodBody() }), deps);
  assert.equal(other.statusCode, 201);
  const tomorrow = makeDeps({ store: deps.store, now: () => Date.parse('2026-10-06T00:00:01Z') });
  assert.equal((await handleRequest(event('POST', { token, body: goodBody() }), tomorrow)).statusCode, 201);
  assert.equal(utcDayStart(Date.parse('2026-10-05T23:59:59Z')), '2026-10-05T00:00:00.000Z');
});
