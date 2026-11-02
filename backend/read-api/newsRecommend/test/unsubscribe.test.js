'use strict';
// newsRecommend: the public one-click unsubscribe that every email links to (the token is the only auth). The `digest` happy path, a wrong
// token and an unknown uid are already checked by newsEmailSender/src/test-sender.js (which no script runs); this file covers the other
// kinds, the request shapes (GET link, RFC 8058 POST, JSON POST), missing params, and the exact fields written.
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, get, noCors, fb } = require('./harness');

const h = harness();
test.before(() => fb.installCerts());
test.after(() => fb.restoreFetch());
test.beforeEach(() => { for (const m of ['info', 'warn', 'error']) test.mock.method(console, m, () => {}); });
test.afterEach(() => { test.mock.restoreAll(); h.stop(); });

const user = { uid: 'u-abc', email: 'me@example.com', unsubToken: 'tok-1', breakingOptIn: true, digestOptIn: true, driftOptIn: true };
const link = (kind, extra = {}) => ({ action: 'unsubscribe', uid: 'u-abc', token: 'tok-1', ...(kind === undefined ? {} : { kind }), ...extra });
const isHtml = (res) => { assert.equal(res.statusCode, 200); assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8'); noCors(res); };

// The flags a single UpdateItem sets, read from its placeholders (`#k0 = :v0`), plus the raw input.
function written() {
  const updates = h.sent.filter((s) => s.name === 'UpdateCommand');
  assert.equal(updates.length, 1, 'exactly one UpdateItem');
  const { input } = updates[0];
  const flags = {};
  for (const [k, n] of Object.entries(input.ExpressionAttributeNames)) flags[n] = input.ExpressionAttributeValues[`:v${k.slice(2)}`];
  return { input, flags };
}

test('kind=breaking switches off only breaking alerts, records unsubbedAt, and says so', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await get(handler, link('breaking'));
  isHtml(res);
  assert.match(res.body, /<h1[^>]*>Unsubscribed<\/h1>/);
  assert.match(res.body, /unsubscribed from breaking alerts\. Your other preferences are unchanged/);
  const { input, flags } = written();
  assert.deepEqual(flags, { breakingOptIn: false });
  assert.equal(input.TableName, 'PrefsT');
  assert.deepEqual(input.Key, { uid: 'u-abc' });
  assert.equal(input.UpdateExpression, 'SET #k0 = :v0, unsubbedAt = :now');
  assert.deepEqual(h.sent[0], { name: 'GetCommand', input: { TableName: 'PrefsT', Key: { uid: 'u-abc' } } });
});

test('kind=drift switches off only country change-alerts', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await get(handler, link('drift'));
  isHtml(res);
  assert.match(res.body, /unsubscribed from country change-alerts\./);
  assert.deepEqual(written().flags, { driftOptIn: false });
});

test('kind=all (and no kind at all) switches off digest, breaking and drift together', async () => {
  for (const kind of ['all', undefined]) {
    const handler = h.load();
    h.respond = () => ({ Item: user });
    const res = await get(handler, link(kind));
    isHtml(res);
    assert.match(res.body, /unsubscribed from all emails\./, String(kind));
    const { input, flags } = written();
    assert.deepEqual(flags, { digestOptIn: false, breakingOptIn: false, driftOptIn: false });
    assert.equal(input.UpdateExpression, 'SET #k0 = :v0, #k1 = :v1, #k2 = :v2, unsubbedAt = :now');
  }
});

test('an unrecognised kind falls back to the weekly brief only, never to "all"', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await get(handler, link('weekly-newsletter'));
  isHtml(res);
  assert.match(res.body, /unsubscribed from the weekly brief\./);
  assert.deepEqual(written().flags, { digestOptIn: false });
});

