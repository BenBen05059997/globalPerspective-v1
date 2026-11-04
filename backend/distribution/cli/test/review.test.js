'use strict';
// Run: node --test "backend/distribution/cli/test/*.test.js"
// breaking/review.js is the only path that makes a proposed alert public (status 'confirmed'). It shells out to the AWS CLI and reads
// the operator's answers from stdin, so it is run as a real child process against a fake `aws` (cliHarness.js). No AWS, no network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const { run, unmarshal } = require('./cliHarness');

const TABLE = 'GlobalPerspectiveBreakingAlerts';
const REGION = 'ap-northeast-1';

const alert = (key, over = {}) => ({
  alertKey: key, status: 'proposed', title: `Story ${key}`, score: 50, category: 'conflict', regions: ['Iran'], reasons: ['r1', 'r2'],
  cycle: '2026-10-30T06:00:00Z', alertedAt: '2026-10-30T06:05:00Z', hasArc: true, threadId: `thread-${key}`, outletCount: 7, sourceCount: 9,
  verify: { status: 'verified', note: 'two outlets' }, story: { summary: '- one', prediction: 'p', economic: null },
  draft: { subject: `Subject ${key}`, html: '<p>x</p>', text: `Body ${key}` },
  ...over,
});
const puts = (r) => r.awsCalls.filter((c) => c.op === 'put-item');
const written = (r) => puts(r).map((c) => unmarshal({ M: c.item }));
const byStatus = (list, status) => list.filter((a) => a.status === status);
const near = (iso) => Math.abs(Date.now() - Date.parse(iso)) < 60000;

// ── listing: which rows the operator is shown ─────────────────────────────────

test('--list shows proposed and sent rows only, highest score first, and never prompts or writes', async () => {
  const r = await run('review.js', {
    args: ['--list'],
    items: [
      alert('low', { score: 10 }),
      alert('high', { score: 90, status: 'sent' }),
      alert('done', { status: 'confirmed', score: 99, title: 'Already public' }),
      alert('nope', { status: 'rejected', score: 98, title: 'Already rejected' }),
      alert('mid', { score: 40 }),
    ],
  });
  assert.equal(r.code, 0);
  assert.equal(r.prompts, 0);
  assert.equal(puts(r).length, 0);
  assert.match(r.stdout, /3 alert\(s\) awaiting review/);
  const order = ['Story high', 'Story mid', 'Story low'].map((t) => r.stdout.indexOf(t));
  assert.ok(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], r.stdout);
  assert.doesNotMatch(r.stdout, /Already public|Already rejected/);
  assert.match(r.stdout, /\[90\] Story high {2}\(high\) {2}verify=verified/);
});

test('the scan asks the fake table for status proposed OR sent that was never confirmed, in the right table and region', async () => {
  const r = await run('review.js', { args: ['--list'], items: [alert('a')] });
  const scan = r.awsCalls.find((c) => c.op === 'scan');
  assert.equal(scan.flags['table-name'], TABLE);
  assert.equal(scan.flags.region, REGION);
  assert.equal(scan.flags['filter-expression'], '(#s = :p OR #s = :s) AND attribute_not_exists(confirmedAt)');
  assert.deepEqual(JSON.parse(scan.flags['expression-attribute-names']), { '#s': 'status' });
  assert.deepEqual(JSON.parse(scan.flags['expression-attribute-values']), { ':p': { S: 'proposed' }, ':s': { S: 'sent' } });
});

// newsBreakingAlert markSent writes status 'sent', sent=true, sentAt when it emails the OPERATOR the proposal: still awaiting review.
// The old send.js wrote status 'sent' on an alert that review.js had confirmed (confirmedAt set): legacy rows, already public history.
test('a sent row WITHOUT confirmedAt (the operator-emailed proposal) is still offered, in --list and in the walk', async () => {
  const items = [alert('emailed', { status: 'sent', sent: true, sentAt: '2026-10-30T06:06:00Z' })];
  const l = await run('review.js', { args: ['--list'], items });
  assert.match(l.stdout, /1 alert\(s\) awaiting review/);
  assert.match(l.stdout, /Story emailed/);
  const r = await run('review.js', { items, answers: ['c'] });
  assert.match(r.stdout, /Story emailed/);
  assert.equal(byStatus(written(r), 'confirmed').length, 1);
});

