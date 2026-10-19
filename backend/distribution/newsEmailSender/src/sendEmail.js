'use strict';

// Provider-agnostic email send. Currently Resend. This is the ONLY file that knows
// the provider — swapping later is a rewrite of this one function; callers pass plain
// { from, to, subject, text, html, headers }.
//
// No npm dependency — uses global fetch (Node 18+ / Lambda nodejs20.x). Key from
// RESEND_API_KEY (plaintext env, project convention — see feedback-no-secrets-manager).
//
// Copied from newsBreakingAlert/src/sendEmail.js and EXTENDED with a `headers` param
// so the sender can attach List-Unsubscribe / List-Unsubscribe-Post (RFC 8058) for
// one-click unsubscribe + deliverability.

async function sendEmail({ apiKey, from, to, subject, text, html, replyTo, headers }) {
  const key = apiKey || process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY missing');
  if (!from) throw new Error('from address missing');
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) throw new Error('to address missing');
  if (!subject) throw new Error('subject missing');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(headers && Object.keys(headers).length ? { headers } : {}),
    }),
  });

  const raw = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* leave raw */ }
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${raw}`);
  }
  return { id: parsed?.id || null, status: res.status };
}

module.exports = { sendEmail };
