'use strict';

// newsBreakingAlert — detect a genuinely significant breaking story each pipeline
// cycle and PROPOSE it for a broadcast email. It never auto-sends: it writes a
// `status: 'proposed'` record that a human reviews/confirms (and can annotate with
// their own words) via breaking/review.js before anything goes out — mirroring the
// predictions/review.js + economic-quality human-review pattern.
//
// Pipeline:  detect (deterministic, significance.js) → propose → [LLM verify, later]
//            → human confirm + editor note → send (SES, later).
//
// DRY_RUN (default true): logs the candidate + the full would-be email, writes the
// proposal/dedupe row, sends nothing. See BREAKING_ALERTS_PLAN.md.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { scoreStory, effectiveThreshold, SIGNIFICANCE_THRESHOLD } = require('./significance');
const { renderAlert } = require('./render');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const TOPICS_TABLE = process.env.TOPICS_DDB_TABLE;
const SUMM_TABLE = process.env.SUMMARIZE_PREDICT_TABLE;
const ALERTS_TABLE = process.env.BREAKING_ALERTS_TABLE || 'GlobalPerspectiveBreakingAlerts';
const SITE_URL = (process.env.SITE_URL || 'https://globalperspective.net').replace(/\/$/, '');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default ON — never sends until explicitly disabled
const THRESHOLD = Number(process.env.SIGNIFICANCE_THRESHOLD) || SIGNIFICANCE_THRESHOLD;
const DEDUPE_DAYS = Number(process.env.DEDUPE_DAYS) || 5;
const DEDUPE_TTL_DAYS = Number(process.env.DEDUPE_TTL_DAYS) || 14;
const DAY_MS = 86400000;

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}