test('a sent row WITH confirmedAt (legacy: demoted by the old send.js) is neither offered nor listed', async () => {
  const items = [
    alert('legacy', { status: 'sent', sent: true, confirmedAt: '2026-10-30T07:00:00Z', confirmedBy: 'human', title: 'Legacy demoted' }),
    alert('fresh', { status: 'sent', sent: true }),
  ];
  const l = await run('review.js', { args: ['--list'], items });
  assert.match(l.stdout, /1 alert\(s\) awaiting review/);
  assert.doesNotMatch(l.stdout, /Legacy demoted/);
  assert.match(l.stdout, /Story fresh/);
  const r = await run('review.js', { items, answers: ['s', 's'] });
  assert.equal(r.prompts, 1);
  assert.doesNotMatch(r.stdout, /Legacy demoted/);
  assert.equal(puts(r).length, 0);
  const only = await run('review.js', { items: [items[0]] });
  assert.match(only.stdout, /No unconfirmed alerts awaiting review/);
});

test('an empty queue says so and exits cleanly without prompting', async () => {
  const r = await run('review.js', { items: [alert('c', { status: 'confirmed' })] });
  assert.equal(r.code, 0);
  assert.match(r.stdout, /No unconfirmed alerts awaiting review/);
  assert.equal(r.prompts, 0);
  assert.equal(puts(r).length, 0);
});

test('paged scans are followed with --starting-token until NextToken runs out', async () => {
  const r = await run('review.js', {
    args: ['--list'], pageSize: 1,
    items: [alert('a', { score: 3 }), alert('b', { score: 2 }), alert('c', { score: 1 })],
  });
  const scans = r.awsCalls.filter((c) => c.op === 'scan');
  assert.equal(scans.length, 3);
  assert.equal(scans[0].flags['starting-token'], undefined);
  assert.equal(scans[1].flags['starting-token'], '1');
  assert.equal(scans[2].flags['starting-token'], '2');
  assert.match(r.stdout, /3 alert\(s\) awaiting review/);
});

// ── confirming ────────────────────────────────────────────────────────────────

