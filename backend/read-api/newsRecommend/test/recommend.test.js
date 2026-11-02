'use strict';
// newsRecommend: the default `recommend` action, anonymous ("Trending") versus signed in (personalised from saved items, profile cached on the
// prefs row), plus the direct-invoke path the digest cron uses. Ranking maths is covered by src/test-scoring.mjs; this checks the wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, authed, post, json, noCors, fb } = require('./harness');

const h = harness();
test.before(() => fb.installCerts());
test.after(() => fb.restoreFetch());
test.beforeEach(() => { for (const m of ['info', 'warn', 'error']) test.mock.method(console, m, () => {}); });
test.afterEach(() => { test.mock.restoreAll(); h.stop(); });

const now = new Date().toISOString();
const src = (n) => ({ source: `s${n}.com`, url: `https://s${n}.com/a` });
const topics = [
  { topicId: 'T1', threadId: 'thread-iran', title: 'Iran talks', category: 'conflict', regions: ['Iran'], sources: [src(1), src(2), src(3)], archivedAt: now },
  { topicId: 'T2', threadId: 'thread-japan', title: 'Japan election', category: 'politics', regions: ['Japan'], sources: [src(1)], archivedAt: now },
  { topicId: 'T3', threadId: null, title: 'Grain prices', category: 'economy', regions: ['Brazil'], sources: [src(1), src(2)], archivedAt: now },
];
const serve = ({ saved = [], topicList = topics } = {}) => (name, input) => {
  if (input.TableName === 'TopicsT') return { Item: { id: 'latest', topics: topicList } };
  if (input.TableName === 'SavedT') return { Items: saved };
  return {};
};
// The default action reads `limit` from the top level of the body (README: body `{ limit? }`), not from `payload`.
const rec = (handler, body, headers = authed()) => handler({ requestContext: { http: { method: 'POST' } }, headers, body: JSON.stringify(body) });
const tick = () => new Promise((r) => setImmediate(r)); // cacheProfile is fire-and-forget

test('anonymous: ranks the pool as Trending, reads no saved items, writes nothing, and trims each topic to its public fields', async () => {
  const handler = h.load();
  h.respond = serve();
  const res = await post(handler, 'recommend', {}, {});
  assert.equal(res.statusCode, 200);
  noCors(res);
  await tick();
  assert.deepEqual(h.sent.map((s) => [s.name, s.input.TableName, s.input.Key]), [['GetCommand', 'TopicsT', { id: 'latest' }]]);
  const body = json(res);
  assert.equal(body.ok, true);
  assert.equal(body.personalized, false);
  assert.equal(body.count, 3);
  assert.deepEqual(Object.keys(body.items[0]).sort(), ['category', 'personalized', 'regions', 'score', 'sourceCount', 'threadId', 'title', 'topicId']);
  assert.equal(body.items[0].topicId, 'T1'); // most sources, same recency
  assert.equal(body.items[0].sourceCount, 3);
  assert.equal(body.items.every((i) => i.personalized === false), true);
});

test('a token that does not verify is treated as anonymous, not rejected: public data never gates on sign-in', async () => {
  const handler = h.load();
  h.respond = serve();
  for (const authorization of ['Bearer junk.junk.junk', fb.bearer({}, { key: fb.otherKey }), fb.bearer({ exp: fb.nowS() - 5 })]) {
    h.sent.length = 0;
    const res = await post(handler, 'recommend', {}, { authorization });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).personalized, false);
    assert.deepEqual(h.sent.map((s) => s.input.TableName), ['TopicsT']);
  }
});

