'use strict';
// RECORD_READS (decision 0054) for the weekly email: the brief content comes from the weekly_brief view (record) or the WEEKLY_BRIEF# row (ddb, the
// default); the sent marker and the recipients stay in DynamoDB. The rendered email is identical either way (the live weekly rows are the fixture).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const { renderWeeklyEmail } = require('../src/renderWeeklyEmail');
const fixtures = require('../../../record/cli/fixtures/brief-rows.json');

const SUNDAY = Date.parse('2026-10-25T14:00:00.000Z'); // the send time of the week of the newest fixture
const rows = fixtures.weekly;
const published = rows.filter((r) => r.status === 'published').sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)));
const newest = published[0];
const stored = ({ PK, SK, ttl, ...brief }) => brief; // what the weekly view's `brief` holds (briefViews.js adds iso3 to signals; the email does not read it)
const viewFiles = (builtAt = new Date(SUNDAY - 3600000).toISOString()) => ({
  'record/views/manifest.json': { builtAt },
  'record/views/index/briefs.json': { daily: [], weekly: published.map((r) => ({ weekOf: r.weekOf })) },
  ...Object.fromEntries(published.map((r) => [`record/views/briefs/weekly/${r.weekOf}.json`, { weekOf: r.weekOf, brief: stored(r) }])),
});

const withClock = async (now, fn) => {
  const real = Date.now;
  Date.now = () => now;
  try { return await fn(); } finally { Date.now = real; }
};
const run = async (mode, files, now = SUNDAY) => {
  const aws = stubAws({
    files,
    ddb: (input, cmd) => {
      if (cmd === 'ScanCommand') return { Items: input.ExpressionAttributeValues[':sk'] === 'WEEKLY_BRIEF' ? rows.filter((r) => r.status === 'published') : [{ uid: 'u1', email: 'reader@example.com', digestOptIn: true, unsubToken: 'tok' }] };
      return { Item: undefined }; // the sent marker: not sent yet
    },
  });
  try {
    const mod = aws.load(path.resolve(__dirname, '../src/index.js'), { RECORD_READS: mode, EMAIL_SEND_DRY_RUN: undefined, UNSUB_BASE_URL: 'https://u.example/fn' });
    return await withClock(now, async () => ({ brief: await mod.loadLatestBrief(), result: await mod.runWeekly({}), reads: aws.reads }));
  } finally { aws.restore(); }
};

test('record: the latest published week from the views, and the rendered email is identical to the one from the DynamoDB row', async () => {
  const d = await run(undefined, viewFiles());
  const r = await run('record', viewFiles());
  assert.equal(d.brief.weekOf, newest.weekOf);
  assert.equal(r.brief.weekOf, newest.weekOf);
  const opts = { siteUrl: undefined, unsubUrl: 'https://u.example/fn?action=unsubscribe&uid=u1&token=tok&kind=digest' };
  const a = renderWeeklyEmail(d.brief, opts);
  const b = renderWeeklyEmail(r.brief, opts);
  assert.equal(b.subject, a.subject);
  assert.equal(b.text, a.text);
  assert.equal(b.html, a.html);
  assert.ok(a.html.length > 5000);
  assert.ok(!r.reads.some((x) => x.startsWith('ddb:') && x.includes('WEEKLY_BRIEF')), 'the record mode run never scans WEEKLY_BRIEF#');
});

test('every published fixture week renders to the same email from the row and from the view', () => {
  for (const row of published) {
    const a = renderWeeklyEmail(row, { siteUrl: undefined, unsubUrl: null });
    const b = renderWeeklyEmail(stored(row), { siteUrl: undefined, unsubUrl: null });
    assert.deepEqual(b, a, row.weekOf);
  }
});

test('the run reads the recipients and the sent marker from DynamoDB in every mode, and sends nothing in dry run', async () => {
  const r = await run('record', viewFiles());
  assert.equal(r.result.ok, true);
  assert.equal(r.result.weekOf, newest.weekOf);
  assert.equal(r.result.dryRun, true);
  assert.ok(r.reads.some((x) => x.includes('EMAILLOG#weekly#')), r.reads.join('\n'));
  assert.ok(r.reads.some((x) => x.startsWith('ddb:') && x.includes('GlobalPerspectiveUserPrefs')));
});

test('record without the new week (an old record, stale views or no views) reads DynamoDB, so the sent marker decides as before', async () => {
  for (const [files, now] of [[viewFiles(), Date.parse('2026-11-08T14:00:00.000Z')], [viewFiles(new Date(SUNDAY - 30 * 3600000).toISOString()), SUNDAY], [{}, SUNDAY]]) {
    const r = await run('record', files, now);
    assert.equal(r.brief.weekOf, newest.weekOf);
    assert.ok(r.reads.some((x) => x.startsWith('ddb:')));
  }
});

test('compare: DynamoDB decides; both are read', async () => {
  const r = await run('compare', viewFiles());
  assert.equal(r.brief.PK, `WEEKLY_BRIEF#${newest.weekOf}`);
  assert.ok(r.reads.some((x) => x.startsWith('s3:')));
});
