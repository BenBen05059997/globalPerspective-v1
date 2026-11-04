'use strict';
// newsSavedItems: per-user save / unsave / list behind a Firebase token. Offline: the AWS SDK is replaced by a fake DynamoDB client that records
// every command, Google's certs by a fake fetch serving a throwaway key (shared/test/firebaseToken.js). The Function-URL CORS config owns CORS,
// so no response may carry an Access-Control-* header.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const fb = require('../../../shared/test/firebaseToken');

const INDEX = path.resolve(__dirname, '../src/index.js');
const ENV = { SAVED_ITEMS_TABLE: 'SavedT', FIREBASE_PROJECT_ID: fb.PROJECT };

let aws; let sent; let respond;
// Load the handler fresh. `respond(commandName, input)` answers each DynamoDB command; every command is logged in `sent` as { name, input }.
function load(env = ENV) {
  if (aws) aws.restore();
  sent = [];
  respond = () => ({});
  aws = stubAws({ ddb: (input, name) => { sent.push({ name, input }); return respond(name, input); } });
  return aws.load(INDEX, { SAVED_ITEMS_TABLE: undefined, FIREBASE_PROJECT_ID: undefined, ...env }).handler;
}

test.before(() => fb.installCerts());
test.after(() => fb.restoreFetch());
test.beforeEach(() => { for (const m of ['info', 'warn', 'error']) test.mock.method(console, m, () => {}); });
test.afterEach(() => { test.mock.restoreAll(); if (aws) { aws.restore(); aws = null; } });

const auth = (claims = {}) => ({ authorization: fb.bearer({ sub: 'user-1', ...claims }) });
const call = (handler, action, payload, headers = auth()) => handler({
  requestContext: { http: { method: 'POST' } }, headers, body: JSON.stringify({ action, payload }),
});
const json = (res) => JSON.parse(res.body);
const noCors = (res) => assert.deepEqual(Object.keys(res.headers).filter((h) => /^access-control-/i.test(h)), [], 'no Access-Control-* header');

test('without a token, or with a token that does not verify: 401 and DynamoDB is never touched', async () => {
  const h = load();
  const bad = [
    {},
    { authorization: 'Bearer not.a.jwt' },
    { authorization: fb.bearer({}, { key: fb.otherKey }) },        // signed by a key Google does not serve
    { authorization: fb.bearer({ exp: fb.nowS() - 10 }) },          // expired
    { authorization: fb.bearer({ aud: 'another-project' }) },       // minted for a different Firebase project
    { authorization: fb.token({ sub: 'user-1' }) },                 // no "Bearer " prefix
  ];
  for (const headers of bad) {
    for (const action of ['save_item', 'unsave_item', 'get_saved_items']) {
      const res = await call(h, action, { itemType: 'thread', itemId: 'a' }, headers);
      assert.equal(res.statusCode, 401, `${action} ${JSON.stringify(headers).slice(0, 40)}`);
      assert.deepEqual(json(res), { success: false, error: 'Sign in required' });
      noCors(res);
    }
  }
  assert.deepEqual(sent, []);
});

test('the Authorization header is accepted in either case', async () => {
  const h = load();
  const res = await call(h, 'save_item', { itemType: 'thread', itemId: 'a' }, { Authorization: fb.bearer({ sub: 'user-9' }) });
  assert.equal(res.statusCode, 200);
  assert.equal(sent[0].input.Item.uid, 'user-9');
});

