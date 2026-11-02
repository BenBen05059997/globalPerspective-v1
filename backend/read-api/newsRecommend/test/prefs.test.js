'use strict';
// newsRecommend: the signed-in notification-preference actions (get_prefs, set_prefs) and the member-only follow_country / unfollow_country.
// These write the consent flags and the unsubscribe token that every email depends on, and the paywall for country following (fail-closed).
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, authed, post, json, noCors, USERS_TABLE, ENV, fb } = require('./harness');

const h = harness();
test.before(() => fb.installCerts());
test.after(() => fb.restoreFetch());
test.beforeEach(() => { for (const m of ['info', 'warn', 'error']) test.mock.method(console, m, () => {}); });
test.afterEach(() => { test.mock.restoreAll(); h.stop(); });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREF_KEYS = ['breakingOptIn', 'digestCadence', 'digestOptIn', 'driftOptIn', 'followedCountries'];
const row = { uid: 'user-1', email: 'me@example.com', unsubToken: 'secret-token', consentAt: '2026-10-01T00:00:00Z', breakingOptIn: true, digestOptIn: 1, digestCadence: 'daily', followedCountries: new Set(['Japan', 'Brazil']) };

test('get_prefs and set_prefs without a valid token are 401 sign_in_required and touch nothing', async () => {
  const handler = h.load();
  const bad = [{}, { authorization: 'Bearer junk.junk.junk' }, { authorization: fb.bearer({}, { key: fb.otherKey }) }, { authorization: fb.bearer({ exp: fb.nowS() - 5 }) }];
  for (const action of ['get_prefs', 'set_prefs', 'follow_country', 'unfollow_country']) {
    for (const headers of bad) {
      const res = await post(handler, action, { digestOptIn: true, country: 'Japan' }, headers);
      assert.equal(res.statusCode, 401, action);
      assert.deepEqual(json(res), { ok: false, error: 'sign_in_required' });
      noCors(res);
    }
  }
  assert.deepEqual(h.sent, []);
});

test('get_prefs reads the caller\'s own row and returns exactly the five preference fields, normalised', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: row });
  const res = await post(handler, 'get_prefs', { uid: 'someone-else' });
  assert.equal(res.statusCode, 200);
  noCors(res);
  assert.deepEqual(h.sent.map((s) => [s.name, s.input]), [['GetCommand', { TableName: 'PrefsT', Key: { uid: 'user-1' } }]]);
  const { ok, prefs } = json(res);
  assert.equal(ok, true);
  assert.deepEqual(Object.keys(prefs).sort(), PREF_KEYS);
  assert.deepEqual(prefs, { breakingOptIn: true, digestOptIn: true, digestCadence: 'daily', driftOptIn: false, followedCountries: ['Brazil', 'Japan'] }); // Set -> sorted array, 1 -> true
  assert.ok(!res.body.includes('secret-token') && !res.body.includes('me@example.com'), 'unsubToken and email are never returned');
});

test('get_prefs for a user with no row, or an unknown cadence, falls back to the opt-in-off defaults', async () => {
  const handler = h.load();
  const defaults = { breakingOptIn: false, digestOptIn: false, digestCadence: 'weekly', driftOptIn: false, followedCountries: [] };
  assert.deepEqual(json(await post(handler, 'get_prefs')).prefs, defaults);
  h.respond = () => ({ Item: { uid: 'user-1', digestCadence: 'hourly' } });
  assert.deepEqual(json(await post(handler, 'get_prefs')).prefs, defaults);
});

test('get_prefs uses the token\'s user_id when present, else sub', async () => {
  const handler = h.load();
  await post(handler, 'get_prefs', {}, authed({ user_id: 'uid-from-user_id', sub: 'sub-id' }));
  assert.equal(h.sent[0].input.Key.uid, 'uid-from-user_id');
  const bare = { authorization: fb.bearer({ sub: 'only-sub' }) };
  await post(handler, 'get_prefs', {}, bare);
  assert.equal(h.sent[1].input.Key.uid, 'only-sub');
});

test('with no USER_PREFS_TABLE, get_prefs answers the defaults and set_prefs fails with 500', async () => {
  const handler = h.load({ FIREBASE_PROJECT_ID: fb.PROJECT });
  const res = await post(handler, 'get_prefs');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(json(res).prefs.followedCountries, []);
  const set = await post(handler, 'set_prefs', { digestOptIn: true });
  assert.equal(set.statusCode, 500);
  assert.deepEqual(json(set), { ok: false, error: 'internal_error' });
  assert.deepEqual(h.sent, []);
});

