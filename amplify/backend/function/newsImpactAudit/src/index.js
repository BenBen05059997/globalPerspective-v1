'use strict';

// newsImpactAudit — daily independent audit of the news selector's IMPACT judgment.
//
// Reads the latest GlobalPerspectiveIngestCapture row (what the selector SAW vs CHOSE), asks
// DeepSeek — judging IMPACT not loudness — what HIGH-impact events were MISSED, writes the verdict
// to GlobalPerspectiveImpactAudit (the metric), and SNS-alerts the operator if misses ≥ threshold.
//
// IMPORTANT: it does NOT modify the live feed. Measure + alert only — a dead-man's-switch, like
// newsSourceAudit. Auto-correction is a later, gated step. See IMPACT_AUDITOR.md /
// IMPACT_VALIDATION_METHODOLOGY.md.
//
// Uses the SAME model family as the selector (DeepSeek) by operator choice — the prompt is primed
// to hunt the known blind spot (under-covered atrocity/displacement/Africa) to offset the
// correlated-error risk of same-model auditing.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const CAPTURE_TABLE = process.env.INGEST_CAPTURE_TABLE || 'GlobalPerspectiveIngestCapture';
const AUDIT_TABLE = process.env.IMPACT_AUDIT_TABLE || 'GlobalPerspectiveImpactAudit';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const MISS_ALERT_THRESHOLD = Number(process.env.MISS_ALERT_THRESHOLD) || 2;
const API_KEY = process.env.XAI_API_KEY; // legacy name — holds the DeepSeek key in prod
const API_URL = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.GROK_MODEL || 'deepseek-chat';
const AUDIT_TTL_DAYS = Number(process.env.AUDIT_TTL_DAYS) || 90;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sns = new SNSClient({ region: REGION });

// Newest capture row (PK runId is an ISO timestamp; few rows → scan + sort).
async function latestCapture() {
  const out = await ddb.send(new ScanCommand({ TableName: CAPTURE_TABLE }));
  const items = out.Items || [];
  if (!items.length) return null;
  items.sort((a, b) => String(b.runId).localeCompare(String(a.runId)));
  return items[0];
}

const RUBRIC =
  'Judge IMPACT, not loudness/coverage. Weigh: reach (people/countries materially affected), '
  + 'severity (lives, economic scale, rights/sovereignty), irreversibility (a threshold that cannot '
  + 'be undone — deaths, war, coup, default, collapse), novelty (a genuine discontinuity vs routine, '
  + 'ongoing, opinion or explainer). HIGH-impact = high reach+severity, especially irreversible. Be '
  + 'ESPECIALLY alert to high-severity but UNDER-COVERED events — mass atrocity, genocide, mass '
  + 'displacement, coups, and disasters in under-amplified regions (e.g. Africa) — these are exactly '
  + 'what a loudness-biased selector drops. Ignore real noise: sports, celebrity, human-interest, '
  + 'opinion/explainers, how-to pieces.';

async function audit(input, chosen) {
  const inputList = input
    .map((a, i) => `${i + 1}. ${a.title} — ${a.source}${a.snippet ? ` :: ${a.snippet}` : ''}`)
    .join('\n');
  const chosenList = chosen.map((c, i) => `${i + 1}. [${c.category || '?'}] ${c.title}`).join('\n');
  const sys = 'You are an independent IMPACT AUDITOR for a world-news selector. Output ONLY valid JSON, no prose.';
  const user =
    `${RUBRIC}\n\nThe selector CHOSE these ${chosen.length} events to surface:\n${chosenList}\n\n`
    + `It SAW these ${input.length} articles (the full pool):\n${inputList}\n\n`
    + 'Return JSON exactly:\n'
    + '{"missed":[{"title":"","source":"","why":"","dimension":"reach|severity|irreversibility|novelty"}],'
    + '"questionable":[{"title":"","reason":""}],"verdict":"strong|decent|weak","quality_note":"",'
    + '"dominant_pattern":""}\n'
    + 'In "missed", list ONLY genuinely HIGH-impact events the selector dropped, grounded in the '
    + 'titles/snippets (do not invent facts). Empty array if none.';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: 0.2,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

exports.handler = async () => {
  const cap = await latestCapture();
  if (!cap) { console.warn('[impact-audit] no capture rows'); return { ok: false, reason: 'no_capture' }; }
  const input = cap.input || [];
  const chosen = cap.chosen || [];

  let result;
  try { result = await audit(input, chosen); }
  catch (e) { console.error('[impact-audit] audit failed:', e.message); return { ok: false, error: e.message }; }

  const missed = Array.isArray(result.missed) ? result.missed : [];
  const now = new Date().toISOString();
  const item = {
    auditId: `AUDIT#${now}`,
    capturedRunId: cap.runId,
    auditedAt: now,
    inputCount: input.length,
    chosenCount: chosen.length,
    missCount: missed.length,
    verdict: result.verdict || null,
    dominantPattern: result.dominant_pattern || null,
    qualityNote: result.quality_note || null,
    missed,
    questionable: Array.isArray(result.questionable) ? result.questionable : [],
    ttl: Math.floor(Date.now() / 1000) + AUDIT_TTL_DAYS * 86400,
  };
  try { await ddb.send(new PutCommand({ TableName: AUDIT_TABLE, Item: item })); }
  catch (e) { console.warn('[impact-audit] write failed:', e.message); }

  console.log(`[impact-audit] missed=${missed.length} verdict=${result.verdict} pattern=${result.dominant_pattern || ''}`);

  // Alert only — never modifies the live feed.
  if (missed.length >= MISS_ALERT_THRESHOLD && SNS_TOPIC_ARN) {
    const body = [
      `The news selector MISSED ${missed.length} high-impact events (cycle ${cap.runId}).`,
      `Verdict: ${result.verdict}. Pattern: ${result.dominant_pattern || ''}`,
      '',
      ...missed.map((m, i) => `${i + 1}. [${m.dimension}] ${m.title} (${m.source})\n   → ${m.why}`),
      '',
      'This is a measurement + alert. It does NOT change what readers saw. Review and decide.',
    ].join('\n');
    try {
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `⚠ Impact audit: ${missed.length} high-impact stories missed`,
        Message: body,
      }));
      console.log('[impact-audit] SNS alert sent');
    } catch (e) { console.warn('[impact-audit] SNS failed:', e.message); }
  }

  return { ok: true, missed: missed.length, verdict: result.verdict };
};
