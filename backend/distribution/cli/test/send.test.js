'use strict';
// Run: node --test "backend/distribution/cli/test/*.test.js"
// breaking/send.js emails one stored alert draft through Resend and marks the row sent. Run as a child process against a fake `aws`
// and a preloaded fake fetch (cliHarness.js): no AWS, no network, no real key.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('./cliHarness');

const TABLE = 'GlobalPerspectiveBreakingAlerts';
const KEY = 're_test_fake_key_123';

const alert = (key, over = {}) => ({
  alertKey: key, status: 'confirmed', title: `Story ${key}`,
  draft: { subject: `Subject ${key}`, html: `<p>html ${key}</p>`, text: `text ${key}` }, ...over,
});
const send = (args, o = {}) => run('send.js', { args, fetch: true, env: { RESEND_API_KEY: KEY }, ...o });
const updates = (r) => r.awsCalls.filter((c) => c.op === 'update-item');

test('a confirmed alert is posted to Resend once, with the bearer key, the stored subject / text / html, and the given recipient and sender', async () => {
  const r = await send(['k1', 'ops@example.test', 'GP <alerts@example.test>'], { items: [alert('k1')] });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.fetchCalls.length, 1);
  const f = r.fetchCalls[0];
  assert.equal(f.url, 'https://api.resend.com/emails');
  assert.equal(f.method, 'POST');
  assert.equal(f.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(f.body, { from: 'GP <alerts@example.test>', to: ['ops@example.test'], subject: 'Subject k1', text: 'text k1', html: '<p>html k1</p>' });
  assert.match(r.stdout, /✓ Sent \(id: em_fake_1\)/);
  assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY), 'the API key is never printed');
  const get = r.awsCalls.find((c) => c.op === 'get-item');
  assert.equal(get.flags['table-name'], TABLE);
  assert.equal(get.flags.region, 'ap-northeast-1');
  assert.deepEqual(JSON.parse(get.flags.key), { alertKey: { S: 'k1' } });
});

test('afterwards the row is marked sent: update-item on the alerts table, keyed by alertKey, setting sent=true and sentAt', async () => {
  const r = await send(['k1', 'ops@example.test'], { items: [alert('k1')] });
  assert.equal(updates(r).length, 1);
  const u = updates(r)[0];
  assert.equal(u.flags['table-name'], TABLE);
  assert.deepEqual(JSON.parse(u.flags.key), { alertKey: { S: 'k1' } });
  assert.equal(u.flags['update-expression'], 'SET #s = :sent, sent = :true, sentAt = :now');
  assert.deepEqual(u.names, { '#s': 'status' });
  assert.equal(u.values[':sent'].S, 'sent');
  assert.deepEqual(u.values[':true'], { BOOL: true });
  assert.ok(Math.abs(Date.now() - Date.parse(u.values[':now'].S)) < 60000);
});

// A confirmed alert is the public one (newsRecommend list_alerts / get_alert show status 'confirmed' only, and newsEmailSender's breaking
// mode selects status 'confirmed' with no emailedAt). send.js writes status 'sent' after sending, which makes the alert disappear from
// both. See the "Bugs found" section of the PR.
test('sending a confirmed alert leaves it public',
  { skip: 'BUG: send.js:92 sets status=sent on a confirmed alert, but readers publish status=confirmed only (newsRecommend index.js:253,293)' },
  async () => {
    const r = await send(['pub', 'ops@example.test'], { items: [alert('pub')] });
    const u = updates(r)[0];
    assert.notEqual(u.values[':sent'].S, 'sent');
  });

test('a proposed alert is refused without --force: nothing is sent and nothing is written', async () => {
  const r = await send(['p1'], { items: [alert('p1', { status: 'proposed' })] });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /status is "proposed", not "confirmed"/);
  assert.equal(r.fetchCalls.length, 0);
  assert.equal(updates(r).length, 0);
});

test('"sent" and "rejected" rows are refused too', async () => {
  for (const status of ['sent', 'rejected']) {
    const r = await send(['x'], { items: [alert('x', { status })] });
    assert.equal(r.code, 1, status);
    assert.equal(r.fetchCalls.length, 0, status);
  }
});

test('--force sends a proposed alert (the "just me first" test) and says it was forced', async () => {
  const r = await send(['p1', 'me@example.test', '--force'], { items: [alert('p1', { status: 'proposed' })] });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.fetchCalls.length, 1);
  assert.deepEqual(r.fetchCalls[0].body.to, ['me@example.test']);
  assert.match(r.stdout, /status: proposed, forced/);
});

test('an alert already sent=true is not sent again without --force, and is with it', async () => {
  const items = [alert('d1', { sent: true })];
  const blocked = await send(['d1'], { items });
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /already sent/);
  assert.equal(blocked.fetchCalls.length, 0);

  const forced = await send(['d1', '--force'], { items });
  assert.equal(forced.code, 0, forced.stderr);
  assert.equal(forced.fetchCalls.length, 1);
});

test('usage and key problems stop before any AWS or Resend call', async () => {
  let r = await send([], { items: [alert('k')] });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Usage:/);

  r = await run('send.js', { args: ['k'], fetch: true, items: [alert('k')] }); // no RESEND_API_KEY
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Set your key first/);
  assert.equal(r.awsCalls.length, 0);
  assert.equal(r.fetchCalls.length, 0);
});

test('an unknown alertKey, or a row with no usable draft, is refused', async () => {
  let r = await send(['nope'], { items: [alert('k')] });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no alert found for alertKey "nope"/);

  r = await send(['nodraft'], { items: [alert('nodraft', { draft: { subject: 'S' } })] });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no usable draft/);
  assert.equal(r.fetchCalls.length, 0);
});

test('when Resend rejects the send, the CLI exits 1 and the row is NOT marked sent', async () => {
  const r = await send(['k1'], { items: [alert('k1')], fetchStatus: 500 });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Resend send failed \(500\)/);
  assert.equal(updates(r).length, 0);
  assert.equal(r.table[0].status, 'confirmed');
});

test('when marking sent fails after a successful send, the CLI warns but still exits 0 (the email did go out)', async () => {
  const r = await send(['k1'], { items: [alert('k1')], fail: 'update-item' });
  assert.equal(r.code, 0);
  assert.equal(r.fetchCalls.length, 1);
  assert.match(r.stderr + r.stdout, /sent, but failed to mark status=sent/);
});

test('when the alert cannot be read the CLI exits 1 without sending', async () => {
  const r = await send(['k1'], { items: [alert('k1')], fail: 'get-item' });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /could not read k1/);
  assert.equal(r.fetchCalls.length, 0);
});
