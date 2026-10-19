'use strict';

// Provider-agnostic email send. Currently Resend (chosen 2026-06-10 over SES for DX +
// no sandbox-approval wait; see BREAKING_ALERTS_PLAN.md). This is the ONLY file that
// knows the provider — swapping providers later is a rewrite of this one function;
// callers pass plain { from, to, subject, text, html }.
//
// No npm dependency — uses global fetch (Node 18+ / Lambda nodejs20.x). The API key is
// read from RESEND_API_KEY (a plaintext env var, matching the project's chosen secret
// store — see feedback-no-secrets-manager).

async function sendEmail({ apiKey, from, to, subject, text, html, replyTo }) {
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