function norm(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

// ── Loaders ───────────────────────────────────────────────────────────────────
async function loadLatestTopics() {
  const out = await ddb().send(new GetCommand({ TableName: TOPICS_TABLE, Key: { id: 'latest' } }));
  const topics = out.Item?.topics;
  return Array.isArray(topics) ? topics : [];
}

async function getRecord(pk, sk) {
  try {
    const out = await ddb().send(new GetCommand({ TableName: SUMM_TABLE, Key: { PK: pk, SK: sk } }));
    return out.Item || null;
  } catch (err) {
    console.warn(`getRecord ${pk}/${sk} failed (non-fatal): ${err.message}`);
    return null;
  }
}

async function getAlertRecord(threadId) {
  try {
    const out = await ddb().send(new GetCommand({ TableName: ALERTS_TABLE, Key: { alertKey: threadId } }));
    return out.Item || null;
  } catch (err) {
    console.warn(`getAlertRecord ${threadId} failed (non-fatal): ${err.message}`);
    return null;
  }
}

// ── Aggregation: group topics into stories (by threadId) ────────────────────────
function groupByThread(topics) {
  const byThread = new Map();
  for (const t of topics) {
    const tid = t.threadId || t.topicId || t.id;
    if (!tid) continue;
    if (!byThread.has(tid)) {
      byThread.set(tid, { threadId: tid, topics: [], regions: new Set(), category: t.category || null });
    }
    const g = byThread.get(tid);
    g.topics.push(t);
    for (const r of t.regions || []) g.regions.add(r);
  }
  return [...byThread.values()].map((g) => ({
    threadId: g.threadId,
    topics: g.topics,
    category: g.category,
    regions: [...g.regions],
    topicCount: g.topics.length,
    sourceCount: g.topics.reduce((n, t) => n + (Array.isArray(t.sources) ? t.sources.length : 0), 0),
    leadTopic: g.topics.slice().sort(
      (a, b) => (b.sources?.length || 0) - (a.sources?.length || 0)
    )[0],
  }));
}

// Max country riskScore across the story's regions (COUNTRY_INTELLIGENCE).
async function maxRegionRisk(regions) {
  let max = 0;
  for (const r of regions) {
    const rec = await getRecord(`COUNTRY#${r}`, 'COUNTRY_INTELLIGENCE');
    const score = Number(rec?.riskScore);
    if (Number.isFinite(score) && score > max) max = score;
  }
  return max;
}

// Max economic magnitude across the story's instruments (ECONOMIC_IMPACT).
async function econMagnitude(threadId) {
  const rec = await getRecord(`ECON#THREAD#${threadId}`, 'ECONOMIC_IMPACT');
  if (!rec || rec.hasImpact === false || !Array.isArray(rec.instruments)) return null;
  const order = { small: 1, moderate: 2, large: 3 };
  let best = null;
  for (const inst of rec.instruments) {
    if (order[inst.magnitude] && (!best || order[inst.magnitude] > order[best])) best = inst.magnitude;
  }
  return best ? { magnitude: best, direction: rec.instruments[0]?.direction || rec.direction || null } : null;
}

// Already alerted within the dedupe window?
function recentlyAlerted(rec, now) {
  if (!rec || !rec.alertedAt) return false;
  const ts = Date.parse(rec.alertedAt);
  return Number.isFinite(ts) && now - ts < DEDUPE_DAYS * DAY_MS;
}

// ── Assemble the story object the renderer needs ────────────────────────────────
async function assembleStory(group, scored) {
  const lead = group.leadTopic || {};
  const leadId = lead.topicId || lead.id;
  const threadAnalysis = await getRecord(`THREAD#${group.threadId}`, 'THREAD_ANALYSIS');
  const summaryRec = await getRecord(`TOPIC#${leadId}`, 'SUMMARY');
  const predictionRec = await getRecord(`TOPIC#${leadId}`, 'PREDICTION');
  const traceRec = await getRecord(`TOPIC#${leadId}`, 'TRACE_CAUSE');
  const econ = await econMagnitude(group.threadId);

  // SUMMARY is markdown; PREDICTION is sometimes stored as a JSON blob — only surface
  // human-readable markdown, never dump raw JSON into an email.
  const summaryText = summaryRec?.contentFormat === 'json' ? '' : summaryRec?.content || '';
  const predictionText = predictionRec?.contentFormat === 'json' ? '' : predictionRec?.content || '';

  // TRACE_CAUSE is structured JSON (proximate / contributing / structural / etc.).
  // Parse it so the renderer can lay out the causal chain; skip silently if unparseable
  // (never dump raw JSON — honesty contract).
  let traceCause = null;
  if (traceRec?.content) {
    try {
      const parsed = JSON.parse(traceRec.content);
      if (parsed && typeof parsed === 'object') traceCause = parsed;
    } catch { /* unparseable → omit the section */ }
  }

  return {
    title: threadAnalysis?.threadTitle || lead.title || 'Developing story',
    category: group.category,
    regions: group.regions,
    threadUrl: `${SITE_URL}/weekly/thread/${group.threadId}`,
    summary: summaryText,
    prediction: predictionText,
    traceCause,
    economic: econ ? { direction: econ.direction, magnitude: econ.magnitude } : null,
    sources: (lead.sources || []).map((s) => ({ title: s.title, url: s.url })),
    reasons: scored.reasons,
  };
}

// ── Verify step (LLM-as-judge) — STUB, Phase 3. ─────────────────────────────────
// Will mirror newsEconomicQuality: a DIFFERENT model family (Gemini) judges whether
// the flagged story is real and our analysis matches the cited sources, returning a
// verdict + confidence. Until built, proposals carry verify:{ status:'pending' } and a
// human is the only gate.
async function verifyStory(/* story */) {
  return { status: 'pending', note: 'LLM verify not yet wired (Phase 3)' };
}

// ── Write the proposal (NOT a send). Doubles as the dedupe row. ──────────────────
async function writeProposal(group, scored, story, verify, email) {
  const now = new Date();
  const item = {
    alertKey: group.threadId,
    status: 'proposed', // proposed → confirmed (by human) → sent
    score: scored.score,
    reasons: scored.reasons,
    title: story.title,
    cycle: now.toISOString(),
    alertedAt: now.toISOString(), // dedupe anchor
    sent: false,
    dryRun: DRY_RUN,
    draft: email, // { subject, text } for the reviewer
    verify,
    ttl: Math.floor((now.getTime() + DEDUPE_TTL_DAYS * DAY_MS) / 1000),
  };
  try {
    await ddb().send(new PutCommand({ TableName: ALERTS_TABLE, Item: item }));
  } catch (err) {
    console.error(`writeProposal failed for ${group.threadId}: ${err.message}`);
  }
  return item;
}

// ── Core ────────────────────────────────────────────────────────────────────────
async function run() {
  const now = Date.now();
  const topics = await loadLatestTopics();
  const groups = groupByThread(topics);
  console.log(`[breaking] ${topics.length} topics → ${groups.length} stories; threshold=${THRESHOLD}; DRY_RUN=${DRY_RUN}`);

  // Score every story (low volume — enrich all). For each, also derive novelty:
  //  - velocity = new angles this cycle vs the thread's prior size (THREAD_ANALYSIS.entryCount)
  //  - isContinuation = the thread already existed (prior analysis) OR the lead topic
  //    continues an earlier topic — such stories face a raised bar (effectiveThreshold),
  //    so they only re-alert on genuine escalation, never on staying loud.
  const candidates = [];
  for (const g of groups) {
    const riskScore = await maxRegionRisk(g.regions);
    const econ = await econMagnitude(g.threadId);
    const ta = await getRecord(`THREAD#${g.threadId}`, 'THREAD_ANALYSIS');
    const priorSize = Number(ta?.entryCount) || 0;
    const velocity = priorSize > 0 ? Math.max(0, g.topicCount - priorSize) : g.topicCount;
    const isContinuation = priorSize > 0 || !!(g.leadTopic && g.leadTopic.continues_topic);
    const scored = scoreStory({
      sourceCount: g.sourceCount,
      topicCount: g.topicCount,
      riskScore,
      econMagnitude: econ?.magnitude || null,
      velocity,
    });
    if (scored.score >= effectiveThreshold(THRESHOLD, isContinuation)) {
      candidates.push({ group: g, scored, isContinuation });
    }
  }

  candidates.sort((a, b) => b.scored.score - a.scored.score);
  console.log(`[breaking] ${candidates.length} stories cleared the significance threshold`);
  if (!candidates.length) {
    console.log('[breaking] nothing significant this cycle — sending nothing (correct).');
    return { ok: true, proposed: 0, reason: 'no_candidate' };
  }

  // Broadcast v1: at most ONE story per run. Pick the highest-scoring story not already
  // alerted within the dedupe window.
  let chosen = null;
  for (const c of candidates) {
    const existing = await getAlertRecord(c.group.threadId);
    if (recentlyAlerted(existing, now)) {
      console.log(`[breaking] skip "${c.group.threadId}" — already alerted within ${DEDUPE_DAYS}d`);
      continue;
    }
    chosen = c;
    break;
  }
  if (!chosen) {
    console.log('[breaking] all candidates already alerted — nothing new to propose.');
    return { ok: true, proposed: 0, reason: 'all_deduped' };
  }

  const story = await assembleStory(chosen.group, chosen.scored);
  const email = renderAlert(story);
  const verify = await verifyStory(story);
  const proposal = await writeProposal(chosen.group, chosen.scored, story, verify, email);

  console.log('──────── BREAKING ALERT PROPOSED ────────');
  console.log(`thread:   ${chosen.group.threadId}`);
  console.log(`score:    ${chosen.scored.score}  (reasons: ${chosen.scored.reasons.join('; ') || 'n/a'})`);
  console.log(`verify:   ${verify.status} — ${verify.note || ''}`);
  console.log(`subject:  ${email.subject}`);
  console.log('---- body ----');
  console.log(email.text);
  console.log('─────────────────────────────────────────');
  console.log(DRY_RUN
    ? '[breaking] DRY_RUN: proposal written; NO email sent. Review via breaking/review.js.'
    : '[breaking] proposal written; awaiting human confirmation before send.');

  return { ok: true, proposed: 1, threadId: chosen.group.threadId, score: chosen.scored.score, dryRun: DRY_RUN };
}

exports.handler = async () => {
  try {
    return await run();
  } catch (err) {
    console.error('[breaking] run failed', err);
    return { ok: false, error: err.message };
  }
};

// Allow `node index.js` local dry-run against prod tables (read-only except the
// proposal row) when AWS creds are present.
if (require.main === module) {
  run().then((r) => console.log('[breaking] done', JSON.stringify(r))).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
