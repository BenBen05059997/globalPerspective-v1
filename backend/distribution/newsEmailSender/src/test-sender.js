'use strict';

/*
 * Hermetic test harness for newsEmailSender (+ the newsRecommend unsubscribe route).
 *
 *   node test-sender.js
 *
 * No live AWS, no network, no npm deps: it intercepts require() to stub
 * @aws-sdk/lib-dynamodb + @aws-sdk/client-dynamodb with an in-memory store, and
 * stubs global.fetch to capture would-be Resend calls. Exit code 0 = all pass.
 *
 * Covers: weekly audience filtering (opt-in / verified / missing-email), weekly
 * idempotency marker, weekly real-send path (fetch body + List-Unsubscribe header),
 * breaking freshness gate (old + wrong-status excluded), TEST_RECIPIENT override,
 * DRY_RUN sends nothing, and the unsubscribe flag-flip.
 */

const path = require('path');
const Module = require('module');

// ── in-memory DDB store (mutated by fixtures per scenario) ───────────────────
const store = { briefs: [], prefs: [], alerts: [], marker: {} };

function resetStore() {
  store.briefs = [{ ...require('../../../weekly/test/fixtures/weekly-2026-10-18.json'), status: 'published', weekEnding: '2026-06-28' }];
  store.prefs = [
    { uid: 'a', email: 'a@example.com', digestOptIn: true, unsubToken: 'tok-a' },              // weekly ✓
    { uid: 'b', email: 'b@example.com', digestOptIn: true, digestVerified: false, unsubToken: 'tok-b' }, // excluded (verified=false)
    { uid: 'c', email: 'c@example.com', breakingOptIn: true, unsubToken: 'tok-c' },            // breaking ✓
    { uid: 'd', digestOptIn: true, unsubToken: 'tok-d' },                                      // excluded (no email)
  ];
  const now = Date.now();
  const iso = (ms) => new Date(now - ms).toISOString();
  store.alerts = [
    { alertKey: 'fresh-1', status: 'confirmed', alertedAt: iso(2 * 3600e3), draft: { subject: 'Breaking: fresh event', text: 'body', html: '<body>x</body>' } }, // ✓ (2h old)
    { alertKey: 'old-1', status: 'confirmed', alertedAt: iso(72 * 3600e3), draft: { subject: 'old', text: 'b', html: '<body>o</body>' } },                       // excluded (72h > 48h)
    { alertKey: 'sent-1', status: 'sent', alertedAt: iso(1 * 3600e3), draft: { subject: 'already', text: 'b', html: '<body>s</body>' } },                        // excluded (status)
  ];
  store.marker = {};
  store.s3Error = null;
}

// ── fake SDK ─────────────────────────────────────────────────────────────────
class Cmd { constructor(input) { this.input = input || {}; } }
class ScanCommand extends Cmd {}
class GetCommand extends Cmd {}
class PutCommand extends Cmd {}
class UpdateCommand extends Cmd {}
class QueryCommand extends Cmd {}

function fakeSend(cmd) {
  const p = cmd.input; const name = cmd.constructor.name;
  const T = { SUMMARY: 'SummarizeAndPredict', PREFS: 'GlobalPerspectiveUserPrefs', ALERTS: 'GlobalPerspectiveBreakingAlerts' };
  if (name === 'ScanCommand') {
    if (p.TableName === T.SUMMARY && (p.ExpressionAttributeValues || {})[':sk'] === 'WEEKLY_BRIEF') {
      throw new Error('Weekly mode must not scan legacy WEEKLY_BRIEF records');
    }
    if (p.TableName === T.PREFS && /unsubToken/.test(p.FilterExpression || '')) {
      const tok = p.ExpressionAttributeValues[':t'];
      return Promise.resolve({ Items: store.prefs.filter((x) => x.unsubToken === tok) });
    }
    if (p.TableName === T.PREFS) {
      const optField = (p.ExpressionAttributeNames || {})['#opt'];
      return Promise.resolve({ Items: store.prefs.filter((x) => x[optField] === true && x.email != null) });
    }
    if (p.TableName === T.ALERTS) {
      const cut = p.ExpressionAttributeValues[':cut'];
      return Promise.resolve({ Items: store.alerts.filter((a) => a.status === 'confirmed' && !a.emailedAt && a.alertedAt >= cut) });
    }
  }
  if (name === 'GetCommand') {
    if (p.TableName === T.SUMMARY && String(p.Key.PK).startsWith('EMAILLOG#')) {
      return Promise.resolve({ Item: store.marker[p.Key.PK] || undefined });
    }
    if (p.TableName === T.PREFS) {
      return Promise.resolve({ Item: store.prefs.find((x) => x.uid === p.Key.uid) || undefined });
    }
    return Promise.resolve({ Item: undefined });
  }
  if (name === 'PutCommand') {
    if (String(p.Item.PK).startsWith('EMAILLOG#')) store.marker[p.Item.PK] = p.Item;
    return Promise.resolve({});
  }
  if (name === 'UpdateCommand') {
    if (p.TableName === T.ALERTS) {
      const a = store.alerts.find((x) => x.alertKey === p.Key.alertKey);
      if (a) { a.emailedAt = new Date().toISOString(); a.emailedCount = p.ExpressionAttributeValues[':n']; }
    }
    if (p.TableName === T.PREFS) {
      const u = store.prefs.find((x) => x.uid === p.Key.uid);
      if (u) { Object.entries(p.ExpressionAttributeNames || {}).forEach(([k, field]) => { u[field] = p.ExpressionAttributeValues[k.replace('#k', ':v')]; }); }
    }
    return Promise.resolve({});
  }
  return Promise.resolve({});
}

