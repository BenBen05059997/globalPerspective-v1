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

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
// S8·T2 (2026-09-09): this audit is now fully S3 — no DynamoDB. GDACS + GDELT are read from the S3
// corpus (written by the ingest Lambdas); the selector capture is read from S3 (T2b: written by
// newsInvokeGemini); and the verdict is written to S3 `audit/impact/` (the GdacsEvents/GdeltConflict/
// ImpactAudit/IngestCapture tables were all dropped).
const CAPTURE_KEY = process.env.INGEST_CAPTURE_KEY || 'audit/ingest-capture/latest.json';
const GDACS_CORPUS_KEY = process.env.GDACS_CORPUS_KEY || 'corpus/gdacs/latest.json';
const GDELT_CORPUS_PREFIX = process.env.GDELT_CORPUS_PREFIX || 'corpus/gdelt';
const AUDIT_PREFIX = process.env.IMPACT_AUDIT_PREFIX || 'audit/impact';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const MISS_ALERT_THRESHOLD = Number(process.env.MISS_ALERT_THRESHOLD) || 2;
const API_KEY = process.env.XAI_API_KEY; // legacy name — holds the DeepSeek key in prod
const API_URL = process.env.GROK_API_URL || 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.GROK_MODEL || 'deepseek-v4-flash'; // deepseek-chat retired 2026-07-24; v4-flash is the current flash model (verified 2026-09-08)

const s3 = new S3Client({ region: REGION });
const sns = new SNSClient({ region: REGION });

async function s3GetJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: WORLD_BUCKET, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