test('SAVED_ITEMS_TABLE missing: 500 "Server misconfiguration" before any auth or DynamoDB work', async () => {
  const h = load({ FIREBASE_PROJECT_ID: fb.PROJECT });
  const res = await call(h, 'save_item', { itemType: 'thread', itemId: 'a' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json(res), { success: false, error: 'Server misconfiguration' });
  assert.deepEqual(sent, []);
});

test('save_item writes one Put keyed by the token\'s uid and "<type>#<id>", and returns the savedAt it stored', async () => {
  const h = load();
  const meta = { title: 'Iran talks', category: 'conflict' };
  const res = await call(h, 'save_item', { itemType: 'thread', itemId: 'thread-a-1', metadata: meta });
  assert.equal(res.statusCode, 200);
  noCors(res);
  assert.equal(sent.length, 1);
  const { name, input } = sent[0];
  assert.equal(name, 'PutCommand');
  assert.equal(input.TableName, 'SavedT');
  assert.deepEqual(Object.keys(input).sort(), ['Item', 'TableName']); // no ConditionExpression: saving twice just overwrites
  const { savedAt, ...rest } = input.Item;
  assert.deepEqual(rest, { uid: 'user-1', savedKey: 'thread#thread-a-1', itemType: 'thread', itemId: 'thread-a-1', metadata: meta });
  assert.equal(new Date(savedAt).toISOString(), savedAt);
  assert.deepEqual(json(res), { success: true, data: { savedAt } });
});

test('the uid is the token\'s sub: nothing in the body can choose another user\'s row', async () => {
  const h = load();
  await call(h, 'save_item', { uid: 'someone-else', itemType: 'country', itemId: 'Japan' }, auth({ sub: 'me' }));
  await call(h, 'unsave_item', { uid: 'someone-else', itemType: 'country', itemId: 'Japan' }, auth({ sub: 'me' }));
  await call(h, 'get_saved_items', { uid: 'someone-else' }, auth({ sub: 'me' }));
  assert.equal(sent[0].input.Item.uid, 'me');
  assert.equal(sent[1].input.Key.uid, 'me');
  assert.equal(sent[2].input.ExpressionAttributeValues[':uid'], 'me');
});

test('save_item and unsave_item reject a bad itemType or itemId with 400 and write nothing', async () => {
  const h = load();
  const cases = [
    [{ itemId: 'a' }, /itemType is required/],
    [{ itemType: 'board', itemId: 'a' }, /itemType must be one of: thread, country, daily, weekly, pair/],
    [{ itemType: 7, itemId: 'a' }, /itemType is required/],
    [{ itemType: 'thread' }, /itemId is required/],
    [{ itemType: 'thread', itemId: 12 }, /itemId is required/],
    [{ itemType: 'thread', itemId: 'x'.repeat(257) }, /itemId too long \(max 256\)/],
    [{ itemType: 'thread', itemId: 'a#b' }, /itemId cannot contain "#"/],
    [undefined, /itemType is required/],
  ];
  for (const action of ['save_item', 'unsave_item']) {
    for (const [payload, message] of cases) {
      const res = await call(h, action, payload);
      assert.equal(res.statusCode, 400, `${action} ${JSON.stringify(payload)}`);
      const body = json(res);
      assert.equal(body.success, false);
      assert.match(body.error, message);
    }
  }
  assert.deepEqual(sent, []);
});

test('an itemId of exactly 256 characters and every allowed itemType are accepted', async () => {
  const h = load();
  for (const itemType of ['thread', 'country', 'daily', 'weekly', 'pair']) {
    assert.equal((await call(h, 'save_item', { itemType, itemId: 'x'.repeat(256) })).statusCode, 200, itemType);
  }
  assert.equal(sent.length, 5);
});

test('metadata is stored when it is a plain object within 4096 characters, else replaced by {} (the item is still saved)', async () => {
  const h = load();
  const stored = async (metadata) => {
    sent.length = 0;
    const res = await call(h, 'save_item', { itemType: 'thread', itemId: 'a', metadata });
    assert.equal(res.statusCode, 200);
    return sent[0].input.Item.metadata;
  };
  const room = 4096 - JSON.stringify({ x: '' }).length;
  const atCap = { x: 'a'.repeat(room) };
  assert.equal(JSON.stringify(atCap).length, 4096);
  assert.deepEqual(await stored(atCap), atCap);
  assert.deepEqual(await stored({ x: 'a'.repeat(room + 1) }), {}); // one over
  assert.deepEqual(await stored(['a', 'b']), {});
  assert.deepEqual(await stored('a string'), {});
  assert.deepEqual(await stored(null), {});
  assert.deepEqual(await stored(undefined), {});
});

test('unsave_item sends one Delete for the exact key and answers 200', async () => {
  const h = load();
  const res = await call(h, 'unsave_item', { itemType: 'pair', itemId: 'Iran|Israel' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(json(res), { success: true });
  noCors(res);
  assert.deepEqual(sent, [{ name: 'DeleteCommand', input: { TableName: 'SavedT', Key: { uid: 'user-1', savedKey: 'pair#Iran|Israel' } } }]);
});

test('get_saved_items with no type queries the user\'s partition and excludes board# rows; the reply drops uid and savedKey and lists newest first', async () => {
  const h = load();
  respond = () => ({ Items: [
    { uid: 'user-1', savedKey: 'thread#old', itemType: 'thread', itemId: 'old', metadata: {}, savedAt: '2026-10-01T00:00:00.000Z' },
    { uid: 'user-1', savedKey: 'country#Japan', itemType: 'country', itemId: 'Japan', metadata: { n: 1 }, savedAt: '2026-10-03T00:00:00.000Z' },
    { uid: 'user-1', savedKey: 'daily#d', itemType: 'daily', itemId: 'd', metadata: {} }, // no savedAt sorts last
    { uid: 'user-1', savedKey: 'thread#new', itemType: 'thread', itemId: 'new', metadata: {}, savedAt: '2026-10-02T00:00:00.000Z' },
    { uid: 'user-1', savedKey: 'board#b1', title: 'My board', savedAt: '2026-10-09T00:00:00.000Z' },
  ] });
  const res = await call(h, 'get_saved_items', {});
  assert.equal(res.statusCode, 200);
  noCors(res);
  assert.deepEqual(sent.map((s) => s.name), ['QueryCommand']);
  assert.deepEqual(sent[0].input, {
    TableName: 'SavedT',
    KeyConditionExpression: 'uid = :uid',
    ExpressionAttributeValues: { ':uid': 'user-1' },
    Limit: 500,
  });
  assert.ok(!('FilterExpression' in sent[0].input), 'savedKey is the sort key: DynamoDB rejects a filter on it');
  const { data } = json(res);
  assert.deepEqual(data.map((i) => i.itemId), ['Japan', 'new', 'old', 'd']);
  for (const item of data) assert.ok(!('uid' in item) && !('savedKey' in item));
});

test('board# rows filling the first page do not eat the limit: the next page is read and its saves are listed', async () => {
  const h = load();
  const pages = [
    { Items: Array.from({ length: 500 }, (_, i) => ({ uid: 'user-1', savedKey: `board#b${i}`, title: `B${i}` })), LastEvaluatedKey: { uid: 'user-1', savedKey: 'board#b499' } },
    { Items: [{ uid: 'user-1', savedKey: 'thread#t1', itemType: 'thread', itemId: 't1', savedAt: '2026-10-01T00:00:00.000Z' }] },
  ];
  respond = () => pages.shift();
  const { data } = json(await call(h, 'get_saved_items', {}));
  assert.deepEqual(data.map((i) => i.itemId), ['t1']);
  assert.equal(sent.length, 2);
  assert.ok(!('ExclusiveStartKey' in sent[0].input));
  assert.deepEqual(sent[1].input.ExclusiveStartKey, { uid: 'user-1', savedKey: 'board#b499' });
  for (const s of sent) assert.ok(!('FilterExpression' in s.input));
});

test('paging stops at 500 saves, and at 10 pages when the table keeps answering with more', async () => {
  const h = load();
  const saves = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ uid: 'user-1', savedKey: `thread#t${from + i}`, itemType: 'thread', itemId: `t${from + i}` }));
  const pages = [{ Items: saves(300), LastEvaluatedKey: { k: 1 } }, { Items: saves(300, 300), LastEvaluatedKey: { k: 2 } }, { Items: saves(300, 600) }];
  respond = () => pages.shift();
  let res = json(await call(h, 'get_saved_items', {}));
  assert.equal(res.data.length, 500);
  assert.equal(sent.length, 2);

  sent.length = 0;
  respond = () => ({ Items: [{ uid: 'user-1', savedKey: 'board#b' }], LastEvaluatedKey: { k: 1 } });
  res = json(await call(h, 'get_saved_items', {}));
  assert.deepEqual(res, { success: true, data: [] });
  assert.equal(sent.length, 10);
});