const fakeLib = {
  DynamoDBDocumentClient: { from: () => ({ send: fakeSend }) },
  ScanCommand, GetCommand, PutCommand, UpdateCommand, QueryCommand,
};
const fakeClient = { DynamoDBClient: class {} };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@aws-sdk/client-s3') return { S3Client: class { async send(cmd) { if(cmd.input.Key!=='weekly/latest.json')throw Error('Unexpected S3 key');if(store.s3Error)throw store.s3Error;const brief=store.briefs[0];if(!brief)throw Object.assign(Error('missing'),{name:'NoSuchKey'});return {Body:{transformToString:async()=>JSON.stringify(brief)}}; } }, GetObjectCommand: class extends Cmd {} };
  if (request === '@aws-sdk/lib-dynamodb') return fakeLib;
  if (request === '@aws-sdk/client-dynamodb') return fakeClient;
  return origLoad.apply(this, arguments);
};

// ── fetch capture (for the real-send path) ───────────────────────────────────
let fetchCalls = [];
global.fetch = async (url, opts) => {
  fetchCalls.push({ url, body: JSON.parse(opts.body) });
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'fake-id' }) };
};

// ── test runner ──────────────────────────────────────────────────────────────
let pass = 0; let fail = 0;
function check(name, cond) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } }

function loadSender(env) {
  const idx = path.join(__dirname, 'index.js');
  delete require.cache[require.resolve(idx)];
  Object.assign(process.env, {
    AWS_REGION: 'ap-northeast-1', RESEND_API_KEY: 'test-key',
    USER_PREFS_TABLE: 'GlobalPerspectiveUserPrefs', SUMMARIZE_PREDICT_TABLE: 'SummarizeAndPredict',
    BREAKING_ALERTS_TABLE: 'GlobalPerspectiveBreakingAlerts',
    UNSUB_BASE_URL: 'https://unsub.example/', EMAIL_FROM: 'brief@globalperspective.net',
    SITE_URL: 'https://globalperspective.net', TEST_RECIPIENT: '', EMAIL_SEND_DRY_RUN: 'true',
  }, env);
  return require(idx).handler;
}

