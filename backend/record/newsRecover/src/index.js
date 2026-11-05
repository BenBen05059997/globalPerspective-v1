'use strict';

// newsRecover: rebuild one missed, closed UTC day's raw articles from public records, no model (decision 0040 rule 2).
// Invoked by newsHealth (self-healing, ARCHITECTURE_OPS.md phase 4) or by hand: {"day":"YYYY-MM-DD"} (add "dryRun":true to fetch and report only).
// Sources: GDELT GKG 2.1 raw files (primary, static downloads) and Wayback snapshots of our own feeds (backstop, time-boxed). Every line carries
// `recoveredAt` and `recoveredFrom`; nothing is generated. It writes only record/inbox/articles/DAY.jsonl (idempotent: a rawId already
// there is skipped) and its own result file monitoring/heal/recover/DAY.json, which is how the caller learns the outcome. It does not
// build facts: newsStoryRecord {"recovery":true,"date":DAY} does that (the caller's next step).
const R = require('./recover');
const { makeS3Json } = require('./_shared/s3json');

const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const INBOX = 'record/inbox/articles';
const RESULT = 'monitoring/heal/recover';
const LOOKBACK_DAYS = 14;       // GKG files go back much further; the health view only heals the last days, 14 is the guard against a typo
const WAYBACK_BUDGET_MS = 600000;   // Wayback is the backstop (8 lines for 2026-09-18); it never takes more than this of the 15 min
const SAFETY_MS = 90000;        // left for the inbox write and the result file

const today = (now) => new Date(now).toISOString().slice(0, 10);

/** Why this day may not be recovered, or null: it must be a real, closed UTC day inside the lookback. */
function refuse(day, now) {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(day || '') ? Date.parse(day) : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return 'day must be YYYY-MM-DD';
  if (day >= today(now)) return 'the day is not closed yet (UTC)';
  if (Date.parse(day) < Date.parse(today(now)) - LOOKBACK_DAYS * 86400000) return `older than ${LOOKBACK_DAYS} days`;
  return null;
}

function makeDeps() {
  const sdk = require('@aws-sdk/client-s3');
  const client = new sdk.S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return { s3: makeS3Json({ client, GetObjectCommand: sdk.GetObjectCommand, PutObjectCommand: sdk.PutObjectCommand, bucket: BUCKET }) };
}

/**
 * One recovery. deps: { s3 (s3json), fetchText (makeFetcher), feeds, now (epoch ms), budgetMs, log }.
 * -> the result object (also written to monitoring/heal/recover/DAY.json unless dryRun).
 */
async function recoverDay({ day, dryRun = false, noWayback = false }, deps) {
  const { s3, now = Date.now(), log = console } = deps;
  const startedAt = new Date(now).toISOString();
  const base = { schemaVersion: 1, producer: 'newsRecover', day, startedAt, dryRun };
  const why = refuse(day, now);
  if (why) return { ...base, finishedAt: new Date().toISOString(), status: 'refused', error: why };

  const fetchText = deps.fetchText || R.makeFetcher({ gapMs: { 'data.gdeltproject.org': 0 }, defaultGapMs: 1000, retries: 2 });
  const feeds = deps.feeds || R.readFeeds();
  const targets = R.gdeltTargets(feeds);
  const nowIso = startedAt;
  const deadline = now + (deps.budgetMs != null ? deps.budgetMs : WAYBACK_BUDGET_MS);

  const gk = await R.recoverGkg({ targets, day, fetchBuf: fetchText, now: nowIso, log });
  const w = noWayback ? { lines: [], failures: [], perFeed: {} } : await R.recoverWayback({ feeds, day, fetchText, now: nowIso, log, deadline });
  const existing = (await s3.getLines(`${INBOX}/${day}.jsonl`)).lines;
  // Wayback first: it carries the feed's own publishedAt; GDELT only when it saw the article. The day file holds the day's lines (UTC).
  const onDay = (l) => !l.publishedAt || l.publishedAt.slice(0, 10) === day;
  const { lines, dupes } = R.dedupeLines([w.lines.filter(onDay), gk.lines.filter(onDay)], existing);
  let appended = 0; let alreadyThere = 0;
  if (lines.length && !dryRun) {
    const res = await s3.appendLines(`${INBOX}/${day}.jsonl`, lines, { idKey: 'rawId' });
    appended = res.appended; alreadyThere = res.skipped;
  }
  const failures = [...gk.failures, ...w.failures];
  const inboxLines = existing.length + appended;
  // failed: GDELT read no file and Wayback found nothing; partial: some GKG file missing or failed; ok: all 96 read.
  const status = gk.gkg.status === 'failed' && lines.length === 0 ? 'failed' : gk.gkg.status === 'ok' ? 'ok' : 'partial';
  const result = {
    ...base, finishedAt: new Date().toISOString(), status, error: null,
    gkg: gk.gkg,
    wayback: { feeds: Object.keys(w.perFeed).length, lines: w.lines.length, skipped: noWayback },
    counts: { found: lines.length, appended, alreadyThere, existingBefore: existing.length, inboxLines, duplicatesDropped: dupes, ...R.tally(lines) },
    failures: failures.slice(0, 20), failureCount: failures.length,
  };
  if (!dryRun) await s3.putLatest(`${RESULT}/${day}.json`, result);
  log.log(`[newsRecover] ${JSON.stringify({ day, status, gkg: gk.gkg.status, appended, inboxLines, failures: failures.length })}`);
  return result;
}

exports.handler = async (event = {}, context = {}) => {
  const deps = makeDeps();
  const left = typeof context.getRemainingTimeInMillis === 'function' ? context.getRemainingTimeInMillis() : null;
  const budgetMs = left == null ? WAYBACK_BUDGET_MS : Math.max(0, Math.min(WAYBACK_BUDGET_MS, left - SAFETY_MS - 300000));
  try {
    return await recoverDay({ day: event.day, dryRun: Boolean(event.dryRun), noWayback: Boolean(event.noWayback) }, { ...deps, budgetMs });
  } catch (e) {
    // Leave an honest result for the caller, then fail the invocation so the Errors metric counts it.
    const result = { schemaVersion: 1, producer: 'newsRecover', day: event.day, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), status: 'error', error: String((e && e.message) || e).slice(0, 300) };
    if (!event.dryRun && !refuse(event.day, Date.now())) { try { await deps.s3.putLatest(`${RESULT}/${event.day}.json`, result); } catch (_) { /* the invoke error below still shows */ } }
    throw e;
  }
};

exports.recoverDay = recoverDay;
exports.refuse = refuse;
