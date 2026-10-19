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
const { renderDriftEmail } = require('./renderDriftEmail');

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
const DRIFT_FRESH_HOURS = Number(process.env.DRIFT_FRESH_HOURS || 36);

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

// ── DRIFT ALERTS (the member "follow a country" perk, MEMBER_GATING_PLAN.md P5) ──
// Fresh, not-yet-emailed COUNTRY drift notes (DRIFT#<date>, 60d-TTL rows). begins_with
// 'DRIFT#' excludes the permanent 'DRIFTLOG#' archive (6th char differs). Country only
// (PK 'COUNTRY#…') — threads aren't followable yet. The corrector's alreadyNoted guard
// means a note is written once, so the emailedAt we stamp below is never clobbered.
async function loadFreshCountryDrift() {
  const cutoff = new Date(Date.now() - DRIFT_FRESH_HOURS * 3600 * 1000).toISOString();
  return scanAll({
    TableName: SUMMARY_TABLE,
    FilterExpression: 'begins_with(PK, :cpk) AND begins_with(SK, :dsk) AND attribute_not_exists(emailedAt) AND generatedAt >= :cut',
    ExpressionAttributeValues: { ':cpk': 'COUNTRY#', ':dsk': 'DRIFT#', ':cut': cutoff },
  });
}

// Drift subscribers: opted in + have a follow list + an email. Each carries their set of
// followed country names (DocumentClient unmarshals a DynamoDB String Set to a JS Set).
async function driftAudience() {
  const subs = await scanAll({
    TableName: PREFS_TABLE,
    FilterExpression: 'driftOptIn = :true AND attribute_exists(email) AND attribute_exists(followedCountries)',
    ExpressionAttributeValues: { ':true': true },
  });
  return subs.map((s) => ({
    email: s.email, uid: s.uid, token: s.unsubToken || null,
    follows: s.followedCountries instanceof Set ? s.followedCountries : new Set(Array.from(s.followedCountries || [])),
  }));
}

async function markDriftEmailed(pk, sk, count) {
  await ddb().send(new UpdateCommand({
    TableName: SUMMARY_TABLE, Key: { PK: pk, SK: sk },
    UpdateExpression: 'SET emailedAt = :t, emailedCount = :n',
    ExpressionAttributeValues: { ':t': new Date().toISOString(), ':n': count },
  }));
}

async function runDrift() {
  const notes = await loadFreshCountryDrift();
  if (!notes.length) { console.log('[email:drift] no fresh country drift notes'); return { ok: true, mode: 'drift_alert', countries: 0, sent: 0 }; }
  // Group fresh notes by country → one email per country, batching that country's changes.
  const byCountry = new Map();
  for (const nt of notes) {
    const c = nt.countryName || String(nt.PK || '').replace(/^COUNTRY#/, '');
    if (!c) continue;
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c).push(nt);
  }
  const subs = await driftAudience();
  console.log(`[email:drift] ${notes.length} note(s) across ${byCountry.size} country(ies) · ${subs.length} subscriber(s) · DRY_RUN=${DRY_RUN} · from=${FROM}`);
  let totalSent = 0;
  const perCountry = [];
  for (const [country, cNotes] of byCountry) {
    let recipients = subs.filter((s) => s.follows.has(country)).map((s) => ({ email: s.email, uid: s.uid, token: s.token }));
    if (TEST_RECIPIENT) recipients = [{ email: TEST_RECIPIENT, uid: null, token: null }]; // send-to-self smoke test
    if (!recipients.length) { perCountry.push({ country, notes: cNotes.length, followers: 0, sent: 0 }); continue; }
    const { sent, errors } = await deliver(recipients, (uUrl) => renderDriftEmail(country, cNotes, { siteUrl: SITE_URL, unsubUrl: uUrl }), 'drift');
    totalSent += sent;
    perCountry.push({ country, notes: cNotes.length, followers: recipients.length, sent, errors });
    // Stamp each note emailed once — idempotency (mirrors markAlertEmailed). Real sends only.
    if (!DRY_RUN && sent > 0) { for (const nt of cNotes) await markDriftEmailed(nt.PK, nt.SK, sent); }
  }
  return { ok: true, mode: 'drift_alert', countries: byCountry.size, subscribers: subs.length, sent: totalSent, perCountry, dryRun: DRY_RUN };
}

exports.handler = async (event = {}) => {
  const mode = event.mode || 'weekly';
  try {
    if (mode === 'weekly') return await runWeekly(event);
    if (mode === 'breaking') return await runBreaking(event);
    if (mode === 'drift_alert') return await runDrift(event);
    return { ok: false, error: `unknown mode: ${mode}` };
  } catch (err) {
    console.error(`[email] ${mode} failed:`, err);
    return { ok: false, mode, error: err.message };
  }
};
