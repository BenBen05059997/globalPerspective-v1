'use strict';

// Renders a published WEEKLY_BRIEF (signals format) to { subject, text, html }.
// Mirrors what /weekly-brief shows: signals ranked by risk (fact + so-what,
// risk/development kind marked) + a "what to watch" list. No new facts minted —
// this only formats fields the generator already wrote.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtWeekOf(weekOf) {
  // weekOf is 'YYYY-MM-DD'; render "June 28, 2026" without Date parsing surprises.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekOf || ''));
  if (!m) return String(weekOf || '');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${months[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

function renderWeeklyEmail(brief, { siteUrl, unsubUrl } = {}) {
  const weekLabel = fmtWeekOf(brief.weekOf);
  const signals = Array.isArray(brief.signals) ? brief.signals : [];
  const watch = Array.isArray(brief.watch) ? brief.watch : [];
  const threats = signals.filter((s) => s.kind !== 'development');
  const highRisk = threats.filter((s) => s.riskLevel === 'high').length;
  const briefUrl = `${siteUrl || 'https://globalperspective.net'}/weekly-brief`;

  const subject = `Weekly Signals Brief — week of ${weekLabel}`;

  // ── plain text ──
  const tLines = [];
  tLines.push(`WEEKLY SIGNALS BRIEF — week of ${weekLabel}`);
  tLines.push(`${signals.length} signals · ${highRisk} at high risk · ${watch.length} to watch`);
  tLines.push('');
  signals.forEach((s, i) => {
    const tag = s.kind === 'development' ? 'DEVELOPMENT' : `${String(s.riskLevel || '').toUpperCase()} RISK`;
    tLines.push(`${i + 1}. [${tag}] ${s.lede || ''}`);
    if (s.fact) tLines.push(`   ${s.fact}`);
    if (s.soWhat) tLines.push(`   So what: ${s.soWhat}`);
    if (s.region) tLines.push(`   Region: ${s.region}${s.asOf ? ` · as of ${s.asOf}` : ''}`);
    tLines.push('');
  });
  if (watch.length) {
    tLines.push('WHAT TO WATCH');
    watch.forEach((w) => {
      tLines.push(`- ${w.event || ''}${w.date ? ` (${w.date})` : ''}`);
      if (w.stake) tLines.push(`  ${w.stake}`);
    });
    tLines.push('');
  }
  tLines.push(`Read on the site: ${briefUrl}`);
  if (unsubUrl) tLines.push(`Unsubscribe: ${unsubUrl}`);
  const text = tLines.join('\n');

  // ── html ──
  const sigHtml = signals.map((s, i) => {
    const isDev = s.kind === 'development';
    const tag = isDev ? 'DEVELOPMENT' : `${String(s.riskLevel || '').toUpperCase()} RISK`;
    const color = isDev ? '#5b6b7a' : (s.riskLevel === 'high' ? '#b03328' : s.riskLevel === 'elevated' ? '#c2622a' : s.riskLevel === 'moderate' ? '#caa23a' : '#3f8f6b');
    return `
      <tr><td style="padding:16px 0;border-bottom:1px solid #ececea;">
        <div style="font:600 11px/1.4 monospace;letter-spacing:.06em;color:${color};text-transform:uppercase;">${i + 1} · ${esc(tag)}</div>
        <div style="font:600 17px/1.35 Georgia,serif;color:#1a1a1a;margin:4px 0 6px;">${esc(s.lede)}</div>
        ${s.fact ? `<div style="font:400 14px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#333;">${esc(s.fact)}</div>` : ''}
        ${s.soWhat ? `<div style="font:400 13px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#555;margin-top:6px;"><b>So what:</b> ${esc(s.soWhat)}</div>` : ''}
        ${s.region ? `<div style="font:11px/1.4 monospace;color:#888;margin-top:6px;">${esc(s.region)}${s.asOf ? ` · as of ${esc(s.asOf)}` : ''}</div>` : ''}
      </td></tr>`;
  }).join('');

  const watchHtml = watch.length ? `
    <tr><td style="padding-top:22px;">
      <div style="font:700 12px/1.4 monospace;letter-spacing:.08em;color:#1a1a1a;text-transform:uppercase;border-bottom:2px solid #1a1a1a;padding-bottom:6px;">What to watch</div>
      ${watch.map((w) => `<div style="padding:10px 0;border-bottom:1px solid #ececea;">
        <div style="font:600 14px/1.4 Georgia,serif;color:#1a1a1a;">${esc(w.event)}${w.date ? ` <span style="font:11px monospace;color:#888;">(${esc(w.date)})</span>` : ''}</div>
        ${w.stake ? `<div style="font:400 13px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#555;margin-top:3px;">${esc(w.stake)}</div>` : ''}
      </div>`).join('')}
    </td></tr>` : '';

  const html = `<!doctype html><html><body style="margin:0;background:#faf9f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7;padding:24px 0;"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e3df;border-radius:8px;padding:28px;">
        <tr><td>
          <div style="font:700 12px/1.4 monospace;letter-spacing:.1em;color:#888;text-transform:uppercase;">Weekly Signals Brief</div>
          <div style="font:400 13px/1.4 monospace;color:#888;margin-top:4px;">Week of ${esc(weekLabel)} · ${signals.length} signals · ${highRisk} at high risk</div>
          <h1 style="font:600 24px/1.3 Georgia,serif;color:#1a1a1a;margin:14px 0 4px;">The week's signals, ranked by risk</h1>
        </td></tr>
        <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sigHtml}${watchHtml}</table></td></tr>
        <tr><td style="padding-top:24px;">
          <a href="${esc(briefUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;font:600 13px/1 -apple-system,Helvetica,Arial,sans-serif;text-decoration:none;padding:11px 18px;border-radius:6px;">Read on the site →</a>
        </td></tr>
        <tr><td style="padding-top:22px;border-top:1px solid #ececea;margin-top:22px;">
          <div style="font:400 11px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#999;">
            Global Perspectives — AI news intelligence. Grounded in cited analysis; model judgment marked as judgment.
            ${unsubUrl ? `<br><a href="${esc(unsubUrl)}" style="color:#999;">Unsubscribe from the weekly brief</a>` : ''}
          </div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  return { subject, text, html };
}

module.exports = { renderWeeklyEmail };
