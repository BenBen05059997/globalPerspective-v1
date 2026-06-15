// quality/analysis/source_check.mjs — the SOURCE-TRUTH check (faithfulness ≠ truth).
//
// Our other checks verify the analysis is faithful to our summary. This checks the
// thing underneath: is the SOURCE trustworthy, and did OUR summary drift from it?
//
//   L1  — source robustness (deterministic, no model call): corroboration (# distinct
//         outlets) + tier/outlet-type mix from topic.sources[]. Single-source / low-tier
//         ⇒ "unverified". (NewsGuard-style outlet credibility is a paid upgrade later.)
//   L1.5 — summary-faithfulness (LLM): compare OUR cached summary back to the RAW article
//         snippets and flag drift the analysis layer can't see — hedge-stripping
//         ("could"→"is"), over-generalization, or framing ADDED beyond the sources.
//
//   ANALYSIS_EVAL_KEY=sk-… node quality/analysis/source_check.mjs [howMany]
//   node quality/analysis/source_check.mjs --l1-only      # robustness only, no key

import { runChat } from '../../global-perspectives-starter/frontend/src/services/llm.js';

const PROXY = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';
const KEY = process.env.ANALYSIS_EVAL_KEY;
const MODEL = process.env.ANALYSIS_AUDIT_MODEL || 'deepseek-v4-pro';
const L1_ONLY = process.argv.includes('--l1-only');
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8);

const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', rst: '\x1b[0m' };

async function proxy(action, payload = {}) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  let b = await r.json().catch(() => null);
  if (b && typeof b === 'object' && 'statusCode' in b && 'body' in b) b = typeof b.body === 'string' ? JSON.parse(b.body) : b.body;
  return b;
}

// L1 — deterministic source robustness from the sources[] metadata we already store.
function robustness(sources) {
  const n = sources.length;
  const outlets = new Set(sources.map((s) => (s.source || '').toLowerCase()).filter(Boolean));
  const primary = sources.filter((s) => s.tier === 'primary').length;
  const types = {};
  for (const s of sources) types[s.outletType || '?'] = (types[s.outletType || '?'] || 0) + 1;
  const lowOnly = sources.every((s) => ['social', 'blog', 'opinion'].includes(s.outletType));
  let label, color;
  if (n === 0) { label = 'NO SOURCES'; color = C.red; }
  else if (n === 1 || outlets.size === 1) { label = 'SINGLE-SOURCE — unverified'; color = C.red; }
  else if (lowOnly) { label = 'LOW-CREDIBILITY ONLY'; color = C.red; }
  else if (outlets.size >= 4 && primary >= 2) { label = 'WELL-SOURCED'; color = C.grn; }
  else if (outlets.size >= 2) { label = 'MODERATE'; color = C.yel; }
  else { label = 'WEAK'; color = C.yel; }
  return { n, outlets: outlets.size, primary, types, label, color };
}

const DRIFT_SYS = [
  'You are a source auditor. You are given the FULL ARTICLE TEXT (as extracted from the page; it may include some nav/boilerplate noise — ignore that) and OUR SUMMARY of it.',
  'List any claim in OUR SUMMARY that is NOT supported by the article text — especially: (a) a hedge turned into an assertion ("could"→"is/causing"); (b) a specific generalized or invented beyond the article; (c) framing or interpretation ADDED that is not in the article.',
  'Only flag claims genuinely absent from or contradicted by the article text — if the article supports it anywhere, do not flag it. Be terse: one short line per drift, or reply EXACTLY "OK — summary supported by the article." if there is none.',
].join(' ');

// Strip HTML to readable-ish text (no deps). Crude but enough for an LLM to judge support.
function htmlToText(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch + extract one article. Returns { ok, text } or { ok:false, status }.
async function fetchArticle(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GP-source-check/1.0; +https://globalperspective.net)', Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    if (!r.ok) return { ok: false, status: String(r.status) };
    const text = htmlToText(await r.text());
    if (text.length < 500) return { ok: false, status: 'thin' };
    return { ok: true, text };
  } catch (e) { return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : (e.name || 'err') }; }
}

async function main() {
  const topics = (await proxy('topics')).data?.topics || [];
  if (!topics.length) { console.error('No live topics.'); process.exit(1); }
  console.log(`Source-truth check · ${Math.min(N, topics.length)} live stories${L1_ONLY ? ' (L1 only)' : ` · drift auditor ${MODEL}`}\n`);
  if (!L1_ONLY && !KEY) { console.error('Set ANALYSIS_EVAL_KEY for L1.5 (or pass --l1-only).'); process.exit(1); }

  let single = 0;
  for (const t of topics.slice(0, N)) {
    const sources = t.sources || [];
    const r = robustness(sources);
    if (r.label.startsWith('SINGLE')) single++;
    console.log(`${r.color}■ ${r.label}${C.rst}  ${(t.title || '').slice(0, 64)}`);
    console.log(`   L1: ${r.n} sources · ${r.outlets} outlets · ${r.primary} primary · ${JSON.stringify(r.types)}${C.dim} (significance=${t.significance})${C.rst}`);

    if (!L1_ONLY) {
      const sm = await proxy('summary', { topicId: t.topicId || t.id });
      const summary = (sm?.data?.content || sm?.data?.summary || sm?.content || '').slice(0, 1500);
      if (!summary) { console.log(`   ${C.dim}L1.5: (no cached summary)${C.rst}`); continue; }

      // Fetch the FULL article from MULTIPLE cited outlets (so a claim attributed to any
      // of them is covered), concatenate; fall back to snippets only if all fetches fail.
      const parts = [], outletsUsed = [];
      for (const s of sources.filter((x) => x.url).slice(0, 5)) {
        if (parts.length >= 3) break;
        const a = await fetchArticle(s.url);
        if (a.ok) { parts.push(`[${s.source}]\n${a.text.slice(0, 5000)}`); outletsUsed.push(s.source); }
      }
      let basis, label;
      if (parts.length) { basis = parts.join('\n\n---\n\n').slice(0, 13000); label = `full articles via ${outletsUsed.join(', ')}`; }
      else { basis = sources.map((s, i) => `(${i + 1}) [${s.source}] ${s.snippet || ''}`).join('\n').slice(0, 4000); label = `SNIPPET-fallback (all fetches failed)`; }
      let drift = '';
      try {
        ({ text: drift } = await runChat({ provider: 'deepseek', model: MODEL, apiKey: KEY, system: DRIFT_SYS,
          user: `ARTICLE TEXT (${label}):\n${basis}\n\n---\nOUR SUMMARY:\n${summary}`, temperature: 0 }));
      } catch (e) { drift = `(drift check failed: ${e.message})`; }
      const clean = /^OK —/.test(drift.trim());
      console.log(`   ${C.dim}L1.5 basis: ${label}${C.rst}`);
      console.log(`   ${clean ? C.grn : C.yel}L1.5 summary-faithfulness: ${drift.trim().slice(0, 450)}${C.rst}`);
    }
  }
  console.log(`\n${single}/${Math.min(N, topics.length)} stories are single-source (would be confidence-downgraded).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
