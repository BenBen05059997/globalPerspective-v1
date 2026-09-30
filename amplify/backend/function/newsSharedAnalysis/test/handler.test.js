import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleRequest } from '../src/index.js';
import { goodBody, makeDeps, event, makeToken, golden } from './helpers.js';

const call = async (deps, method, opts) => { const r = await handleRequest(event(method, opts), deps); return { ...r, json: r.body ? JSON.parse(r.body) : null }; };
const T = makeToken({ uid: 'owner-1' });

test('happy path: a run that passes is stored, unlisted, and readable by anyone without the owner id', async () => {
  const deps = makeDeps();
  const r = await call(deps, 'POST', { token: T, body: goodBody() });
  assert.equal(r.statusCode, 201);
  assert.match(r.json.id, /^[A-Za-z0-9_-]{22}$/);
  const stored = deps.store.rows.get(r.json.id);
  assert.equal(stored.uid, 'owner-1');
  assert.equal(stored.sources.length, 8);
  assert.equal(stored.sections[0].checks.hasError, false);
  assert.equal(stored.stories[0].title.length > 0, true);
  const g = await call(deps, 'GET', { query: { id: r.json.id } });
  assert.equal(g.statusCode, 200);
  assert.equal(g.json.share.uid, undefined);
  assert.equal(g.json.share.owner, false);
  assert.equal(g.json.share.sources.length, 8);
  assert.equal(g.headers['X-Robots-Tag'], 'noindex, nofollow');
});
test('the owner (valid token) sees owner:true; another signed-in user does not', async () => {
  const deps = makeDeps();
  const id = (await call(deps, 'POST', { token: T, body: goodBody() })).json.id;
  assert.equal((await call(deps, 'GET', { query: { id }, token: T })).json.share.owner, true);
  assert.equal((await call(deps, 'GET', { query: { id }, token: makeToken({ uid: 'someone' }) })).json.share.owner, false);
});
test('no token / bad token on POST is 401; bad JSON is 400; oversized body is 413', async () => {
  const deps = makeDeps();
  assert.equal((await call(deps, 'POST', { body: goodBody() })).statusCode, 401);
  assert.equal((await call(deps, 'POST', { token: 'a.b.c', body: goodBody() })).statusCode, 401);
  assert.equal((await call(deps, 'POST', { token: T, body: '{not json' })).statusCode, 400);
  assert.equal((await call(deps, 'POST', { token: T, body: JSON.stringify({ pad: 'x'.repeat(210 * 1024) }) })).statusCode, 413);
});
test('a run that fails its checks is REFUSED with the reasons (a phantom citation is an error)', async () => {
  const deps = makeDeps();
  const body = goodBody(); body.sections[0].prose = 'The strikes raised risk [1], and a later report [99] confirmed it. ' + 'More detail follows. '.repeat(30);
  const r = await call(deps, 'POST', { token: T, body });
  assert.equal(r.statusCode, 422);
  assert.equal(r.json.error, 'checks_failed');
  assert.match(r.json.failures[0].reasons.join(' '), /\[99\]/);
  assert.equal(deps.store.rows.size, 0);
});
test('a long answer that cites nothing is refused (no_citations is an error)', async () => {
  const deps = makeDeps();
  const body = goodBody(); body.sections[0].prose = 'This is a long claim about the world without any citation. '.repeat(15);
  const r = await call(deps, 'POST', { token: T, body });
  assert.equal(r.statusCode, 422);
});
test('a scenario lens without its structured block is refused (schema_invalid)', async () => {
  const deps = makeDeps();
  const body = goodBody(); body.sections[0] = { lensId: 'scenario', mode: 'guided', prose: 'Most likely [1]: talks resume [2].', struct: null, webSources: [] };
  const r = await call(deps, 'POST', { token: T, body });
  assert.equal(r.statusCode, 422);
  assert.match(r.json.failures[0].reasons.join(' '), /structured summary/);
});
test('the sources changed since the run: 409, nothing stored', async () => {
  const deps = makeDeps({ makeFetchers: () => ({ ...makeDeps().makeFetchers(), narrativeThread: async () => ({ data: [] }), threadAnalyses: async () => ({ data: {} }), predictionSnapshot: async () => ({ snapshot: null }) }) });
  const r = await call(deps, 'POST', { token: T, body: goodBody() });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json.error, 'sources_changed');
  assert.equal(deps.store.rows.size, 0);
});
test('the reader\'s own numbering is not trusted: a different citation list is 409', async () => {
  const deps = makeDeps();
  const body = goodBody({ citations: golden.expected.citations.slice(0, 5) });
  assert.equal((await call(deps, 'POST', { token: T, body })).statusCode, 409);
});
test('script markup in the prose and a javascript: web link are stopped before anything is stored', async () => {
  const deps = makeDeps();
  const bad = goodBody(); bad.sections[0].prose = 'ok [1] <script>alert(1)</script>';
  assert.equal((await call(deps, 'POST', { token: T, body: bad })).statusCode, 422);
  const web = goodBody({ }); web.sections[0].mode = 'freeform'; web.sections[0].webSources = [{ n: 1, title: 'x', url: 'javascript:alert(1)' }];
  const r = await call(deps, 'POST', { token: T, body: web });
  assert.equal(r.statusCode, 201);
  assert.equal(deps.store.rows.get(r.json.id).sections[0].webSources[0].url, null);
});
test('GET: a malformed or unknown id is 404 and never touches anything else', async () => {
  const deps = makeDeps();
  assert.equal((await call(deps, 'GET', { query: { id: '../../etc' } })).statusCode, 404);
  assert.equal((await call(deps, 'GET', { query: { id: 'A'.repeat(22) } })).statusCode, 404);
  assert.equal((await call(deps, 'GET', {})).statusCode, 404);
});
test('DELETE: only the owner; a stranger is 403, no token is 401, unknown is 404; the delete is hard', async () => {
  const deps = makeDeps();
  const id = (await call(deps, 'POST', { token: T, body: goodBody() })).json.id;
  assert.equal((await call(deps, 'DELETE', { query: { id } })).statusCode, 401);
  assert.equal((await call(deps, 'DELETE', { query: { id }, token: makeToken({ uid: 'stranger' }) })).statusCode, 403);
  assert.equal(deps.store.rows.has(id), true);
  assert.equal((await call(deps, 'DELETE', { query: { id }, token: T })).statusCode, 204);
  assert.equal(deps.store.rows.has(id), false);
  assert.equal((await call(deps, 'GET', { query: { id } })).statusCode, 404);
  assert.equal((await call(deps, 'DELETE', { query: { id: 'B'.repeat(22) }, token: T })).statusCode, 404);
});
test('other methods are 405', async () => {
  assert.equal((await call(makeDeps(), 'PUT', { token: T })).statusCode, 405);
});

test('the byte-identical shared copies match the frontend files (also guarded by scripts/check-shared-sync.mjs)', () => {
  const FE = new URL('../../../../../global-perspectives-starter/frontend/src/', import.meta.url);
  const pairs = [['analysisValidator.js', 'features/analysis-studio/lib/'], ['analysisStruct.js', 'features/analysis-studio/lib/'], ['webCitations.js', 'features/analysis-studio/lib/'],
    ['analysisContext.js', 'features/analysis-studio/lib/'], ['analysisPrompt.js', 'features/analysis-studio/lib/'], ['driftNote.js', 'shared/lib/'], ['dropRedatedRepeats.js', 'shared/lib/']];
  for (const [f, dir] of pairs) {
    assert.equal(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), fs.readFileSync(new URL(dir + f, FE), 'utf8'), f);
  }
  assert.equal(fs.readFileSync(new URL('./fixtures/contextGolden.json', import.meta.url), 'utf8'), fs.readFileSync(new URL('features/analysis-studio/__tests__/fixtures/contextGolden.json', FE), 'utf8'));
});
