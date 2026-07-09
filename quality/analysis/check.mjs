// quality/analysis/check.mjs — the honest verify system (a CHECK, not a benchmark).
//
// Analysis has no ground truth, so we don't SCORE it against a gold answer. We:
//   1. generate a few real analyses from live stories,
//   2. run the deterministic VALIDATOR (objective: phantom cite / invented figure /
//      invented date / no-citations — i.e. did it fabricate?),
//   3. ask the auditor for a one-line FAITHFULNESS FLAG (does any claim contradict the
//      sources?) — a flag, not a 1–5 score,
//   4. print them, and optionally EMAIL them so a human can vibe-check the quality.
//
// Quality/sharpness stays an editorial human judgment — this only guarantees no fabrication.
//
//   ANALYSIS_EVAL_KEY=sk-… node quality/analysis/check.mjs
//   ANALYSIS_EVAL_KEY=sk-… RESEND_API_KEY=re_… node quality/analysis/check.mjs --email you@x.com

import { writeFileSync } from 'node:fs';
import { runChat } from '../../global-perspectives-starter/frontend/src/services/llm.js';
import { SYSTEM_PROMPT, assembleContext, buildUserMessage, pickText, clip } from '../../global-perspectives-starter/frontend/src/utils/analysisPrompt.js';
import { validateAnalysis } from '../../global-perspectives-starter/frontend/src/utils/analysisValidator.js';
import { extractStruct } from '../../global-perspectives-starter/frontend/src/utils/analysisStruct.js';

const PROXY = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';
const KEY = process.env.ANALYSIS_EVAL_KEY;
const MODEL = process.env.ANALYSIS_BENCH_MODEL || 'deepseek-v4-flash';
const AUDITOR = process.env.ANALYSIS_AUDIT_MODEL || 'deepseek-v4-pro';
const emailIdx = process.argv.indexOf('--email');
const EMAIL_TO = emailIdx >= 0 ? (process.argv[emailIdx + 1] || 'benlai310@gmail.com') : null;
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : null; // write rendered HTML to a file (no secret needed)

// Which live stories to turn into examples (index sets + lens/mode).
const EXAMPLES = [
  { indices: [0], mode: 'guided', lens: 'scenario' },
  { indices: [0, 2, 3], mode: 'guided', lens: 'compare' },
  { indices: [1], mode: 'guided', lens: 'economic' },
];

async function proxy(action, payload = {}) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  let b = await r.json().catch(() => null);
  if (b && typeof b === 'object' && 'statusCode' in b && 'body' in b) b = typeof b.body === 'string' ? JSON.parse(b.body) : b.body;
  return b;
}