(async () => {
  // 1) WEEKLY dry-run — audience filtering + render
  console.log('\n[weekly] dry-run audience + render');
  resetStore(); fetchCalls = [];
  let h = loadSender({ EMAIL_SEND_DRY_RUN: 'true' });
  let r = await h({ mode: 'weekly' });
  check('uses S3 weekEnding as the existing marker week (2026-06-28)', r.weekOf === '2026-06-28');
  check('1 recipient (a; b=unverified, c=breaking-only, d=no-email all excluded)', r.recipients === 1 && r.sent === 1);
  check('DRY_RUN sends no email (no fetch)', fetchCalls.length === 0);
  check('result flagged dryRun', r.dryRun === true);

  // 2) WEEKLY idempotency — a present marker skips (dry-run doesn't WRITE the marker
  // by design, so seed it explicitly; the real-send scenario #3 proves it's written).
  console.log('\n[weekly] idempotency');
  resetStore();
  store.marker['EMAILLOG#weekly#2026-06-28'] = { PK: 'EMAILLOG#weekly#2026-06-28', SK: 'EMAIL_LOG', weekOf: '2026-06-28' };
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'true' });
  r = await h({ mode: 'weekly' });
  check('marker present → already_sent, sent 0', r.reason === 'already_sent' && r.sent === 0);
  r = await h({ mode: 'weekly', force: true });
  check('force:true cannot bypass already-sent marker', r.reason === 'already_sent' && r.sent === 0);

  // 3) WEEKLY real send — fetch body + List-Unsubscribe header
  console.log('\n[weekly] real send path');
  resetStore(); fetchCalls = [];
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'false' });
  r = await h({ mode: 'weekly' });
  check('fetch called once (1 subscriber)', fetchCalls.length === 1);
  check('sent to a@example.com', fetchCalls[0] && fetchCalls[0].body.to[0] === 'a@example.com');
  check('from verified domain', fetchCalls[0] && fetchCalls[0].body.from === 'brief@globalperspective.net');
  check('subject is the weekly brief', /The analyst's weekly/.test(fetchCalls[0].body.subject));
  check('List-Unsubscribe header present', !!(fetchCalls[0].body.headers && fetchCalls[0].body.headers['List-Unsubscribe']));
  check('unsub link carries the token', /tok-a/.test(fetchCalls[0].body.headers['List-Unsubscribe']));
  check('html body includes the weekly lead', /Hormuz/.test(fetchCalls[0].body.html));
  check('risk appears as number and tier word', /Risk 78 · high/.test(fetchCalls[0].body.html));
  check('no traffic-light tier colours in the weekly html', !/#b03328|#c2622a|#caa23a|#3f8f6b/i.test(fetchCalls[0].body.html));
  check('idempotency marker written after real send', !!store.marker['EMAILLOG#weekly#2026-06-28']);

  // S3 gating happens before audience lookup or delivery, even with force.
  console.log('\n[weekly] S3 status and missing-object gates');
  for (const status of ['held', 'draft']) {
    resetStore(); fetchCalls = []; store.briefs[0].status = status;
    h = loadSender({ EMAIL_SEND_DRY_RUN: 'false' }); r = await h({ mode: 'weekly', force: true });
    check(`${status} latest skips delivery`, r.sent === 0 && fetchCalls.length === 0 && !Object.keys(store.marker).length);
  }
  resetStore(); store.briefs = []; fetchCalls = [];
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'false' }); r = await h({ mode: 'weekly' });
  check('missing S3 latest skips delivery', r.reason === 'no_brief' && fetchCalls.length === 0);
  resetStore(); store.s3Error = Object.assign(new Error('denied'), { name: 'AccessDenied' });
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'false' }); r = await h({ mode: 'weekly' });
  check('S3 denied is a visible failure, never a DynamoDB fallback', r.ok === false && r.error === 'denied');

  // 4) TEST_RECIPIENT override
  console.log('\n[weekly] TEST_RECIPIENT override');
  resetStore(); fetchCalls = [];
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'false', TEST_RECIPIENT: 'me@dev.test' });
  r = await h({ mode: 'weekly' });
  check('audience overridden to single test address', fetchCalls.length === 1 && fetchCalls[0].body.to[0] === 'me@dev.test');

  // 5) BREAKING freshness gate + audience
  console.log('\n[breaking] freshness gate + audience');
  resetStore(); fetchCalls = [];
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'false' });
  r = await h({ mode: 'breaking' });
  check('only the fresh confirmed alert selected (old + sent excluded)', r.alerts === 1);
  check('1 breaking subscriber (c)', r.recipients === 1);
  check('sent 1 email', r.sent === 1 && fetchCalls.length === 1);
  check('breaking email reuses draft subject', /Breaking: fresh event/.test(fetchCalls[0].body.subject));
  check('unsub footer appended to html', /Unsubscribe/.test(fetchCalls[0].body.html));
  check('alert stamped emailedAt (idempotent next run)', !!store.alerts.find((a) => a.alertKey === 'fresh-1').emailedAt);
  r = await h({ mode: 'breaking' });
  check('re-run sends nothing (already emailedAt)', r.alerts === 0 && r.sent === 0);

  // 6) BREAKING dry-run sends nothing
  console.log('\n[breaking] dry-run');
  resetStore(); fetchCalls = [];
  h = loadSender({ EMAIL_SEND_DRY_RUN: 'true' });
  r = await h({ mode: 'breaking' });
  check('dry-run counts recipient but no fetch', r.sent === 1 && fetchCalls.length === 0);

  // 7) UNSUBSCRIBE route (newsRecommend) — flag flip
  console.log('\n[unsubscribe] newsRecommend route');
  resetStore();
  const recIdx = path.join(__dirname, '..', '..', '..', 'read-api', 'newsRecommend', 'src', 'index.js');
  delete require.cache[require.resolve(recIdx)];
  process.env.USER_PREFS_TABLE = 'GlobalPerspectiveUserPrefs';
  const recHandler = require(recIdx).handler;
  let res = await recHandler({ requestContext: { http: { method: 'GET' } }, headers: {}, queryStringParameters: { action: 'unsubscribe', uid: 'a', token: 'tok-a', kind: 'digest' } });
  check('returns HTML 200', res.statusCode === 200 && /text\/html/.test(res.headers['Content-Type']));
  check('confirmation page shown', /Unsubscribed/.test(res.body));
  check('digestOptIn flipped to false in store', store.prefs.find((x) => x.uid === 'a').digestOptIn === false);
  res = await recHandler({ requestContext: { http: { method: 'GET' } }, headers: {}, queryStringParameters: { action: 'unsubscribe', uid: 'a', token: 'WRONG', kind: 'digest' } });
  check('token mismatch → not-recognized page', /Link not recognized/.test(res.body));
  res = await recHandler({ requestContext: { http: { method: 'GET' } }, headers: {}, queryStringParameters: { action: 'unsubscribe', uid: 'ghost', token: 'x', kind: 'digest' } });
  check('unknown uid → not-recognized page', /Link not recognized/.test(res.body));

  // 8) DRIFT EMAIL renderer — degradation ladder (scoring-model-v2 axes, SCORING_MODEL_V2_PLAN.md §12)
  console.log('\n[drift-email] degradation ladder');
  const { renderDriftEmail } = require('./renderDriftEmail');

  // Level B — currentDimensions present (richest): lead axis + score + all 4 axes + breadth flag.
  const levelBNote = {
    asOf: '2026-07-08', since: '2026-07-01',
    currentDimensions: {
      conflict: { score: 65, why: 'x' }, political: { score: 70, why: 'x' },
      economic: { score: 45, why: 'x' }, humanitarian: { score: 82, why: 'x' },
    },
    currentRiskScore: 82, currentRiskLevel: 'high', currentLead: 'humanitarian',
    changeDimensions: { humanitarian: { from: 60, to: 82, delta: 22 } },
    triggerEvent: { title: 'Camp attack confirmed', date: '2026-07-07' },
  };
  let out = renderDriftEmail('Democratic Republic of the Congo', [levelBNote], { siteUrl: 'https://globalperspective.net' });
  check('Level B html shows lead label', /Humanitarian 82/.test(out.html));
  check('Level B html shows all four axis scores', /Conflict 65/.test(out.html) && /Political 70/.test(out.html) && /Economic 45/.test(out.html) && /Humanitarian 82/.test(out.html));
  check('Level B html shows breadth flag (3/4 axes ≥50)', /3\/4 elevated/.test(out.html));
  check('Level B html shows RISKLEVEL headline', /HIGH/.test(out.html));
  check('Level B text shows axis scores too', /Conflict 65/.test(out.text) && /Humanitarian 82/.test(out.text));
  check('Level B text shows breadth flag', /3\/4 elevated/.test(out.text));
  check('country link uses the canonical name', out.text.includes('https://globalperspective.net/weekly/country/DR%20Congo') && out.html.includes('/weekly/country/DR%20Congo'));

  // Level A — changeDimensions present but NO currentDimensions (older note, post-corrector-
  // upgrade but pre-Level-B-deploy shape) → per-axis pills, not the current-standing scorecard.
  const levelANote = {
    asOf: '2026-07-05', since: '2026-06-28',
    changeDimensions: {
      political: { from: 55, to: 70, delta: 15 },
      economic: { from: 40, to: 55, delta: 15 },
    },
    whyChanged: 'Coalition talks collapsed.',
  };
  out = renderDriftEmail('Test Country A', [levelANote], { siteUrl: 'https://globalperspective.net' });
  check('Level A html shows a per-axis pill', /55→70/.test(out.html));
  check('not a country -> no country link', !/weekly\/country/.test(out.html) && !/full living analysis/.test(out.text));
  check('Level A html does NOT show the old scalar phrasing', !/risk \d+ → \d+/.test(out.html));

  // Fallback — only changeScore (pre-v2 note, no dimensions at all) → unchanged scalar behavior.
  const scalarNote = {
    asOf: '2026-07-02', since: '2026-06-25',
    changeScore: { from: 78, to: 82, delta: 4 },
    whyChanged: 'Steady deterioration.',
  };
  out = renderDriftEmail('Test Country B', [scalarNote], { siteUrl: 'https://globalperspective.net' });
  check('fallback shows unchanged scalar "risk 78 → 82"', /risk 78 → 82/.test(out.html) && /risk 78 → 82/.test(out.text));

  // No-crash — a note with none of the three (changeLevel/changeScore/changeDimensions/
  // currentDimensions all absent) still renders without throwing.
  const bareNote = { asOf: '2026-07-01', since: '2026-06-24' };
  out = renderDriftEmail('Test Country C', [bareNote], { siteUrl: 'https://globalperspective.net' });
  check('no-crash note falls back to "read revised"', /read revised/.test(out.html) && /read revised/.test(out.text));

  // ── summary ──
  console.log(`\n${'─'.repeat(48)}\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