test('signed in: loads the caller\'s saves, ranks by them, excludes saved threads, and caches the profile on the prefs row', async () => {
  const handler = h.load();
  h.respond = serve({ saved: [
    { uid: 'user-1', savedKey: 'country#Japan', itemType: 'country', itemId: 'Japan' },
    { uid: 'user-1', savedKey: 'thread#thread-iran', itemType: 'thread', itemId: 'thread-iran' },
    { uid: 'user-1', savedKey: 'board#b1', title: 'A board row has no itemType' },
  ] });
  const res = await rec(handler, { limit: 5 }, authed({ email: 'me@example.com' }));
  assert.equal(res.statusCode, 200);
  await tick();
  const body = json(res);
  assert.equal(body.personalized, true);
  assert.deepEqual(body.items.map((i) => i.topicId), ['T2', 'T3'], 'Japan first; the saved Iran thread is not recommended back');
  assert.equal(body.items[0].personalized, true);

  const query = h.sent.find((s) => s.name === 'QueryCommand');
  assert.deepEqual(query.input, { TableName: 'SavedT', KeyConditionExpression: 'uid = :u', ExpressionAttributeValues: { ':u': 'user-1' } });
  const update = h.sent.find((s) => s.name === 'UpdateCommand');
  assert.equal(update.input.TableName, 'PrefsT');
  assert.deepEqual(update.input.Key, { uid: 'user-1' });
  assert.equal(update.input.UpdateExpression, 'SET interestProfile = :p, updatedAt = :now, email = if_not_exists(email, :e)');
  assert.equal(update.input.ExpressionAttributeValues[':e'], 'me@example.com');
  assert.deepEqual(update.input.ExpressionAttributeValues[':p'].countries, { japan: 2, iran: 1 }); // the saved Iran thread contributes its region
  assert.deepEqual(update.input.ExpressionAttributeValues[':p'].threads, ['thread-iran']);
});

test('a signed-in user with no saves gets Trending (personalized false) and the profile cache write has no email clause without an email claim', async () => {
  const handler = h.load();
  h.respond = serve({ saved: [] });
  const res = await post(handler, 'recommend', {}, authed());
  assert.equal(json(res).personalized, false);
  await tick();
  const update = h.sent.find((s) => s.name === 'UpdateCommand');
  assert.equal(update.input.UpdateExpression, 'SET interestProfile = :p, updatedAt = :now');
});

test('a failed profile-cache write never fails the response', async () => {
  const handler = h.load();
  const inner = serve({ saved: [{ itemType: 'country', itemId: 'Japan' }] });
  h.respond = (name, input) => { if (name === 'UpdateCommand') throw new Error('throttled'); return inner(name, input); };
  const res = await post(handler, 'recommend', {}, authed());
  await tick();
  assert.equal(res.statusCode, 200);
  assert.equal(json(res).personalized, true);
});

test('limit is clamped: default 8, at least 1, at most 24; junk falls back to the default', async () => {
  const handler = h.load();
  const many = Array.from({ length: 40 }, (_, i) => ({ topicId: `T${i}`, threadId: `th${i}`, title: `t${i}`, category: 'c', regions: [], sources: [src(1)], archivedAt: now }));
  h.respond = serve({ topicList: many });
  const count = async (limit) => json(await rec(handler, { limit }, {})).count;
  assert.equal(await count(undefined), 8);
  assert.equal(await count(100), 24);
  assert.equal(await count(-5), 1);
  assert.equal(await count(3), 3);
  assert.equal(await count('abc'), 8);
});

test('an empty or missing topic pool is an honest empty list, not an error', async () => {
  const handler = h.load();
  h.respond = (name, input) => (input.TableName === 'TopicsT' ? {} : { Items: [] });
  const res = await post(handler, 'recommend', {}, {});
  assert.equal(res.statusCode, 200);
  assert.deepEqual(json(res), { ok: true, personalized: false, count: 0, items: [] });
});

test('a DynamoDB failure is 500 internal_error with nothing leaked', async () => {
  const handler = h.load();
  h.respond = () => { throw new Error('ResourceNotFoundException: arn:aws:dynamodb:...'); };
  const res = await post(handler, 'recommend', {}, {});
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json(res), { ok: false, error: 'internal_error' });
  noCors(res);
});

test('direct invoke (the digest cron): { uid, limit } returns the plain result object, not an HTTP reply', async () => {
  const handler = h.load();
  h.respond = serve({ saved: [{ itemType: 'country', itemId: 'Brazil' }] });
  const out = await handler({ uid: 'cron-user', email: 'c@example.com', limit: 2 });
  await tick();
  assert.equal(out.statusCode, undefined);
  assert.equal(out.ok, true);
  assert.equal(out.personalized, true);
  assert.equal(out.count, 2);
  assert.equal(out.items[0].topicId, 'T3');
  assert.equal(h.sent.find((s) => s.name === 'QueryCommand').input.ExpressionAttributeValues[':u'], 'cron-user');
});
