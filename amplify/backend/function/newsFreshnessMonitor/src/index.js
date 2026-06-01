'use strict';

// newsFreshnessMonitor — data-freshness dead-man's-switch.
//
// The content pipeline (newsInvokeGemini → NewsProjectInvokeAgentLambda) runs on
// a schedule every ~2h. If it silently stalls, the site keeps serving the last
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

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const PROXY_URL = process.env.PROXY_URL;            // proxy base, e.g. https://…/default/proxy
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const STALE_HOURS = Number(process.env.STALE_HOURS || 5);
const SITE_URL = process.env.SITE_URL || 'https://globalperspective.net';
const FETCH_TIMEOUT_MS = 15000;

let _sns = null;
function sns() {
  if (!_sns) _sns = new SNSClient({ region: REGION });
  return _sns;
}

async function alert(subject, lines) {
  if (!SNS_TOPIC_ARN) {
    console.error('newsFreshnessMonitor misconfigured: SNS_TOPIC_ARN missing');
    return;
  }
  const message = lines.join('\n');
  console.warn('newsFreshnessMonitor ALERT', subject, message);
  await sns().send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject: subject.slice(0, 100),
    Message: message,
  }));
}

exports.handler = async () => {
  if (!PROXY_URL) {
    console.error('newsFreshnessMonitor misconfigured: PROXY_URL missing');
    return { ok: false, error: 'PROXY_URL missing' };
  }

  const url = `${PROXY_URL}${PROXY_URL.includes('?') ? '&' : '?'}action=topics`;

  let asOf = null;
  let topicsCount = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      await alert(
        `[GP] Freshness probe FAILED — proxy HTTP ${resp.status}`,
        [
          `The content proxy returned HTTP ${resp.status} when asked for topics.`,
          `This is a read-path availability failure, not just a stale-content warning.`,
          ``,
          `Probe URL: ${url}`,
          `Site: ${SITE_URL}`,
          `Checked: ${new Date().toISOString()}`,
        ],
      );
      return { ok: false, status: resp.status };
    }
    const data = await resp.json();
    asOf = data.asOf || (data.data && data.data.updatedAt) || null;
    topicsCount = (data.data && Array.isArray(data.data.topics)) ? data.data.topics.length : null;
  } catch (err) {
    await alert(
      `[GP] Freshness probe FAILED — proxy unreachable`,
      [
        `The content proxy could not be reached when asked for topics.`,
        `Error: ${String(err && err.message || err)}`,
        ``,
        `Probe URL: ${url}`,
        `Site: ${SITE_URL}`,
        `Checked: ${new Date().toISOString()}`,
      ],
    );
    return { ok: false, error: String(err && err.message || err) };
  }

  if (!asOf) {
    await alert(
      `[GP] Freshness probe FAILED — no timestamp in topics`,
      [
        `The proxy responded but carried no asOf/updatedAt timestamp, so freshness`,
        `cannot be determined. Treating as a failure (fail loud, don't assume fresh).`,
        ``,
        `Probe URL: ${url}`,
        `Checked: ${new Date().toISOString()}`,
      ],
    );
    return { ok: false, error: 'no asOf' };
  }

  const ageMs = Date.now() - new Date(asOf).getTime();
  const ageHours = ageMs / 3_600_000;

  if (!Number.isFinite(ageHours)) {
    await alert(
      `[GP] Freshness probe FAILED — unparseable timestamp`,
      [`asOf was present but not parseable: ${asOf}`, `Probe URL: ${url}`],
    );
    return { ok: false, error: 'unparseable asOf' };
  }

  if (ageHours > STALE_HOURS) {
    await alert(
      `[GP] Content STALE — ${ageHours.toFixed(1)}h old (limit ${STALE_HOURS}h)`,
      [
        `The newest topics are ${ageHours.toFixed(1)} hours old, past the ${STALE_HOURS}h limit.`,
        `The content pipeline runs every ~2h, so this likely means it has stalled`,
        `(newsInvokeGemini / NewsProjectInvokeAgentLambda not completing).`,
        ``,
        `Newest content asOf: ${asOf}`,
        topicsCount != null ? `Topics currently served: ${topicsCount}` : ``,
        `Site: ${SITE_URL}`,
        `Checked: ${new Date().toISOString()}`,
        ``,
        `Next steps: check the pipeline Lambda logs / EventBridge schedules.`,
      ].filter(Boolean),
    );
    return { ok: false, stale: true, ageHours, asOf };
  }

  console.info('newsFreshnessMonitor OK', { ageHours: Number(ageHours.toFixed(2)), asOf, topicsCount });
  return { ok: true, ageHours: Number(ageHours.toFixed(2)), asOf, topicsCount };
};