test('the write never sets a flag to true and touches no other attribute (consent, token and email stay)', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  await get(handler, link('all'));
  const { input } = written();
  assert.ok(Object.values(input.ExpressionAttributeValues).every((x) => x !== true));
  assert.deepEqual(Object.keys(input.ExpressionAttributeValues).sort(), [':now', ':v0', ':v1', ':v2']);
  assert.ok(!/unsubToken|consentAt|email|followedCountries/.test(input.UpdateExpression + JSON.stringify(input.ExpressionAttributeNames)));
});

test('the Key written is the stored row\'s uid', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: { ...user, uid: 'u-from-row' } });
  await get(handler, link('breaking'));
  assert.deepEqual(written().input.Key, { uid: 'u-from-row' });
});

test('missing uid or token: "Invalid link" page, no DynamoDB access, nothing written', async () => {
  const handler = h.load();
  for (const q of [{ action: 'unsubscribe' }, { action: 'unsubscribe', uid: 'u-abc' }, { action: 'unsubscribe', token: 'tok-1' }, { action: 'unsubscribe', uid: '', token: '' }]) {
    const res = await get(handler, q);
    isHtml(res);
    assert.match(res.body, /Invalid link/);
    assert.match(res.body, /missing its parameters/);
  }
  assert.deepEqual(h.sent, []);
});

test('a row without an unsubToken can never be unsubscribed by guessing: "Link not recognized" and no write', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: { uid: 'u-abc', digestOptIn: true } });
  for (const token of ['x', 'undefined', 'null', '']) {
    const res = await get(handler, link('all', { token }));
    isHtml(res);
    assert.match(res.body, /Invalid link|Link not recognized/, token);
  }
  assert.deepEqual(h.sent.filter((s) => s.name === 'UpdateCommand'), []);
});

test('a mismatched token for another kind is refused too, and leaves the opt-ins on', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  for (const kind of ['breaking', 'drift', 'all']) {
    const res = await get(handler, link(kind, { token: 'tok-2' }));
    assert.match(res.body, /Link not recognized/, kind);
  }
  assert.deepEqual(h.sent.filter((s) => s.name === 'UpdateCommand'), []);
});

test('RFC 8058 one-click POST: the uid, token and kind ride in the query string while the body is the form field "List-Unsubscribe=One-Click"', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await handler({
    requestContext: { http: { method: 'POST' } }, headers: {}, queryStringParameters: link('breaking'),
    body: 'List-Unsubscribe=One-Click', isBase64Encoded: false,
  });
  isHtml(res);
  assert.match(res.body, /Unsubscribed/);
  assert.deepEqual(written().flags, { breakingOptIn: false });
});

test('a JSON POST works with the params under payload, or at the top level of the body', async () => {
  for (const body of [
    { action: 'unsubscribe', payload: { uid: 'u-abc', token: 'tok-1', kind: 'drift' } },
    { action: 'unsubscribe', uid: 'u-abc', token: 'tok-1', payload: { kind: 'drift' } },
  ]) {
    const handler = h.load();
    h.respond = () => ({ Item: user });
    const res = await handler({ requestContext: { http: { method: 'POST' } }, headers: {}, body: JSON.stringify(body) });
    isHtml(res);
    assert.match(res.body, /country change-alerts/);
    assert.deepEqual(written().flags, { driftOptIn: false });
  }
});

test('no sign-in is needed, and a stale or junk Authorization header does not get in the way', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await get(handler, link('breaking'), { authorization: 'Bearer expired.or.junk' });
  isHtml(res);
  assert.match(res.body, /Unsubscribed/);
  assert.equal(written().input.Key.uid, 'u-abc');
});

test('the confirmation page links back to the site and carries no CORS header', async () => {
  const handler = h.load();
  h.respond = () => ({ Item: user });
  const res = await get(handler, link('breaking'));
  assert.match(res.body, /href="https:\/\/globalperspective\.net\/"/);
  noCors(res);
  const bad = await get(handler, link('breaking', { token: 'nope' }));
  noCors(bad);
});