test('a DynamoDB failure in get_prefs or set_prefs is 500 internal_error (no details leaked)', async () => {
  const handler = h.load();
  h.respond = () => { throw new Error('AccessDeniedException: arn:aws:iam::123:role/x'); };
  for (const action of ['get_prefs', 'set_prefs']) {
    const res = await post(handler, action, { digestOptIn: true });
    assert.equal(res.statusCode, 500, action);
    assert.deepEqual(json(res), { ok: false, error: 'internal_error' });
  }
});

test('set_prefs turning an email on stamps consent once and mints a stable unsubscribe token, never overwriting either', async () => {
  const handler = h.load();
  h.respond = (name) => (name === 'GetCommand' ? { Item: { ...row, digestCadence: 'daily', digestOptIn: true } } : {});
  const res = await post(handler, 'set_prefs', { digestOptIn: true, digestCadence: 'daily' }, authed({ email: 'me@example.com' }));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(h.sent.map((s) => s.name), ['UpdateCommand', 'GetCommand']); // write, then read back
  const { input } = h.sent[0];
  assert.equal(input.TableName, 'PrefsT');
  assert.deepEqual(input.Key, { uid: 'user-1' });
  assert.equal(input.UpdateExpression,
    'SET updatedAt = :now, digestOptIn = :d, digestCadence = :c, email = if_not_exists(email, :e), consentAt = if_not_exists(consentAt, :now), unsubToken = if_not_exists(unsubToken, :tok)');
  const v = input.ExpressionAttributeValues;
  assert.match(v[':tok'], UUID);
  assert.deepEqual({ ...v, ':tok': 'T', ':now': 'N' }, { ':now': 'N', ':d': true, ':c': 'daily', ':e': 'me@example.com', ':tok': 'T' });
  assert.deepEqual(Object.keys(json(res).prefs).sort(), PREF_KEYS);
  assert.equal(json(res).prefs.digestCadence, 'daily');
});

test('each of breakingOptIn, digestOptIn and driftOptIn set to true triggers the consent stamp and token', async () => {
  const handler = h.load();
  for (const [field, placeholder] of [['breakingOptIn', ':b'], ['digestOptIn', ':d'], ['driftOptIn', ':dr']]) {
    h.sent.length = 0;
    await post(handler, 'set_prefs', { [field]: true });
    const { UpdateExpression: expr, ExpressionAttributeValues: v } = h.sent[0].input;
    assert.ok(expr.includes(`${field} = ${placeholder}`), expr);
    assert.ok(expr.includes('consentAt = if_not_exists(consentAt, :now)') && expr.includes('unsubToken = if_not_exists(unsubToken, :tok)'), expr);
    assert.equal(v[placeholder], true);
    assert.match(v[':tok'], UUID);
  }
});

test('set_prefs turning things off (or only changing cadence) writes no consent stamp and no token', async () => {
  const handler = h.load();
  await post(handler, 'set_prefs', { breakingOptIn: false, digestOptIn: false, driftOptIn: false });
  assert.equal(h.sent[0].input.UpdateExpression, 'SET updatedAt = :now, breakingOptIn = :b, digestOptIn = :d, driftOptIn = :dr');
  assert.deepEqual(Object.keys(h.sent[0].input.ExpressionAttributeValues).sort(), [':b', ':d', ':dr', ':now']);
  h.sent.length = 0;
  await post(handler, 'set_prefs', { digestCadence: 'weekly' });
  assert.equal(h.sent[0].input.UpdateExpression, 'SET updatedAt = :now, digestCadence = :c');
});

test('set_prefs ignores values that are not real booleans or a known cadence; the email is only stored if not already there', async () => {
  const handler = h.load();
  await post(handler, 'set_prefs', { breakingOptIn: 'true', digestOptIn: 1, driftOptIn: null, digestCadence: 'monthly', unsubToken: 'chosen-by-client', consentAt: 'x', followedCountries: ['A'] });
  assert.equal(h.sent[0].input.UpdateExpression, 'SET updatedAt = :now');
  assert.deepEqual(Object.keys(h.sent[0].input.ExpressionAttributeValues), [':now']);
  h.sent.length = 0;
  await post(handler, 'set_prefs', undefined, authed({ email: 'a@example.com' }));
  assert.equal(h.sent[0].input.UpdateExpression, 'SET updatedAt = :now, email = if_not_exists(email, :e)');
});

test('no response from the prefs actions carries an Access-Control-* header', async () => {
  const handler = h.load();
  for (const action of ['get_prefs', 'set_prefs', 'follow_country']) noCors(await post(handler, action, { country: 'Japan' }));
  h.respond = () => { throw new Error('x'); };
  noCors(await post(handler, 'get_prefs'));
});

// ── follow_country / unfollow_country: members only ─────────────────────────────────────────────────────────────

const asMember = (tier = 'member') => (name, input) => (input.TableName === USERS_TABLE ? { Item: { tier } } : name === 'GetCommand' ? { Item: row } : {});

