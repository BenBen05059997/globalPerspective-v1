'use strict';

// newsFreshnessMonitor — data-freshness dead-man's-switch.
//
// The content pipeline (newsInvokeGemini → NewsProjectInvokeAgentLambda) runs on
// a schedule every eight hours. If it silently stalls, the site keeps serving the last
// good topics and NOTHING tells the operator — the active smoke-test/link-crawl
// checks only run on demand, so a scheduled stall is their blind spot. This
// Lambda is the passive complement: a scheduled probe that fails loudly.
//
// It hits the PUBLIC proxy `?action=topics` (the same path a reader hits) and
// reads `asOf` (= the latest topics `updatedAt`). If the content is older than
// STALE_HOURS — or the proxy is unreachable / returns no timestamp — it raises
// an SNS alert. Hitting the proxy (not DynamoDB directly) means this also
// doubles as a lightweight uptime check on the read path, with no table coupling.
//
// HONEST-FAILURE policy: this only ALERTS — it never papers over a stall with a
// fake-fresh signal. Matches the site-wide no-misinformation rule.

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { probe, notifyTransition, s3StateStore } = require('./freshness');
const { evaluateSettle, settleFromRecord, shouldSendNow, buildMessage } = require('./settleCheck');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const PROXY_URL = process.env.PROXY_URL;            // proxy base, e.g. https://…/default/proxy
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const STALE_HOURS = Number(process.env.STALE_HOURS || 9);
const SITE_URL = process.env.SITE_URL || 'https://globalperspective.net';
// Where the settle check reads the board (decision 0052): `action` = the proxy's prediction_track_record (the PredictionLog snapshot file, default),
// `record` = the record's track-record view, manifest and the resolver's heartbeat, served under /data/record/views/ on SITE_URL (no table, no proxy).
const SETTLE_SOURCE = process.env.SETTLE_SOURCE || 'action';

let _sns = null;
function sns() {
  if (!_sns) _sns = new SNSClient({ region: REGION });
  return _sns;
}

async function alert(subject, lines) {
  if (!SNS_TOPIC_ARN) {
    console.error('newsFreshnessMonitor misconfigured: SNS_TOPIC_ARN missing');
    throw new Error('SNS_TOPIC_ARN missing');
  }
  const message = lines.join('\n');
  console.warn('newsFreshnessMonitor ALERT', subject, message);
  await sns().send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject: subject.slice(0, 100),
    Message: message,
  }));
}

// The record's board: three public JSON files. The heartbeat may not exist yet (404 = no tick seen); the view and the manifest must.
async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // the function's own timeout is 30 s: keep this step short
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (resp.status === 404) return { missing: true };
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    return { json: await resp.json() };
  } finally { clearTimeout(timer); }
}

async function recordBoard(nowIso) {
  const base = `${SITE_URL}/data/record/views`;
  const [view, manifest, heartbeat] = await Promise.all([fetchJson(`${base}/track-record.json`), fetchJson(`${base}/manifest.json`), fetchJson(`${base}/health/settle-tick.json`)]);
  if (!view.json) return { skipped: `track-record view ${view.error || 'not generated'}` };
  if (!manifest.json) return { skipped: `manifest ${manifest.error || 'not generated'}` };
  // No heartbeat yet means the resolver has not been switched on to write it (SETTLE_HEARTBEAT_KEY): without it "no tick for 3 days" cannot be told from "never written", so the check waits instead of alerting.
  if (!heartbeat.json) return { skipped: `settle heartbeat ${heartbeat.error || 'not written yet'}` };
  const questions = settleFromRecord({ view: view.json, manifest: manifest.json, heartbeat: heartbeat.json }, nowIso);
  return questions ? { questions } : { skipped: 'track-record view has no settleHealth yet' };
}

// Batch 4 / C: the settle dead-man's alarm. Runs first, in its own try/catch, and never blocks the
// freshness check below. Sends at most once a day (only the 12:30 UTC run). `event.dryRun` never
// sends; `event.fixture` previews the exact message for a made-up board; `event.settleCheckOnly`
// returns right after this step.
async function runSettleCheck(event = {}) {
  try {
    const nowIso = event.now || new Date().toISOString();
    let questions = event.fixture || null;
    if (!questions && SETTLE_SOURCE === 'record') {
      const got = await recordBoard(nowIso);
      if (got.skipped) return { skipped: got.skipped };
      questions = got.questions;
    } else if (!questions) {
      if (!PROXY_URL) return { skipped: 'PROXY_URL missing' };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000); // the function's own timeout is 30 s: keep this step short
      const resp = await fetch(`${PROXY_URL}${PROXY_URL.includes('?') ? '&' : '?'}action=prediction_track_record`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) return { skipped: `proxy HTTP ${resp.status}` };
      const j = await resp.json();
      questions = (j.data || j).questions || null;
    }
    const evaluation = evaluateSettle(questions, nowIso);
    const message = evaluation.alert ? buildMessage(evaluation, questions, { siteUrl: SITE_URL, nowIso }) : null;
    const willSend = Boolean(message) && !event.dryRun && (event.forceSend || shouldSendNow(nowIso));
    if (willSend) await alert(message.subject, message.body.split('\n'));
    return { alert: evaluation.alert, reasons: evaluation.reasons.map((r) => r.code), sent: willSend, message: event.dryRun ? message : undefined, note: evaluation.note };
  } catch (err) {
    console.warn('settle check failed (non-fatal):', String(err && err.message || err));
    return { error: String(err && err.message || err) };
  }
}

exports.handler = async (event = {}) => {
  const settle = await runSettleCheck(event);
  if (event.settleCheckOnly) return { settleCheck: settle };
  if (settle && (settle.alert || settle.error)) console.info('settle check', JSON.stringify({ alert: settle.alert, reasons: settle.reasons, sent: settle.sent, error: settle.error }));

  if (!PROXY_URL) {
    console.error('newsFreshnessMonitor misconfigured: PROXY_URL missing');
    throw new Error('PROXY_URL missing');
  }

  const url = `${PROXY_URL}${PROXY_URL.includes('?') ? '&' : '?'}action=topics`;
  try {
    const observation = await probe({ url, staleHours: STALE_HOURS });
    const notification = await notifyTransition({
      store: event.dryRun ? null : s3StateStore(process.env.FRESHNESS_STATE_BUCKET, REGION),
      publish: (subject, message) => alert(subject, message.split('\n')),
      observation, dryRun: Boolean(event.dryRun), siteUrl: SITE_URL,
    });
    console.info('newsFreshnessMonitor result', JSON.stringify({ ...observation, notification }));
    return { ...observation, notification };
  } catch (error) {
    console.error('[pipeline-status] ' + JSON.stringify({ status: 'failed', reason: 'freshness-monitor-error', error: error.message }));
    throw error;
  }
};
