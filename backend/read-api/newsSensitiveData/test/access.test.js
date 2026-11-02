'use strict';
// Access control of the main read API: the CORS headers this Lambda emits in code, the OPTIONS preflight, and the member tier that
// caps correction depth. Per CLAUDE.md, a function whose code emits Access-Control-Allow-Origin must have an EMPTY Function-URL CORS
// config, so these tests pin exactly which origins get which headers: a change to the header logic has to change a test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadProxy, invoke } = require('./helpers/proxyHarness');

const ALLOWED = [
  'https://benben05059997.github.io',
  'https://benben05059997.github.io/GlobalPerspective',
  'https://globalperspective.net',
  'https://www.globalperspective.net',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const FALLBACK = ALLOWED[0]; // what a caller from any other origin (or none) is answered with
const ACAO = 'Access-Control-Allow-Origin';

const topicsOk = async () => ({ Item: { id: 'latest', updatedAt: new Date().toISOString(), topics: [] } });
const acaoOf = async (origin, send = topicsOk) => {
  const { handler } = loadProxy({ send });
  return (await invoke(handler, { action: 'topics', headers: origin === undefined ? {} : { origin } })).headers[ACAO];
};

test('every allow-listed origin is echoed back', async () => {
  for (const origin of ALLOWED) assert.equal(await acaoOf(origin), origin, origin);
});

test('the match ignores case but the origin is echoed exactly as the caller sent it', async () => {
  assert.equal(await acaoOf('HTTPS://GlobalPerspective.NET'), 'HTTPS://GlobalPerspective.NET');
});

test('an origin that is not listed gets the first allowed origin, never the caller, never *', async () => {
  for (const origin of ['https://evil.example', 'https://globalperspective.net.evil.example', 'http://globalperspective.net', 'https://globalperspective.net/', 'https://sub.globalperspective.net', 'null', 'http://localhost:3000']) {
    assert.equal(await acaoOf(origin), FALLBACK, origin);
  }
});

test('no Origin header (curl, server-side callers) gets the first allowed origin', async () => {
  assert.equal(await acaoOf(undefined), FALLBACK);
});

test('the origin rule holds on error and refusal responses too (400, 503, 500)', async () => {
  const origin = 'https://www.globalperspective.net';
  const bad = loadProxy();
  const unsupported = await invoke(bad.handler, { action: 'no_such_action', headers: { origin } });
  const missing = await invoke(bad.handler, { action: 'summary', payload: {}, headers: { origin } });
  const miss = await invoke(loadProxy({ send: async () => ({}) }).handler, { action: 'topics', headers: { origin } });
  const failed = await invoke(loadProxy({ send: async () => { throw new Error('boom'); } }).handler, { action: 'topics', headers: { origin } });
  assert.deepEqual([unsupported.status, missing.status, miss.status, failed.status], [400, 400, 503, 500]);
  for (const r of [unsupported, missing, miss, failed]) assert.equal(r.headers[ACAO], origin);
  const evil = await invoke(bad.handler, { action: 'no_such_action', headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers[ACAO], FALLBACK);
});

test('a normal response carries exactly the origin header and the JSON content type (no credentials, no wildcard)', async () => {
  const { handler } = loadProxy({ send: topicsOk });
  const r = await invoke(handler, { action: 'topics', headers: { origin: ALLOWED[2] } });
  assert.deepEqual(r.headers, { [ACAO]: ALLOWED[2], 'Content-Type': 'application/json' });
});

test('OPTIONS preflight (HTTP API and REST event shapes): 200, empty body, methods and headers, origin rule applied, no reads', async () => {
  const expected = (origin) => ({
    [ACAO]: origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key',
  });
  const { handler, calls } = loadProxy();
  for (const [origin, want] of [[ALLOWED[3], ALLOWED[3]], ['https://evil.example', FALLBACK], [undefined, FALLBACK]]) {
    const headers = origin === undefined ? {} : { origin };
    const viaRestShape = await handler({ httpMethod: 'OPTIONS', headers });
    const viaFunctionUrl = await handler({ requestContext: { http: { method: 'OPTIONS' } }, headers });
    for (const res of [viaRestShape, viaFunctionUrl]) {
      assert.equal(res.statusCode, 200);
      assert.equal(res.body, '');
      assert.deepEqual(res.headers, expected(want));
    }
  }
  assert.equal(calls.length, 0);
});

test('a GET with ?action= works the same as a POST body (RSS readers and curl)', async () => {
  const { handler } = loadProxy({ send: topicsOk });
  const r = await invoke(handler, { method: 'GET', qs: { action: 'topics' }, headers: { origin: ALLOWED[2] } });
  assert.deepEqual([r.status, r.body.success, r.headers[ACAO]], [200, true, ALLOWED[2]]);
});

test('rss is the deliberate exception: any origin (*), RSS content type, 30 minute cache', async () => {
  const entry = { topicId: 't1', title: 'Story', category: 'politics', regions: ['France'], sources: [{ url: 'https://s.test/a' }], archivedAt: new Date().toISOString() };
  const { handler } = loadProxy({ send: async () => ({ Item: { id: 'today-archive', entries: [entry], updatedAt: entry.archivedAt } }) });
  const r = await invoke(handler, { method: 'GET', qs: { action: 'rss' }, headers: { origin: 'https://evil.example' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.headers, { [ACAO]: '*', 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' });
  assert.match(r.raw, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/);
  assert.match(r.raw, /<title>Story<\/title>/);
});

// ── member tier (resolveTier) ─────────────────────────────────────────────────────────────────────────────────────────
// Observed through country_history and corrections_feed: free callers get the newest correction plus the honest total, members get the
// whole chain. The tier lookup is best-effort and never blocks: anything that goes wrong means free, still a 200.
const note = (i) => ({ asOf: `2026-10-0${i}`, countryName: 'Japan', whyChanged: `w${i}`, changeScore: { from: 1, to: 2, delta: 1 } });
const scanRows = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ PK: 'COUNTRY#Japan', SK: `DRIFT#2026-10-0${i}`, ...note(i) }));
const ddb = (usersGet) => async (name, input) => {
  if (name === 'QueryCommand') {
    const prefix = input.ExpressionAttributeValues[':prefix'];
    if (prefix === 'HISTORY#') return { Items: [{ PK: 'COUNTRY#Japan', SK: 'HISTORY#2026-10-04', dateKey: '2026-10-04', riskLevel: 'high' }] };
    if (prefix === 'DRIFTLOG#') return { Items: [4, 3, 2, 1].map((i) => ({ PK: 'COUNTRY#Japan', SK: `DRIFTLOG#2026-10-0${i}`, ...note(i) })) };
    return { Items: [] };
  }
  if (name === 'ScanCommand') return { Items: scanRows };
  if (name === 'GetCommand' && input.TableName === 'GlobalPerspectiveUserTable') return usersGet(input);
  throw new Error(`unexpected ${name}`);
};
const AUTH = { authorization: 'Bearer good' };
const history = (handler, headers) => invoke(handler, { action: 'country_history', payload: { countryName: 'Japan' }, headers });
const shape = (b) => [b.snapshots.length, b.driftNotes.length, b.driftNotesTotal, b.driftNotesGated];

test('resolveTier: a signed-in member sees the whole correction chain; the lookup is the Users table GetItem by uid', async () => {
  const seen = [];
  const { handler, calls } = loadProxy({
    verify: async (h) => { seen.push(h); return { user_id: 'u1', sub: 'other' }; },
    send: ddb(async () => ({ Item: { tier: 'member' } })),
  });
  const r = await history(handler, AUTH);
  assert.equal(r.status, 200);
  assert.deepEqual(shape(r.body), [1, 4, 4, false]);
  assert.deepEqual(seen, ['Bearer good']);
  const get = calls.find((c) => c.name === 'GetCommand');
  assert.deepEqual(get.input, { TableName: 'GlobalPerspectiveUserTable', Key: { uid: 'u1' }, ProjectionExpression: 'tier' });
});

test('resolveTier: the Users table name and the token claim fallback (sub) are honoured', async () => {
  const { handler, calls } = loadProxy({
    env: { USERS_DDB_TABLE: 'UsersX' },
    verify: async () => ({ sub: 'uid-from-sub' }),
    send: async (name, input) => (name === 'GetCommand' ? { Item: { tier: 'member' } } : ddb(null)(name, input)),
  });
  const r = await history(handler, AUTH);
  assert.equal(shape(r.body)[1], 4);
  assert.deepEqual(calls.find((c) => c.name === 'GetCommand').input.Key, { uid: 'uid-from-sub' });
  assert.equal(calls.find((c) => c.name === 'GetCommand').input.TableName, 'UsersX');
});

test('resolveTier: a Bearer header spelled Authorization works the same as authorization', async () => {
  const { handler } = loadProxy({ verify: async () => ({ user_id: 'u1' }), send: ddb(async () => ({ Item: { tier: 'member' } })) });
  assert.equal(shape((await history(handler, { Authorization: 'Bearer good' })).body)[1], 4);
});

test('resolveTier: free callers get the newest correction, the honest total and gated=true, with the snapshots intact', async () => {
  const cases = {
    'no Authorization header': { headers: {}, verify: async () => ({ user_id: 'u1' }), users: async () => ({ Item: { tier: 'member' } }), usersRead: false },
    'token rejected by the verifier': { headers: AUTH, verify: async () => null, users: async () => ({ Item: { tier: 'member' } }), usersRead: false },
    'claims carry no uid': { headers: AUTH, verify: async () => ({ email: 'a@b.c' }), users: async () => ({ Item: { tier: 'member' } }), usersRead: false },
    'tier free': { headers: AUTH, verify: async () => ({ user_id: 'u1' }), users: async () => ({ Item: { tier: 'free' } }), usersRead: true },
    'no Users row': { headers: AUTH, verify: async () => ({ user_id: 'u1' }), users: async () => ({}), usersRead: true },
    'unknown tier value': { headers: AUTH, verify: async () => ({ user_id: 'u1' }), users: async () => ({ Item: { tier: 'Member ' } }), usersRead: true },
    'Users read fails': { headers: AUTH, verify: async () => ({ user_id: 'u1' }), users: async () => { throw new Error('ddb down'); }, usersRead: true },
    'verifier throws': { headers: AUTH, verify: async () => { throw new Error('certs unreachable'); }, users: async () => ({ Item: { tier: 'member' } }), usersRead: false },
  };
  for (const [label, c] of Object.entries(cases)) {
    const { handler, calls } = loadProxy({ verify: c.verify, send: ddb(c.users) });
    const r = await history(handler, c.headers);
    assert.equal(r.status, 200, label);
    assert.deepEqual(shape(r.body), [1, 1, 4, true], label);
    assert.equal(r.body.driftNotes[0].asOf, '2026-10-04', label);
    assert.equal(calls.some((x) => x.name === 'GetCommand'), c.usersRead, label);
  }
});

test('resolveTier: a malformed token goes through the real verifier and ends up free, without any network or Users read', async () => {
  const { handler, calls } = loadProxy({ send: ddb(async () => ({ Item: { tier: 'member' } })) });
  for (const authorization of ['Bearer not-a-jwt', 'Basic abc', 'Bearer a.b.c']) {
    const r = await history(handler, { authorization });
    assert.deepEqual(shape(r.body), [1, 1, 4, true], authorization);
  }
  assert.equal(calls.some((c) => c.name === 'GetCommand'), false);
});

test('corrections_feed: free sees the newest 5 of the full total; a member sees everything up to `limit`', async () => {
  const feed = (handler, headers, payload = {}) => invoke(handler, { action: 'corrections_feed', payload, headers });
  const free = loadProxy({ send: ddb(async () => ({})) });
  const f = await feed(free.handler, {});
  assert.deepEqual([f.status, f.body.success, f.body.notes.length, f.body.total, f.body.gated], [200, true, 5, 8, true]);
  assert.deepEqual(f.body.notes.map((n) => n.asOf), ['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04']);
  assert.deepEqual([f.body.notes[0].scope, f.body.notes[0].name, f.body.notes[0].iso3], ['country', 'Japan', ['JPN']]);

  const member = loadProxy({ verify: async () => ({ user_id: 'u1' }), send: ddb(async () => ({ Item: { tier: 'member' } })) });
  const m = await feed(member.handler, AUTH);
  assert.deepEqual([m.body.notes.length, m.body.total, m.body.gated], [8, 8, false]);
  const limited = await feed(member.handler, AUTH, { limit: 3 });
  assert.deepEqual([limited.body.notes.length, limited.body.total, limited.body.gated], [3, 8, false]);
});

test('country_history and corrections_feed: a failed read is a 500 with a plain error (no partial data), whatever the tier', async () => {
  const { handler } = loadProxy({ send: async () => { throw new Error('boom'); } });
  const a = await history(handler, {});
  const b = await invoke(handler, { action: 'corrections_feed', payload: {} });
  assert.deepEqual([a.status, a.body, b.status, b.body], [500, { success: false, error: 'Query failed' }, 500, { success: false, error: 'Query failed' }]);
  const c = await invoke(handler, { action: 'country_history', payload: {} });
  assert.deepEqual([c.status, c.body.error], [400, 'Missing countryName']);
});
