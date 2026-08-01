#!/usr/bin/env node
'use strict';

/**
 * breaking/send.js — send a REAL detected breaking alert (not the sample) to your inbox
 * via Resend, then mark it sent. This is the production sender the pipeline was missing:
 * the newsBreakingAlert Lambda detects + writes a `proposed` row (with a fully-rendered
 * draft {subject, html, text}); review.js confirms it; THIS sends the stored draft.
 *
 * Mirrors review.js: shells out to the AWS CLI (no npm deps), no public auth surface.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node breaking/send.js <alertKey> [recipient] [from] [--force]
 *
 * Defaults:
 *   recipient = benlai310@gmail.com
 *   from      = onboarding@resend.dev   ← Resend's test sender: delivers ONLY to your
 *               Resend account email, zero domain setup. For a real audience, verify
 *               globalperspective.net and pass e.g.
 *               "Global Perspectives <alerts@globalperspective.net>" as [from].
 *
 * Safety: by default it refuses to send unless the proposal is status:'confirmed'
 * (run review.js first). Pass --force to send a 'proposed' row directly — handy for the
 * "just me first" end-to-end test.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const SRC = path.join(__dirname, '..', 'amplify', 'backend', 'function', 'newsBreakingAlert', 'src');
const { sendEmail } = require(path.join(SRC, 'sendEmail.js'));

const TABLE = 'GlobalPerspectiveBreakingAlerts';
const REGION = 'ap-northeast-1';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));
const alertKey = positional[0];
const to = positional[1] || 'benlai310@gmail.com';
const from = positional[2] || 'onboarding@resend.dev';

function aws(serviceArgs) {
  return execFileSync('aws', serviceArgs, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

(async () => {
  if (!alertKey) fail('Usage: RESEND_API_KEY=re_xxx node breaking/send.js <alertKey> [recipient] [from] [--force]');
  if (!process.env.RESEND_API_KEY) fail('Set your key first:  RESEND_API_KEY=re_xxx node breaking/send.js ...');

  // Read the proposal row.
  let item;
  try {
    const raw = aws(['dynamodb', 'get-item', '--table-name', TABLE, '--region', REGION,
      '--key', JSON.stringify({ alertKey: { S: alertKey } }), '--output', 'json']);
    const parsed = JSON.parse(raw || '{}');
    item = parsed.Item;
  } catch (e) {
    fail(`could not read ${alertKey}: ${e.message}`);
  }
  if (!item) fail(`no alert found for alertKey "${alertKey}"`);

  const status = item.status?.S || 'unknown';
  const sent = item.sent?.BOOL === true;
  const draft = item.draft?.M || {};
  const subject = draft.subject?.S;
  const html = draft.html?.S;
  const text = draft.text?.S;

  if (!subject || (!html && !text)) fail('proposal has no usable draft (subject/html/text missing)');
  if (sent && !FORCE) fail(`already sent (sent=true). Pass --force to resend.`);
  if (status !== 'confirmed' && !FORCE) {
    fail(`status is "${status}", not "confirmed". Run breaking/review.js first, or pass --force to send anyway.`);
  }

  console.log(`Sending breaking alert "${alertKey}" → ${to}  (from: ${from}, status: ${status}${FORCE ? ', forced' : ''})`);
  console.log(`Subject: ${subject}\n`);

  let result;
  try {
    result = await sendEmail({ from, to, subject, text, html });
  } catch (e) {
    fail(e.message);
  }
  console.log(`✓ Sent (id: ${result.id || 'n/a'}). Check ${to} (incl. spam if from the test sender).`);

  // Mark it sent so it isn't re-sent and the in-app feed/list can reflect it.
  try {
    aws(['dynamodb', 'update-item', '--table-name', TABLE, '--region', REGION,
      '--key', JSON.stringify({ alertKey: { S: alertKey } }),
      '--update-expression', 'SET #s = :sent, sent = :true, sentAt = :now',
      '--expression-attribute-names', JSON.stringify({ '#s': 'status' }),
      '--expression-attribute-values', JSON.stringify({
        ':sent': { S: 'sent' }, ':true': { BOOL: true }, ':now': { S: new Date().toISOString() },
      })]);
    console.log('  marked status=sent.');
  } catch (e) {
    console.warn('  (sent, but failed to mark status=sent: ' + e.message + ')');
  }
})();
