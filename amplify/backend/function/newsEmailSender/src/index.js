'use strict';

// newsEmailSender — ONE sender for both email products, dispatched by event.mode.
//
//   { mode: 'weekly' }   → email the latest published WEEKLY_BRIEF to digestOptIn subscribers
//   { mode: 'breaking' } → email fresh confirmed breaking alerts to breakingOptIn subscribers
//
// Subscribers live in GlobalPerspectiveUserPrefs (written by newsRecommend set_prefs on
// opt-in, with email + unsubToken). Sending goes through the shared Resend seam
// (sendEmail.js). Unsubscribe is a public token link served by newsRecommend.
//
// SAFE BY DEFAULT: EMAIL_SEND_DRY_RUN defaults ON → logs recipients + the would-be email,
// sends nothing. TEST_RECIPIENT overrides the audience to a single address (send-to-self).
// Real delivery to arbitrary subscribers additionally needs a verified EMAIL_FROM domain.
//
// No bundled deps — nodejs20 runtime provides @aws-sdk; fetch is global.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { sendEmail } = require('./sendEmail');
const { renderWeeklyEmail } = require('./renderWeeklyEmail');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PREFS_TABLE = process.env.USER_PREFS_TABLE || 'GlobalPerspectiveUserPrefs';
const SUMMARY_TABLE = process.env.SUMMARIZE_PREDICT_TABLE || 'SummarizeAndPredict';
const ALERTS_TABLE = process.env.BREAKING_ALERTS_TABLE || 'GlobalPerspectiveBreakingAlerts';
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SITE_URL = process.env.SITE_URL || 'https://globalperspective.net';
const UNSUB_BASE = process.env.UNSUB_BASE_URL || ''; // newsRecommend Function URL
const TEST_RECIPIENT = process.env.TEST_RECIPIENT || null;
const DRY_RUN = process.env.EMAIL_SEND_DRY_RUN !== 'false'; // default ON
const BREAKING_FRESH_HOURS = Number(process.env.BREAKING_FRESH_HOURS || 48);

let _ddb;
function ddb() {
  if (!_ddb) _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  return _ddb;
}

// Paginated scan — the tables outgrew the 1MB scan page (bit weekly_brief 2026-07-03),
// so every scan here walks all pages.
async function scanAll(params) {
  const items = [];
  let ExclusiveStartKey;
  let pages = 0;
  do {
    const resp = await ddb().send(new ScanCommand({ ...params, ExclusiveStartKey }));
    items.push(...(resp.Items || []));
    ExclusiveStartKey = resp.LastEvaluatedKey;
    pages += 1;
  } while (ExclusiveStartKey && pages < 50);
  return items;
}

function unsubUrl(uid, token, kind) {
  if (!UNSUB_BASE || !uid || !token) return null;
  const sep = UNSUB_BASE.includes('?') ? '&' : '?';
  // uid lets the receiver GetItem (not Scan) by key; token proves the link is genuine.
  return `${UNSUB_BASE}${sep}action=unsubscribe&uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}&kind=${kind}`;
}

function unsubHeaders(url) {
  if (!url) return undefined;
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

// Resolve the audience: TEST_RECIPIENT wins (send-to-self smoke test); otherwise the
// opt-in subscribers. Returns [{ email, token }].
async function audience(optInField) {
  const subs = await scanAll({
    TableName: PREFS_TABLE,
    FilterExpression: `#opt = :true AND attribute_exists(email)`,
    ExpressionAttributeNames: { '#opt': optInField },
    ExpressionAttributeValues: { ':true': true },
  });
  const verifiedField = optInField === 'digestOptIn' ? 'digestVerified' : 'breakingVerified';
  const list = subs
    // Default-allow unless explicitly unverified (email is Google-auth verified at opt-in;
    // the *Verified fields are not written yet — treat missing as OK, false as blocked).
    .filter((s) => s[verifiedField] !== false && s.email)
    .map((s) => ({ email: s.email, uid: s.uid, token: s.unsubToken || null }));
  if (TEST_RECIPIENT) {
    // Keep a real uid/token if the test address is a subscriber, else null.
    const mine = list.find((r) => r.email === TEST_RECIPIENT);
    return [{ email: TEST_RECIPIENT, uid: mine ? mine.uid : null, token: mine ? mine.token : null }];
  }
  return list;
}

async function deliver(recipients, buildFor, kind) {
  let sent = 0;
  const errors = [];
  for (const r of recipients) {
    const uUrl = unsubUrl(r.uid, r.token, kind);
    const msg = buildFor(uUrl);
    if (DRY_RUN) {
      console.log(`[email:DRY_RUN] → ${r.email} | subject: ${msg.subject}${uUrl ? '' : ' | (no unsub token)'}`);
      sent += 1;
      continue;
    }
    try {
      await sendEmail({ from: FROM, to: r.email, subject: msg.subject, text: msg.text, html: msg.html, headers: unsubHeaders(uUrl) });
      sent += 1;
    } catch (err) {
      console.error(`[email] send failed → ${r.email}: ${err.message}`);
      errors.push({ email: r.email, error: err.message });
    }
  }
  return { sent, errors };
}

// ── WEEKLY ──────────────────────────────────────────────────────────────────
async function loadLatestBrief() {
  const items = await scanAll({
    TableName: SUMMARY_TABLE,
    FilterExpression: 'SK = :sk AND #s = :pub',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':sk': 'WEEKLY_BRIEF', ':pub': 'published' },
  });
  if (!items.length) return null;
  return items.sort((a, b) => String(b.weekOf).localeCompare(String(a.weekOf)))[0];
}