test('"c" confirms: one put-item on the alerts table with status confirmed, confirmedAt, confirmedBy human, everything else untouched', async () => {
  const original = alert('k1');
  const r = await run('review.js', { items: [original], answers: ['c'] });
  assert.equal(r.code, 0);
  assert.equal(puts(r).length, 1);
  const call = puts(r)[0];
  assert.equal(call.flags['table-name'], TABLE);
  assert.equal(call.flags.region, REGION);
  assert.match(call.flags.item, /^file:\/\/.*breaking-.*\.json$/);

  const [out] = written(r);
  assert.equal(out.status, 'confirmed');
  assert.equal(out.confirmedBy, 'human');
  assert.ok(near(out.confirmedAt), out.confirmedAt);
  assert.equal(out.reviewedAt, undefined);
  assert.equal(out.editorNote, undefined);
  const { status: _s, ...rest } = out; // eslint-disable-line no-unused-vars
  const { confirmedAt: _c, confirmedBy: _b, ...restOut } = rest; // eslint-disable-line no-unused-vars
  const { status: _o, ...restIn } = original; // eslint-disable-line no-unused-vars
  assert.deepEqual(restOut, restIn, 'the rest of the row (draft, story, numbers, booleans, nested maps) round-trips unchanged');
  assert.match(r.stdout, /→ confirmed \(now public/);
  assert.deepEqual(r.leftoverFiles, [], 'the temp item file is removed');
});

test('a "sent" row (operator email sent, not yet confirmed) can be confirmed too', async () => {
  const r = await run('review.js', { items: [alert('s1', { status: 'sent', sent: true, sentAt: '2026-10-30T07:00:00Z' })], answers: ['c'] });
  const [out] = written(r);
  assert.equal(out.status, 'confirmed');
  assert.equal(out.sent, true, 'the sent flag is kept');
  assert.equal(out.sentAt, '2026-10-30T07:00:00Z');
});

test('answers are trimmed and case-insensitive', async () => {
  const r = await run('review.js', { items: [alert('a')], answers: ['  C  '] });
  assert.equal(written(r)[0].status, 'confirmed');
});

test('"w" + words: the note is stored as editorNote and leads the draft text; subject and html are unchanged; then confirmed', async () => {
  const r = await run('review.js', { items: [alert('w1')], answers: ['w', '  Our own context line.  '] });
  assert.equal(r.code, 0);
  const [out] = written(r);
  assert.equal(out.status, 'confirmed');
  assert.equal(out.editorNote, 'Our own context line.');
  assert.equal(out.draft.text, 'Our own context line.\n\nBody w1');
  assert.equal(out.draft.subject, 'Subject w1');
  assert.equal(out.draft.html, '<p>x</p>');
  assert.equal(out.confirmedBy, 'human');
});

test('"w" with an empty note still confirms, with no editorNote and the draft untouched', async () => {
  const r = await run('review.js', { items: [alert('w2')], answers: ['w', ''] });
  const [out] = written(r);
  assert.equal(out.status, 'confirmed');
  assert.equal(out.editorNote, undefined);
  assert.equal(out.draft.text, 'Body w2');
});

// ── rejecting ─────────────────────────────────────────────────────────────────

test('"r" rejects: status rejected plus reviewedAt, and no confirmedAt / confirmedBy', async () => {
  const r = await run('review.js', { items: [alert('r1')], answers: ['r'] });
  assert.equal(puts(r).length, 1);
  const [out] = written(r);
  assert.equal(out.status, 'rejected');
  assert.ok(near(out.reviewedAt));
  assert.equal(out.confirmedAt, undefined);
  assert.equal(out.confirmedBy, undefined);
  assert.equal(out.title, 'Story r1');
  assert.match(r.stdout, /→ rejected \(will not send\)/);
});

// ── nothing is confirmed without an explicit answer ───────────────────────────

test('blank, "s", unrecognised words, "yes", "confirm", "y" all leave every row untouched (no put-item at all)', async () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((k, i) => alert(k, { score: 60 - i }));
  const r = await run('review.js', { items, answers: ['', 's', 'x', 'yes', 'confirm', 'y'] });
  assert.equal(r.code, 0);
  assert.equal(r.prompts, 6);
  assert.equal(puts(r).length, 0);
  assert.equal(byStatus(r.table, 'proposed').length, 6);
  assert.equal(byStatus(r.table, 'confirmed').length, 0);
  assert.equal((r.stdout.match(/unrecognized — skipped/g) || []).length, 4, 'x, yes, confirm, y');
});

test('"q" stops the walk: the first row is not written and later rows are never even shown', async () => {
  const r = await run('review.js', { items: [alert('a', { score: 9 }), alert('b', { score: 1 })], answers: ['q'] });
  assert.equal(r.code, 0);
  assert.equal(r.prompts, 1);
  assert.equal(puts(r).length, 0);
  assert.doesNotMatch(r.stdout, /Story b/);
});

test('closing stdin (Ctrl-D) at the prompt confirms nothing', async () => {
  const r = await run('review.js', { items: [alert('a')], answers: [] });
  assert.equal(puts(r).length, 0);
  assert.equal(byStatus(r.table, 'confirmed').length, 0);
});

test('"w" followed by EOF before the note is typed confirms nothing', async () => {
  const r = await run('review.js', { items: [alert('a')], answers: ['w'] });
  assert.equal(puts(r).length, 0);
  assert.equal(byStatus(r.table, 'confirmed').length, 0);
});

test('only the rows the operator answered for are written, each with the status of its own answer, in score order', async () => {
  const r = await run('review.js', {
    items: [alert('lo', { score: 1 }), alert('hi', { score: 99 }), alert('mid', { score: 50 })],
    answers: ['c', 's', 'r'], // hi -> confirm, mid -> skip, lo -> reject
  });
  const out = written(r);
  assert.deepEqual(out.map((a) => [a.alertKey, a.status]), [['hi', 'confirmed'], ['lo', 'rejected']]);
  assert.equal(byStatus(r.table, 'proposed').map((a) => a.alertKey).join(), 'mid');
});

