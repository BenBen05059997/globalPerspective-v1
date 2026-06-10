#!/usr/bin/env node
'use strict';

/**
 * breaking/send-test.js — render a sample breaking alert and ACTUALLY send it via
 * Resend, so you can see the real email in your inbox.
 *
 * Run with your own Resend API key (never committed — a plaintext env var):
 *
 *   RESEND_API_KEY=re_xxx node breaking/send-test.js [recipient] [from]
 *
 * Defaults:
 *   recipient = benlai310@gmail.com
 *   from      = onboarding@resend.dev   ← Resend's built-in test sender. It delivers
 *               ONLY to the email your Resend account is registered under, with ZERO
 *               domain setup — perfect for a first test. For real sends to anyone,
 *               verify globalperspective.net in Resend and use e.g.
 *               "Global Perspectives <alerts@globalperspective.net>".
 */

const path = require('path');
const SRC = path.join(__dirname, '..', 'amplify', 'backend', 'function', 'newsBreakingAlert', 'src');
const { renderAlert } = require(path.join(SRC, 'render.js'));
const { sendEmail } = require(path.join(SRC, 'sendEmail.js'));

const to = process.argv[2] || 'benlai310@gmail.com';
const from = process.argv[3] || 'onboarding@resend.dev';

const sample = renderAlert({
  title: 'Strait of Hormuz partial closure threatens 20% of global oil flow',
  category: 'conflict',
  regions: ['Iran', 'United States', 'Saudi Arabia'],
  threadUrl: 'https://globalperspective.net/weekly/thread/thread-hormuz-7f3a',
  summary:
    '- Iran announced it will restrict tanker transit through the strait in response to new sanctions.\n' +
    '- Brent crude opened up sharply; insurers began pricing war-risk premiums.\n' +
    '- Three Gulf states called an emergency session.',
  prediction:
    'A coordinated naval escort response is likely within days. If transit is not restored ' +
    'inside two weeks, expect sustained upward pressure on oil and a hit to Asian importers.',
  economic: { direction: 'up', magnitude: 'large' },
  traceCause: {
    proximate: { what: 'A new round of sanctions targeting Iranian oil exports took effect this week.', when: 'this week' },
    contributing: [
      { factor: 'Stalled nuclear talks removed the main diplomatic off-ramp', evidence: 'Negotiations in Vienna lapsed without a follow-up date.' },
      { factor: 'Naval build-up on both sides raised the cost of backing down', evidence: 'Two carrier groups now operate in the region.' },
    ],
    structural: { factor: 'The strait is a chokepoint with no economic substitute for ~20% of seaborne oil', depth: 'decades' },
    alternativePerspective: 'Tehran frames the move as defensive against an economic blockade, a view largely absent from Western coverage.',
    signalVsNoise: { verdict: 'True Signal', confidence: 'High' },
  },
  sources: [
    { title: 'Reuters — Iran restricts Hormuz transit', url: 'https://reuters.com/world/hormuz' },
    { title: 'AP — Gulf states convene', url: 'https://apnews.com/gulf' },
  ],
});

(async () => {
  if (!process.env.RESEND_API_KEY) {
    console.error('✗ Set your key first:  RESEND_API_KEY=re_xxx node breaking/send-test.js');
    process.exit(1);
  }
  console.log(`Sending sample breaking alert → ${to}  (from: ${from})`);
  console.log(`Subject: ${sample.subject}\n`);
  try {
    const r = await sendEmail({ from, to, subject: sample.subject, text: sample.text, html: sample.html });
    console.log(`✓ Sent (id: ${r.id || 'n/a'}). Check ${to} — including spam, since the test sender isn't your domain yet.`);
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
})();