// Latest selector capture — S3 stable pointer written by newsInvokeGemini each generation (T2b).
async function latestCapture() {
  return s3GetJson(CAPTURE_KEY); // { runId, input, chosen, ... } or null when absent
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
      thinking: { type: 'disabled' }, // V4 thinking-mode burns max_tokens on reasoning_content → truncated/empty output; disable (matches the fleet; this straggler missed the 2026-07-26 patch, added 2026-09-08)
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

// Deterministic, OBJECTIVE coverage gap: GDACS Orange/Red disasters the selector did not cover.
// No LLM opinion — a hard signal. "country_absent" = the disaster's country isn't even in today's
// selection (strong gap); "no_disaster_topic" = country present but no disaster-flavored topic.
const DISASTER_WORDS = ['flood', 'quake', 'earthquake', 'cyclone', 'hurricane', 'typhoon', 'storm',
  'wildfire', 'fire', 'volcan', 'eruption', 'drought', 'tsunami', 'landslide', 'disaster'];

async function gdacsCoverageGap(chosen) {
  let events;
  try {
    const doc = await s3GetJson(GDACS_CORPUS_KEY);
    // S8·T2: full current event set from S3 (all levels); filter Orange/Red here, as the DDB scan
    // used to do server-side. This is the current-active feed (what the tracker uses), so a disaster
    // that already closed and dropped off the feed is no longer flagged — an intentional, honest
    // narrowing vs the old TTL-accumulating scan.
    events = (doc?.events || []).filter((e) => e.alertLevel === 'Orange' || e.alertLevel === 'Red');
  } catch (e) { console.warn('[gdacs-gap] corpus read failed:', e.message); return []; }

  // recent only (last 5 days) — ignore stale/closed events
  const cutoff = new Date(Date.now() - 5 * 86400 * 1000).toISOString().slice(0, 10);
  events = events.filter((e) => String(e.fromDate || e.dateModified || '').slice(0, 10) >= cutoff);

  const hay = chosen.map((c) => `${c.title} ${(c.regions || []).join(' ')} ${c.category || ''}`.toLowerCase()).join(' || ');
  const disasterMentioned = DISASTER_WORDS.some((w) => hay.includes(w));
  const gaps = [];
  for (const ev of events) {
    const countries = [String(ev.country || ''), ...String(ev.affectedCountries || '').split(/[;,]/)]
      .map((s) => s.trim().toLowerCase()).filter((s) => s.length > 3);
    const countryMentioned = countries.some((c) => hay.includes(c));
    if (!countryMentioned || !disasterMentioned) {
      gaps.push({
        eventKey: ev.eventKey, alertLevel: ev.alertLevel, type: ev.eventType,
        country: ev.country, name: ev.name, severityText: ev.severityText || '',
        gap: !countryMentioned ? 'country_absent' : 'no_disaster_topic',
      });
    }
  }
  return gaps;
}

// Objective CONFLICT coverage gap: countries with serious GDELT material-conflict today that the
// selector did not cover. Serious = worst Goldstein ≤ -7 (fight/combat/mass violence) or high
// mention volume. US/UK etc. are always in the news, so they self-exclude via the presence check.
async function gdeltCoverageGap(chosen) {
  const cutoff = new Date(Date.now() - 2 * 86400 * 1000).toISOString().slice(0, 10); // last 2 days
  let rows;
  try {
    // S8·T2: read today + yesterday's per-day corpus files (each overwritten last-run-wins, same as
    // the old `day#country` DDB upserts) to preserve the 2-day window.
    const today = new Date().toISOString().slice(0, 10);
    const yday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
    const docs = await Promise.all([...new Set([today, yday])].map((d) => s3GetJson(`${GDELT_CORPUS_PREFIX}/${d}.json`)));
    rows = docs.flatMap((doc) => doc?.countries || []).filter((r) => String(r.day || '') >= cutoff);
  } catch (e) { console.warn('[gdelt-gap] corpus read failed:', e.message); return []; }

  const hay = chosen.map((c) => `${c.title} ${(c.regions || []).join(' ')}`.toLowerCase()).join(' || ');
  const gaps = [];
  for (const r of rows) {
    const country = String(r.country || '').toLowerCase();
    if (country.length < 4) continue; // skip unresolved geo codes (e.g. "GG")
    // Sustained coverage is the best significance proxy in a sparse 15-min window: a single
    // violent CRIME gets ~10 mentions and is noise; a real conflict accumulates more. (Goldstein
    // alone fires on any -10 assault, so it's NOT used as the trigger.) Full-day aggregation is
    // the proper future refinement; until then this bar keeps the conflict-gap signal honest.
    const serious = (Number(r.totalMentions) || 0) >= 30 || (Number(r.eventCount) || 0) >= 3;
    if (!serious) continue;
    if (!hay.includes(country)) {
      gaps.push({ country: r.country, mentions: r.totalMentions, worstGoldstein: r.minGoldstein, topEvent: r.topEvent });
    }
  }
  return gaps;
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
  const gdacsGaps = await gdacsCoverageGap(chosen);          // objective disaster gap (GDACS feed)
  const gdeltGaps = await gdeltCoverageGap(chosen);          // objective conflict gap (GDELT feed)
  const hardGaps = gdacsGaps.filter((g) => g.gap === 'country_absent');
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
    gdacsGapCount: gdacsGaps.length,
    gdacsGaps,
    gdeltGapCount: gdeltGaps.length,
    gdeltGaps,
  };
  // S8·T2: the verdict is the audit trail, written to S3 (a dated object + a `latest` pointer).
  // Retention is the bucket lifecycle, not a DDB TTL. Best-effort — a write failure must not stop
  // the SNS alert below, which is the operator-facing signal.
  try {
    const body = JSON.stringify(item);
    await s3.send(new PutObjectCommand({ Bucket: WORLD_BUCKET, Key: `${AUDIT_PREFIX}/${now.slice(0, 10)}.json`, Body: body, ContentType: 'application/json' }));
    await s3.send(new PutObjectCommand({ Bucket: WORLD_BUCKET, Key: `${AUDIT_PREFIX}/latest.json`, Body: body, ContentType: 'application/json' }));
  } catch (e) { console.warn('[impact-audit] S3 write failed:', e.message); }

  console.log(`[impact-audit] missed=${missed.length} gdacsGaps=${hardGaps.length} gdeltGaps=${gdeltGaps.length} verdict=${result.verdict} pattern=${result.dominant_pattern || ''}`);

  // Alert only — never modifies the live feed. Fire on LLM-judged misses OR an objective feed gap.
  if ((missed.length >= MISS_ALERT_THRESHOLD || hardGaps.length > 0 || gdeltGaps.length > 0) && SNS_TOPIC_ARN) {
    const body = [
      `Impact audit (cycle ${cap.runId}):`,
      `• ${missed.length} high-impact events the auditor judged MISSED. Verdict: ${result.verdict}. Pattern: ${result.dominant_pattern || ''}`,
      ...missed.map((m, i) => `   ${i + 1}. [${m.dimension}] ${m.title} (${m.source}) → ${m.why}`),
      '',
      `• ${hardGaps.length} GDACS Orange/Red disaster(s) NOT covered (objective):`,
      ...hardGaps.map((g, i) => `   ${i + 1}. [${g.alertLevel} ${g.type}] ${g.name} — ${g.country} (${g.severityText})`),
      '',
      `• ${gdeltGaps.length} country/countries with serious GDELT conflict NOT covered (objective):`,
      ...gdeltGaps.map((g, i) => `   ${i + 1}. ${g.country} — ${g.topEvent}, worst Goldstein ${g.worstGoldstein} (${g.mentions} mentions)`),
      '',
      'Measurement + alert only. It does NOT change what readers saw. Review and decide.',
    ].join('\n');
    try {
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `⚠ Impact audit: ${missed.length} missed · ${hardGaps.length} disaster gap · ${gdeltGaps.length} conflict gap`,
        Message: body,
      }));
      console.log('[impact-audit] SNS alert sent');
    } catch (e) { console.warn('[impact-audit] SNS failed:', e.message); }
  }

  return { ok: true, missed: missed.length, gdacsGaps: hardGaps.length, gdeltGaps: gdeltGaps.length, verdict: result.verdict };
};