test('a row that is already confirmed or rejected is never offered, so it cannot be re-confirmed or have confirmedAt overwritten', async () => {
  const done = alert('done', { status: 'confirmed', confirmedAt: '2026-10-01T00:00:00Z', confirmedBy: 'human' });
  const r = await run('review.js', { items: [done, alert('rej', { status: 'rejected' }), alert('new')], answers: ['c'] });
  assert.deepEqual(written(r).map((a) => a.alertKey), ['new']);
  assert.equal(r.table.find((a) => a.alertKey === 'done').confirmedAt, '2026-10-01T00:00:00Z');
  assert.equal(r.table.find((a) => a.alertKey === 'rej').status, 'rejected');
});

// ── failures ──────────────────────────────────────────────────────────────────

test('when put-item fails the CLI exits 1, never prints "confirmed", and the row stays unconfirmed', async () => {
  const r = await run('review.js', { items: [alert('a')], answers: ['c'], fail: 'put-item' });
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.stdout, /→ confirmed/);
  assert.equal(byStatus(r.table, 'confirmed').length, 0);
});

test('when the scan fails the CLI exits 1 and prompts for nothing', async () => {
  const r = await run('review.js', { items: [alert('a')], fail: 'scan' });
  assert.equal(r.code, 1);
  assert.equal(r.prompts, 0);
  assert.equal(puts(r).length, 0);
});

// ── the readers: what a confirmed / rejected write looks like to the public API ──

const RECOMMEND = path.resolve(__dirname, '../../../read-api/newsRecommend/src/index.js');
/** newsRecommend loaded against a fake table holding `rows` (a Scan honours the FilterExpression's :confirmed value, as DynamoDB would). */
function recommendOver(rows) {
  const seen = [];
  const aws = stubAws({
    ddb: (input, name) => {
      seen.push({ name, input });
      if (name === 'GetCommand') return { Item: rows.find((x) => x.alertKey === input.Key.alertKey) };
      return { Items: rows.filter((x) => x.status === input.ExpressionAttributeValues[':confirmed']) };
    },
  });
  const mod = aws.load(RECOMMEND, {});
  return { mod, seen, stop: () => aws.restore() };
}

test('what review.js writes is exactly what newsRecommend publishes: confirmed shows in list_alerts / get_alert, rejected and unanswered never do', async () => {
  const confirmedRow = alert('pub', { score: 99, category: 'economy', regions: ['Japan'] });
  const r = await run('review.js', {
    items: [confirmedRow, alert('rej', { score: 50 }), alert('skip', { score: 10 })],
    answers: ['w', 'Editor says: watch the yen.', 'r', 's'],
  });
  const wrote = written(r);
  assert.deepEqual(wrote.map((a) => a.alertKey), ['pub', 'rej']);

  // The table the CLI wrote to is the table the reader scans (newsRecommend's default BREAKING_ALERTS_TABLE).
  assert.equal(puts(r)[0].flags['table-name'], TABLE);

  const { mod, seen, stop } = recommendOver(r.table);
  try {
    assert.equal(seen.length, 0);
    const list = await mod.listAlerts();
    assert.equal(seen[0].input.TableName, TABLE);
    assert.equal(seen[0].input.FilterExpression, '#s = :confirmed');
    assert.deepEqual(seen[0].input.ExpressionAttributeNames, { '#s': 'status' });
    assert.deepEqual(list.map((a) => a.id), ['pub'], 'only the confirmed row is public');
    assert.equal(list[0].at, wrote[0].confirmedAt, 'the feed orders by the confirmedAt the CLI stamped');
    assert.equal(list[0].category, 'economy');
    assert.deepEqual(list[0].regions, ['Japan']);
    assert.equal(list[0].outletCount, 7);

    const pub = await mod.getAlert('pub');
    assert.equal(pub.id, 'pub');
    assert.equal(pub.editorNote, 'Editor says: watch the yen.');
    assert.equal(pub.hasArc, true);
    assert.equal(pub.threadId, 'thread-pub');
    assert.ok(pub.threadUrl && pub.threadUrl.includes('thread-pub'));
    assert.equal(pub.story.summary, '- one');
    assert.equal(pub.at, wrote[0].confirmedAt);

    assert.equal(await mod.getAlert('rej'), null, 'rejected stays private');
    assert.equal(await mod.getAlert('skip'), null, 'skipped (still proposed) stays private');
  } finally { stop(); }
});