async function faithfulnessFlag(context, req, analysis) {
  const sys = 'You are a fact-checker. Given SOURCE MATERIAL and an ANALYSIS, reply with ONE sentence naming any claim in the analysis that is NOT supported by the material or contradicts it. If everything is supported, reply exactly "OK — all claims trace to the sources." No scores, no lists.';
  try {
    const { text } = await runChat({ provider: 'deepseek', model: AUDITOR, apiKey: KEY, system: sys, user: `SOURCE MATERIAL:\n${context}\n\n---\nREQUEST: ${req}\n\n---\nANALYSIS:\n${analysis}`, temperature: 0 });
    return text.trim();
  } catch (e) { return `(faithfulness check failed: ${e.message})`; }
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// minimal markdown → html for the email body
function mdHtml(md) {
  return esc(md)
    .replace(/^### (.*)$/gm, '<h4 style="margin:14px 0 4px">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 style="margin:16px 0 6px">$1</h3>')
    .replace(/^# (.*)$/gm, '<h2 style="margin:18px 0 8px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin:6px 0 6px 18px">$1</ul>')
    .replace(/\n\n/g, '<br><br>');
}

async function main() {
  if (!KEY) { console.error('Set ANALYSIS_EVAL_KEY.'); process.exit(1); }
  const td = await proxy('topics', {});
  const topics = (td?.data || td)?.topics || [];
  if (!topics.length) { console.error('No live topics.'); process.exit(1); }

  const out = [];
  for (const ex of EXAMPLES) {
    const picks = ex.indices.map((i) => topics[i]).filter(Boolean);
    const enriched = [];
    for (const t of picks) {
      const id = t.topicId || t.id;
      const [s, p, c] = await Promise.all([proxy('summary', { topicId: id }), proxy('prediction', { topicId: id }), proxy('trace_cause', { topicId: id })]);
      enriched.push({ topic: t, summary: clip(pickText(s)), prediction: clip(pickText(p)), trace: clip(pickText(c)) });
    }
    const { context, citations, thin } = assembleContext(enriched);
    const user = buildUserMessage({ context, mode: ex.mode, lensId: ex.lens, thin });
    const { text: rawAnalysis } = await runChat({ provider: 'deepseek', model: MODEL, apiKey: KEY, system: SYSTEM_PROMPT, user });
    // Strip the optional ```gp-struct``` block before validation/faithfulness/render —
    // same reason as AnalysisStudio.jsx: its bare numbers would false-trigger invented_figure.
    const { prose: analysis } = extractStruct(rawAnalysis);
    const checks = validateAnalysis(analysis, { citations, context, thinInput: thin });
    const flag = await faithfulnessFlag(context, `Guided lens: ${ex.lens}`, analysis);
    const item = { lens: ex.lens, citations, analysis, checks, flag };
    out.push(item);
    const status = checks.hasError ? 'FABRICATION (hard-fail)' : checks.warnings.length ? `verify: ${checks.warnings.map((w) => w.code).join(', ')}` : 'clean';
    console.log(`\n■ ${ex.lens} — stories: ${citations.map((c) => c.n + '. ' + c.title.slice(0, 50)).join(' | ')}`);
    console.log(`  check: ${status}`);
    console.log(`  faithfulness: ${flag}`);
  }

  if (EMAIL_TO || OUT) {
    const blocks = out.map((it, i) => {
      const st = it.checks.hasError ? '<span style="color:#c0392b">⚠ possible fabrication</span>'
        : it.checks.warnings.length ? `<span style="color:#caa23a">verify: ${it.checks.warnings.map((w) => w.code).join(', ')}</span>`
          : '<span style="color:#2e7d52">✓ no fabrication detected</span>';
      const srcs = it.citations.map((c) => `[${c.n}] ${esc(c.title)}`).join('<br>');
      return `<div style="margin:0 0 28px;padding:0 0 20px;border-bottom:1px solid #eee">
        <div style="font:600 13px/1.4 -apple-system,sans-serif;color:#888;text-transform:uppercase;letter-spacing:.04em">Example ${i + 1} · ${esc(it.lens)} lens</div>
        <div style="font:13px/1.5 -apple-system,sans-serif;color:#555;margin:6px 0">${srcs}</div>
        <div style="margin:8px 0">Automated check: ${st}</div>
        <div style="margin:8px 0;color:#555;font:13px/1.5 -apple-system,sans-serif"><strong>Faithfulness:</strong> ${esc(it.flag)}</div>
        <div style="font:15px/1.6 Georgia,serif;color:#222;margin-top:10px">${mdHtml(it.analysis)}</div>
      </div>`;
    }).join('');
    const html = `<div style="max-width:680px;margin:0 auto;padding:24px;font-family:-apple-system,sans-serif">
      <h1 style="font:700 22px/1.2 Georgia,serif">Analysis Studio — samples to vibe-check</h1>
      <p style="color:#666;font-size:14px">${out.length} live examples generated by ${esc(MODEL)}. The automated check guarantees no fabrication (real sources, no invented figures/dates); <strong>quality is for you to judge</strong>.</p>
      ${blocks}
      <p style="color:#999;font-size:12px">Generated from globalperspective.net live stories · ${esc(MODEL)} (non-thinking) · auditor ${esc(AUDITOR)}</p>
    </div>`;

    if (OUT) { writeFileSync(OUT, html); console.log(`\n✓ wrote rendered samples → ${OUT}`); }

    if (EMAIL_TO) {
      const RK = process.env.RESEND_API_KEY;
      if (!RK) { console.error('\n--email given but no RESEND_API_KEY set.'); process.exit(1); }
      const FROM = process.env.EMAIL_FROM || 'Global Perspectives <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${RK}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [EMAIL_TO], subject: `Analysis Studio — ${out.length} samples to vibe-check`, html }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) { console.error(`\nEmail FAILED ${res.status}:`, JSON.stringify(body)); process.exit(1); }
      console.log(`\n✓ emailed ${out.length} samples to ${EMAIL_TO} (id: ${body?.id || '?'})`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