test('following is members only: a free, unknown, lapsed or unreadable tier is 403 members_only, fail-closed, and nothing is written', async () => {
  const handler = h.load();
  const tiers = [
    () => ({}),                                              // no user row
    () => ({ Item: { tier: 'free' } }),
    () => ({ Item: { tier: 'pro' } }),                       // anything but exactly "member"
    () => ({ Item: { tier: 'Member' } }),
    () => ({ Item: {} }),
    () => { throw new Error('AccessDeniedException'); },     // lookup failure must not open the gate
  ];
  for (const action of ['follow_country', 'unfollow_country']) {
    for (const answer of tiers) {
      h.sent.length = 0;
      h.respond = answer;
      const res = await post(handler, action, { country: 'Japan' });
      assert.equal(res.statusCode, 403, action);
      assert.deepEqual(json(res), { ok: false, error: 'members_only' });
      noCors(res);
      assert.deepEqual(h.sent.map((s) => s.input.TableName), [USERS_TABLE], 'only the tier lookup runs');
    }
  }
  assert.deepEqual(h.sent[0].input, { TableName: USERS_TABLE, Key: { uid: 'user-1' }, ProjectionExpression: 'tier' });
});

test('a member following a country adds it to the set, defaults drift email on, stamps consent and token without clobbering, and gets prefs back', async () => {
  const handler = h.load();
  h.respond = asMember();
  const res = await post(handler, 'follow_country', { country: '  Japan  ' }, authed({ email: 'me@example.com' }));
  assert.equal(res.statusCode, 200);
  noCors(res);
  assert.deepEqual(h.sent.map((s) => [s.name, s.input.TableName]), [['GetCommand', USERS_TABLE], ['UpdateCommand', 'PrefsT'], ['GetCommand', 'PrefsT']]);
  const { input } = h.sent[1];
  assert.deepEqual(input.Key, { uid: 'user-1' });
  assert.equal(input.UpdateExpression,
    'ADD followedCountries :c SET updatedAt = :now, driftOptIn = if_not_exists(driftOptIn, :true), consentAt = if_not_exists(consentAt, :now), unsubToken = if_not_exists(unsubToken, :tok), email = if_not_exists(email, :e)');
  const v = input.ExpressionAttributeValues;
  assert.ok(v[':c'] instanceof Set);
  assert.deepEqual([...v[':c']], ['Japan']); // trimmed, a DynamoDB string set
  assert.equal(v[':true'], true);
  assert.equal(v[':e'], 'me@example.com');
  assert.match(v[':tok'], UUID);
  assert.deepEqual(json(res).prefs.followedCountries, ['Brazil', 'Japan']);
});

test('follow_country without an email claim writes no email clause, and the country may come from the top-level body', async () => {
  const handler = h.load();
  h.respond = asMember();
  const res = await handler({ requestContext: { http: { method: 'POST' } }, headers: authed(), body: JSON.stringify({ action: 'follow_country', country: 'Brazil' }) });
  assert.equal(res.statusCode, 200);
  const { input } = h.sent[1];
  assert.ok(!input.UpdateExpression.includes('email'));
  assert.deepEqual([...input.ExpressionAttributeValues[':c']], ['Brazil']);
  assert.ok(!(':e' in input.ExpressionAttributeValues));
});

test('unfollow_country by a member removes only that country from the set and stamps updatedAt (no consent, no token, no opt-in change)', async () => {
  const handler = h.load();
  h.respond = asMember();
  const res = await post(handler, 'unfollow_country', { country: 'Japan' });
  assert.equal(res.statusCode, 200);
  const { input } = h.sent[1];
  assert.equal(input.UpdateExpression, 'DELETE followedCountries :c SET updatedAt = :now');
  assert.deepEqual(Object.keys(input.ExpressionAttributeValues).sort(), [':c', ':now']);
  assert.deepEqual([...input.ExpressionAttributeValues[':c']], ['Japan']);
});

test('follow_country with a blank or missing country writes nothing and answers 500 internal_error (current behaviour)', async () => {
  const handler = h.load();
  h.respond = asMember();
  for (const payload of [{}, { country: '' }, { country: '   ' }, undefined]) {
    h.sent.length = 0;
    const res = await post(handler, 'follow_country', payload);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(json(res), { ok: false, error: 'internal_error' });
    assert.deepEqual(h.sent.map((s) => s.input.TableName), [USERS_TABLE], 'only the tier lookup ran, no Update');
  }
});

test('a DynamoDB failure while following is 500 internal_error', async () => {
  const handler = h.load();
  h.respond = (name, input) => { if (name === 'UpdateCommand') throw new Error('boom'); return asMember()(name, input); };
  const res = await post(handler, 'follow_country', { country: 'Japan' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(json(res), { ok: false, error: 'internal_error' });
});