async function weeklyAlreadySent(weekOf) {
  const out = await ddb().send(new GetCommand({
    TableName: SUMMARY_TABLE, Key: { PK: `EMAILLOG#weekly#${weekOf}`, SK: 'EMAIL_LOG' },
  }));
  return !!out.Item;
}

async function markWeeklySent(weekOf, count) {
  await ddb().send(new PutCommand({
    TableName: SUMMARY_TABLE,
    Item: {
      PK: `EMAILLOG#weekly#${weekOf}`, SK: 'EMAIL_LOG',
      weekOf, recipients: count, sentAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 180 * 86400,
    },
  }));
}

async function runWeekly(event) {
  const brief = await loadLatestBrief();
  if (!brief) { console.log('[email:weekly] no published brief; nothing to send'); return { ok: true, mode: 'weekly', sent: 0, reason: 'no_brief' }; }
  if (!event.force && await weeklyAlreadySent(brief.weekOf)) {
    console.log(`[email:weekly] week ${brief.weekOf} already emailed; skipping (pass {force:true} to resend)`);
    return { ok: true, mode: 'weekly', sent: 0, reason: 'already_sent', weekOf: brief.weekOf };
  }
  const recipients = await audience('digestOptIn');
  console.log(`[email:weekly] week ${brief.weekOf} · ${recipients.length} recipient(s) · DRY_RUN=${DRY_RUN} · from=${FROM}`);
  const { sent, errors } = await deliver(recipients, (uUrl) => renderWeeklyEmail(brief, { siteUrl: SITE_URL, unsubUrl: uUrl }), 'digest');
  if (!DRY_RUN && sent > 0) await markWeeklySent(brief.weekOf, sent);
  return { ok: true, mode: 'weekly', weekOf: brief.weekOf, recipients: recipients.length, sent, errors, dryRun: DRY_RUN };
}

// ── BREAKING ────────────────────────────────────────────────────────────────
function appendUnsub(draft, uUrl) {
  const footT = uUrl ? `\n\n—\nGlobal Perspectives breaking alerts.\nUnsubscribe: ${uUrl}` : '';
  const footH = uUrl
    ? `<div style="padding-top:18px;margin-top:18px;border-top:1px solid #ececea;font:400 11px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#999;">Global Perspectives breaking alerts. <a href="${uUrl}" style="color:#999;">Unsubscribe</a></div>`
    : '';
  return {
    subject: draft.subject,
    text: (draft.text || '') + footT,
    html: draft.html ? draft.html.replace(/<\/body>/i, `${footH}</body>`) : (draft.html || '') + footH,
  };
}

async function loadFreshConfirmedAlerts() {
  const cutoff = new Date(Date.now() - BREAKING_FRESH_HOURS * 3600 * 1000).toISOString();
  return scanAll({
    TableName: ALERTS_TABLE,
    FilterExpression: '#s = :c AND attribute_not_exists(emailedAt) AND alertedAt >= :cut',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':c': 'confirmed', ':cut': cutoff },
  });
}

async function markAlertEmailed(alertKey, count) {
  await ddb().send(new UpdateCommand({
    TableName: ALERTS_TABLE, Key: { alertKey },
    UpdateExpression: 'SET emailedAt = :t, emailedCount = :n',
    ExpressionAttributeValues: { ':t': new Date().toISOString(), ':n': count },
  }));
}

async function runBreaking() {
  const alerts = await loadFreshConfirmedAlerts();
  if (!alerts.length) { console.log('[email:breaking] no fresh confirmed alerts to send'); return { ok: true, mode: 'breaking', alerts: 0, sent: 0 }; }
  const recipients = await audience('breakingOptIn');
  console.log(`[email:breaking] ${alerts.length} alert(s) × ${recipients.length} recipient(s) · DRY_RUN=${DRY_RUN} · from=${FROM}`);
  let totalSent = 0;
  const perAlert = [];
  for (const a of alerts) {
    if (!a.draft || !a.draft.subject) { console.warn(`[email:breaking] alert ${a.alertKey} has no draft; skipping`); continue; }
    const { sent, errors } = await deliver(recipients, (uUrl) => appendUnsub(a.draft, uUrl), 'breaking');
    totalSent += sent;
    perAlert.push({ alertKey: a.alertKey, sent, errors });
    if (!DRY_RUN && recipients.length > 0) await markAlertEmailed(a.alertKey, sent);
  }
  return { ok: true, mode: 'breaking', alerts: alerts.length, recipients: recipients.length, sent: totalSent, perAlert, dryRun: DRY_RUN };
}

exports.handler = async (event = {}) => {
  const mode = event.mode || 'weekly';
  try {
    if (mode === 'weekly') return await runWeekly(event);
    if (mode === 'breaking') return await runBreaking(event);
    return { ok: false, error: `unknown mode: ${mode}` };
  } catch (err) {
    console.error(`[email] ${mode} failed:`, err);
    return { ok: false, mode, error: err.message };
  }
};