test('get_saved_items with a type narrows by key prefix, adds no filter, and validates the type (boards cannot be listed here)', async () => {
  const h = load();
  respond = () => ({ Items: [{ uid: 'user-1', savedKey: 'country#Japan', itemType: 'country', itemId: 'Japan', savedAt: '2026-10-03T00:00:00.000Z' }] });
  const res = await call(h, 'get_saved_items', { itemType: 'country' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(sent[0].input, {
    TableName: 'SavedT',
    KeyConditionExpression: 'uid = :uid AND begins_with(savedKey, :prefix)',
    ExpressionAttributeValues: { ':uid': 'user-1', ':prefix': 'country#' },
    Limit: 500,
  });
  sent.length = 0;
  const bad = await call(h, 'get_saved_items', { itemType: 'board' });
  assert.equal(bad.statusCode, 400);
  assert.match(json(bad).error, /itemType must be one of/);
  assert.deepEqual(sent, []);
});

test('get_saved_items answers an empty list when the user has no rows', async () => {
  const h = load();
  respond = () => ({});
  const res = await call(h, 'get_saved_items');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(json(res), { success: true, data: [] });
});

test('a DynamoDB failure is a 500 with a plain message (no internals leaked) for each action', async () => {
  const h = load();
  respond = () => { throw new Error('ProvisionedThroughputExceeded: table arn:aws:...'); };
  const expected = { save_item: 'Save failed', unsave_item: 'Unsave failed', get_saved_items: 'Load failed' };
  for (const [action, error] of Object.entries(expected)) {
    const res = await call(h, action, { itemType: 'thread', itemId: 'a' });
    assert.equal(res.statusCode, 500, action);
    assert.deepEqual(json(res), { success: false, error });
  }
});

test('an unknown action, an invalid JSON body and an empty body are 400s; an object body is accepted as it is', async () => {
  const h = load();
  const post = (extra) => h({ requestContext: { http: { method: 'POST' } }, headers: auth(), ...extra });
  let res = await call(h, 'delete_everything', {});
  assert.equal(res.statusCode, 400);
  assert.deepEqual(json(res), { success: false, error: 'Unsupported action' });
  res = await post({ body: '{not json' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(json(res), { success: false, error: 'Invalid JSON body' });
  res = await post({ body: '' });
  assert.equal(res.statusCode, 400);
  assert.equal(json(res).error, 'Unsupported action');
  assert.deepEqual(sent, []);
  res = await post({ body: { action: 'unsave_item', payload: { itemType: 'thread', itemId: 'a' } } });
  assert.equal(res.statusCode, 200);
  assert.equal(sent.length, 1);
});

test('OPTIONS is answered 200 with an empty body, no auth and no Access-Control-* header (the Function URL config owns CORS)', async () => {
  const h = load();
  for (const event of [{ requestContext: { http: { method: 'OPTIONS' } } }, { httpMethod: 'OPTIONS' }]) {
    const res = await h(event);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '');
    noCors(res);
  }
  assert.deepEqual(sent, []);
});

test('no response on any path carries an Access-Control-* header (success, validation, 401, 500, 502)', async () => {
  const h = load();
  const responses = [
    await call(h, 'save_item', { itemType: 'thread', itemId: 'a' }),
    await call(h, 'save_item', { itemType: 'nope', itemId: 'a' }),
    await call(h, 'get_saved_items', {}, {}),
    await h({ requestContext: { http: { method: 'POST' } }, headers: auth(), body: '{' }),
    await h({ requestContext: { http: { method: 'POST' } }, get headers() { throw new Error('boom'); } }),
  ];
  assert.deepEqual(responses.map((r) => r.statusCode), [200, 400, 401, 400, 502]);
  for (const r of responses) noCors(r);
  assert.equal(json(responses[4]).error, 'boom');
  respond = () => { throw new Error('x'); };
  const failed = await call(h, 'save_item', { itemType: 'thread', itemId: 'a' });
  assert.equal(failed.statusCode, 500);
  noCors(failed);
});
