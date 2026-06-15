'use strict';
/**
 * newsSourceAudit — scheduled source-truth audit (dead-man's-switch for the summarizer).
 *
 * Faithfulness/quality checks verify the OUTPUT; this verifies the INPUT is trustworthy and
 * that OUR summary did not drift from the source — the gap that let the summarizer fabricate
 * a vote result. Self-contained port of quality/analysis/source_check.mjs.
 *
 * Per run, for the top N live topics:
 *   L1  (deterministic): source robustness from sources[] — single-source/low-tier ⇒ unverified.
 *   L1.5 (LLM): fetch the full article(s) and ask the auditor whether OUR cached summary drifts
 *        (hedge-stripping / invented result / added framing). Classifies DRIFT vs OK.
 * If confirmed-drift count ≥ DRIFT_ALERT_THRESHOLD, SNS-email an alert. Always logs to CloudWatch.
 *
 * Env: PROXY_ENDPOINT, XAI_API_KEY, GROK_API_URL (DeepSeek base), AUDIT_MODEL,
 *      SNS_TOPIC_ARN, AUDIT_N (default 6), DRIFT_ALERT_THRESHOLD (default 2).
 */
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PROXY = process.env.PROXY_ENDPOINT;
const KEY = process.env.XAI_API_KEY;
const BASE = (process.env.GROK_API_URL || 'https://api.deepseek.com').replace(/\/chat\/completions$/, '');
const MODEL = process.env.AUDIT_MODEL || 'deepseek-v4-pro';
const TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const N = parseInt(process.env.AUDIT_N || '6', 10);
const THRESHOLD = parseInt(process.env.DRIFT_ALERT_THRESHOLD || '2', 10);

const sns = new SNSClient({ region: REGION });

async function proxy(action, payload = {}) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  let b = await r.json().catch(() => null);
  if (b && typeof b === 'object' && 'statusCode' in b && 'body' in b) b = typeof b.body === 'string' ? JSON.parse(b.body) : b.body;
  return b;
}

function robustness(sources) {
  const n = sources.length;
  const outlets = new Set(sources.map((s) => (s.source || '').toLowerCase()).filter(Boolean));
  const lowOnly = n > 0 && sources.every((s) => ['social', 'blog', 'opinion'].includes(s.outletType));
  if (n === 0) return 'none';
  if (n === 1 || outlets.size === 1) return 'single';
  if (lowOnly) return 'low';
  if (outlets.size >= 2) return 'corroborated';
  return 'weak';
}

function htmlToText(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
async function fetchArticle(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GP-source-audit/1.0)' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
    if (!r.ok) return null;
    const t = htmlToText(await r.text());
    return t.length >= 500 ? t : null;
  } catch { return null; }
}

const DRIFT_SYS = 'You are a source auditor. Given the FULL ARTICLE TEXT (may include nav noise — ignore it) and OUR SUMMARY, list any claim in OUR SUMMARY not supported by the article — hedge turned into assertion, an invented result/figure/date, or added framing. Only flag claims genuinely absent or contradicted. Reply with one terse line per drift, or EXACTLY "OK" if none.';

async function deepseek(system, user) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, temperature: 0, thinking: { type: 'disabled' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const b = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${JSON.stringify(b)?.slice(0, 200)}`);
  return b?.choices?.[0]?.message?.content || '';
}

exports.handler = async () => {
  const topics = (await proxy('topics'))?.data?.topics || [];
  if (!topics.length) { console.log('No topics — skipping audit.'); return { ok: false, reason: 'no-topics' }; }

  const drifted = [];
  let single = 0;
  for (const t of topics.slice(0, N)) {
    const sources = t.sources || [];
    const rob = robustness(sources);
    if (rob === 'single' || rob === 'none') single++;

    const sm = await proxy('summary', { topicId: t.topicId || t.id });
    const summary = (sm?.data?.content || sm?.data?.summary || sm?.content || '').slice(0, 1500);
    let verdict = 'no-summary';
    if (summary) {
      const parts = [];
      for (const s of sources.filter((x) => x.url).slice(0, 5)) {
        if (parts.length >= 3) break;
        const a = await fetchArticle(s.url);
        if (a) parts.push(`[${s.source}]\n${a.slice(0, 5000)}`);
      }
      const basis = parts.length ? parts.join('\n\n---\n\n').slice(0, 13000)
        : sources.map((s) => `[${s.source}] ${s.snippet || ''}`).join('\n').slice(0, 4000);
      try {
        const drift = (await deepseek(DRIFT_SYS, `ARTICLE TEXT:\n${basis}\n\n---\nOUR SUMMARY:\n${summary}`)).trim();
        verdict = /^OK\b/i.test(drift) ? 'OK' : drift;
        if (verdict !== 'OK') drifted.push({ title: t.title, rob, drift: verdict.slice(0, 300) });
      } catch (e) { verdict = `audit-error: ${e.message}`; }
    }
    console.log(`[audit] ${rob.padEnd(12)} | ${verdict === 'OK' ? 'OK' : 'DRIFT'} | ${(t.title || '').slice(0, 70)}`);
  }

  const summaryLine = `Source audit: ${drifted.length} summary-drift / ${single} single-source of ${Math.min(N, topics.length)} checked.`;
  console.log(summaryLine);

  if (drifted.length >= THRESHOLD && TOPIC_ARN) {
    const body = [
      summaryLine, '',
      'Stories where OUR summary drifted from the source (possible fabrication):', '',
      ...drifted.map((d, i) => `${i + 1}. [${d.rob}] ${d.title}\n   → ${d.drift}`),
      '', 'Investigate the summarizer (NewsProjectInvokeAgentLambda). Run: node quality/analysis/source_check.mjs',
    ].join('\n');
    await sns.send(new PublishCommand({ TopicArn: TOPIC_ARN, Subject: `⚠ Source audit: ${drifted.length} summaries drifted from sources`, Message: body }));
    console.log('Alert sent to SNS.');
  }
  return { ok: true, checked: Math.min(N, topics.length), drift: drifted.length, single };
};
