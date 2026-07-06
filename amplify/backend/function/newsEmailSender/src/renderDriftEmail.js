'use strict';

// Renders a country's fresh drift notes (the self-correcting-analysis "what changed & why")
// to { subject, text, html } for the member drift-alert email (MEMBER_GATING_PLAN.md P5).
// No new facts minted — this only formats fields newsDriftCorrector already wrote to the
// DRIFT#<date> rows: the change (risk level / score) + the grounded, cited reason.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(s || '');
}

// What moved — prefer the risk-level change, else the numeric score, else a neutral phrase.
function changeLabel(n) {
  const cl = n.changeLevel;
  if (cl && cl.from && cl.to && cl.from !== cl.to) return `${cl.from} → ${cl.to}`;
  const cs = n.changeScore;
  if (cs && cs.from != null && cs.to != null) return `risk ${cs.from} → ${cs.to}`;
  return 'read revised';
}

// Why it moved — the grounded reason, in the corrector's own precedence.
function whyLine(n) {
  if (n.noSingleDriver) return 'No single driver — a gradual shift across the coverage, not one event.';
  if (n.triggerEvent && n.triggerEvent.title) {
    return `Because: ${n.triggerEvent.title}${n.triggerEvent.date ? ` (${fmtDay(n.triggerEvent.date)})` : ''}`;
  }
  return n.whyChanged || '';
}

function renderDriftEmail(country, notes, { siteUrl, unsubUrl } = {}) {
  const site = (siteUrl || 'https://globalperspective.net').replace(/\/$/, '');
  const list = Array.isArray(notes) ? notes.slice() : [];
  // Newest first.
  list.sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
  const countryUrl = `${site}/weekly/country/${encodeURIComponent(country)}`;
  const n = list.length;

  const subject = n === 1
    ? `${country}: our read changed — ${changeLabel(list[0])}`
    : `${country}: ${n} updates to our read`;

  // ── plain text ──
  const tLines = [];
  tLines.push(`OUR READ ON ${String(country).toUpperCase()} CHANGED`);
  tLines.push(`${n} correction${n === 1 ? '' : 's'} since you last heard.`);
  tLines.push('');
  list.forEach((note) => {
    tLines.push(`• ${changeLabel(note)}  ·  ${fmtDay(note.asOf)}`);
    const why = whyLine(note);
    if (why) tLines.push(`  ${why}`);
    tLines.push('');
  });
  tLines.push(`See the full living analysis: ${countryUrl}`);
  if (unsubUrl) tLines.push(`Stop following ${country} / unsubscribe: ${unsubUrl}`);
  const text = tLines.join('\n');

  // ── html ──
  const rows = list.map((note) => {
    const why = whyLine(note);
    return `
      <tr><td style="padding:16px 0;border-bottom:1px solid #ececea;">
        <div style="font:600 15px/1.35 Georgia,serif;color:#1a1a1a;">${esc(changeLabel(note))}
          <span style="font:11px/1.4 monospace;color:#888;font-weight:400;"> · ${esc(fmtDay(note.asOf))}</span></div>
        ${why ? `<div style="font:400 13px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#555;margin-top:5px;">↳ ${esc(why)}</div>` : ''}
      </td></tr>`;
  }).join('');

  const html = `<!doctype html><html><body style="margin:0;background:#faf9f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;padding:24px 0;"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e3df;border-radius:8px;padding:28px;">
        <tr><td>
          <div style="font:700 12px/1.4 monospace;letter-spacing:.1em;color:#888;text-transform:uppercase;">Analysis change-alert</div>
          <h1 style="font:600 23px/1.3 Georgia,serif;color:#1a1a1a;margin:12px 0 4px;">Our read on ${esc(country)} changed</h1>
          <div style="font:400 13px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#666;">${n} grounded correction${n === 1 ? '' : 's'} — what moved, and the cited reason it moved.</div>
        </td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
        <tr><td style="padding-top:24px;">
          <a href="${esc(countryUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;font:600 13px/1 -apple-system,Helvetica,Arial,sans-serif;text-decoration:none;padding:11px 18px;border-radius:6px;">See the full living analysis →</a>
        </td></tr>
        <tr><td style="padding-top:22px;border-top:1px solid #ececea;">
          <div style="font:400 11px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#999;">
            You follow ${esc(country)} on Global Perspectives — we alert you only when a <em>conclusion</em> moves and a real cited event explains it. Never a silent overwrite.
            ${unsubUrl ? `<br><a href="${esc(unsubUrl)}" style="color:#999;">Stop these change-alerts</a>` : ''}
          </div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  return { subject, text, html };
}

module.exports = { renderDriftEmail };
