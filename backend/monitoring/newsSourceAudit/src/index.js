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
const { chat } = require('./_shared/llm');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PROXY = process.env.PROXY_ENDPOINT;
const MODEL = process.env.AUDIT_MODEL || 'deepseek-v4-pro';
const TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const N = parseInt(process.env.AUDIT_N || '6', 10);
const THRESHOLD = parseInt(process.env.DRIFT_ALERT_THRESHOLD || '2', 10);

const sns = new SNSClient({ region: REGION });

async function proxy(action, payload = {}) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) });
  if (!r.ok) throw new Error(`proxy ${action} HTTP ${r.status}`);
  let b = await r.json();
  if (b && Number(b.statusCode) >= 400) throw new Error(`proxy ${action} HTTP ${b.statusCode}`);
  if (b && typeof b === 'object' && 'statusCode' in b && 'body' in b) b = typeof b.body === 'string' ? JSON.parse(b.body) : b.body;
  if (!b || b.success === false) throw new Error(`proxy ${action} returned no usable data`);
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
  return (await chat({ step: 'source_audit', model: MODEL, system, user, maxTokens: 400, temperature: 0 })).content;
}

exports.handler = async () => {
  const topics = (await proxy('topics'))?.data?.topics || [];
  if (!topics.length) { console.log('No topics — skipping audit.'); return { ok: true, skipped: 'no-topics', checked: 0, audited: 0, drift: 0, auditErrors: 0 }; }

  const drifted = [];
  const auditErrors = [];
  let audited = 0;
  let single = 0;
  for (const t of topics.slice(0, N)) {
    const sources = t.sources || [];
    const rob = robustness(sources);
    if (rob === 'single' || rob === 'none') single++;

    try {
      const sm = await proxy('summary', { topicId: t.topicId || t.id });
      const summary = (sm?.data?.content || sm?.data?.summary || sm?.content || '').slice(0, 1500);
      if (!summary) throw new Error('no-summary');
      const parts = [];
      for (const source of sources.filter(x => x.url).slice(0, 5)) {
        if (parts.length >= 3) break;
        const article = await fetchArticle(source.url);
        if (article) parts.push(`[${source.source}]\n${article.slice(0, 5000)}`);
      }
      const basis = parts.length ? parts.join('\n\n---\n\n').slice(0, 13000)
        : sources.filter(source => String(source.snippet || '').trim()).map(source => `[${source.source}] ${source.snippet}`).join('\n').slice(0, 4000);
      if (!basis.trim()) throw new Error('no-source-text');
      const drift = (await deepseek(DRIFT_SYS, `ARTICLE TEXT:\n${basis}\n\n---\nOUR SUMMARY:\n${summary}`)).trim();
      if (!drift) throw new Error('empty-audit-response');
      const verdict = /^OK\b/i.test(drift) ? 'OK' : drift;
      audited++;
      if (verdict !== 'OK') drifted.push({ title: t.title, rob, drift: verdict.slice(0, 300) });
      console.log(`[audit] ${rob.padEnd(12)} | ${verdict === 'OK' ? 'OK' : 'DRIFT'} | ${(t.title || '').slice(0, 70)}`);
    } catch (error) {
      auditErrors.push({ topicId: t.topicId || t.id, title: t.title, error: error.message });
      console.error(`[audit] ${rob.padEnd(12)} | AUDIT_ERROR | ${(t.title || '').slice(0, 70)}: ${error.message}`);
    }
  }

  const summaryLine = `Source audit: ${drifted.length} summary-drift / ${auditErrors.length} audit-errors / ${single} single-source of ${Math.min(N, topics.length)} checked.`;
  console.log(summaryLine);

  if (auditErrors.length) console.error('[pipeline-status] ' + JSON.stringify({ status: 'failed', reason: 'source-audit-errors', auditErrors: auditErrors.length, drift: drifted.length, audited }));
  if ((drifted.length >= THRESHOLD || auditErrors.length) && TOPIC_ARN) {
    const body = [
      summaryLine, '',
      'Audit failures (not evidence of drift):',
      ...auditErrors.map(e => `${e.topicId}: ${e.error}`), '',
      'Stories where OUR summary drifted from the source (possible fabrication):', '',
      ...drifted.map((d, i) => `${i + 1}. [${d.rob}] ${d.title}\n   → ${d.drift}`),
      '', 'Investigate the summarizer (NewsProjectInvokeAgentLambda). Run: node quality/analysis/source_check.mjs',
    ].join('\n');
    await sns.send(new PublishCommand({ TopicArn: TOPIC_ARN, Subject: `Source audit: ${drifted.length} drift, ${auditErrors.length} audit errors`, Message: body }));
    console.log('Alert sent to SNS.');
  }
  return { ok: auditErrors.length === 0, checked: Math.min(N, topics.length), audited, auditErrors: auditErrors.length, errors: auditErrors, drift: drifted.length, single };
};
