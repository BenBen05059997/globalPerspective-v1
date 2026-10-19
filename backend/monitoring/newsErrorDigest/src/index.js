'use strict';

// newsErrorDigest — the alerting/triage layer on top of the passive client-error
// sink (newsClientErrors). The sink CAPTURES + groups errors into DynamoDB
// counter rows; reading them back was manual-only (`scripts/errors.mjs`). This
// scheduled Lambda turns capture into a push alert.
//
// Each run it scans GlobalPerspectiveClientErrors, folds rows to a per-fingerprint
// total, and diffs against the prior run's totals (stored in one DIGEST#STATE row
// in the same table). It alerts via SNS ONLY on:
//   • NEW fingerprints (never seen in the last state), or
//   • SPIKING fingerprints (count grew by >= SPIKE_MIN_DELTA since last run).
// Alerting only on new/spiking is deliberate — a digest that fires every run on
// the same known errors is alert fatigue, which trains the operator to ignore it.
//
// No fake reassurance: a quiet run sends nothing (silence = nothing new), it never
// emits an "all clear" that could be mistaken for a health guarantee.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const ERRORS_TABLE = process.env.CLIENT_ERRORS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const SPIKE_MIN_DELTA = Number(process.env.SPIKE_MIN_DELTA || 5);
const STATE_KEY = 'DIGEST#STATE';
const STATE_TTL_DAYS = 90;

let _ddb = null;
function ddb() {
  if (!_ddb) {
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}
let _sns = null;
function sns() {
  if (!_sns) _sns = new SNSClient({ region: REGION });
  return _sns;
}

async function scanAll() {
  const rows = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb().send(new ScanCommand({ TableName: ERRORS_TABLE, ExclusiveStartKey }));
    rows.push(...(out.Items || []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return rows;
}

exports.handler = async () => {
  if (!ERRORS_TABLE || !SNS_TOPIC_ARN) {
    console.error('newsErrorDigest misconfigured: CLIENT_ERRORS_TABLE or SNS_TOPIC_ARN missing');
    return { ok: false, error: 'misconfigured' };
  }

  const rows = await scanAll();

  // Fold day#hash rows into per-fingerprint totals + keep the freshest sample.
  const byFp = new Map();
  for (const r of rows) {
    if (typeof r.errKey === 'string' && r.errKey.startsWith('DIGEST#')) continue;
    const fp = r.hashId || (typeof r.errKey === 'string' ? r.errKey.split('#').slice(1).join('#') : null);
    if (!fp) continue;
    const cur = byFp.get(fp) || { fp, total: 0, message: r.message || '', sampleUrl: r.sampleUrl || '', lastSeen: r.lastSeen || '' };
    cur.total += Number(r.count || 0);
    if ((r.lastSeen || '') > cur.lastSeen) {
      cur.lastSeen = r.lastSeen || cur.lastSeen;
      cur.message = r.message || cur.message;
      cur.sampleUrl = r.sampleUrl || cur.sampleUrl;
    }
    byFp.set(fp, cur);
  }

  // Load prior state.
  const prior = await ddb().send(new GetCommand({ TableName: ERRORS_TABLE, Key: { errKey: STATE_KEY } }));
  const lastCounts = (prior.Item && prior.Item.counts) || {};
  const firstEverRun = !prior.Item;

  // Classify new vs spiking.
  const newOnes = [];
  const spiking = [];
  for (const [fp, v] of byFp) {
    const before = Number(lastCounts[fp] || 0);
    if (!(fp in lastCounts)) {
      newOnes.push({ ...v, before, delta: v.total });
    } else if (v.total - before >= SPIKE_MIN_DELTA) {
      spiking.push({ ...v, before, delta: v.total - before });
    }
  }

  // Persist current totals as the new baseline.
  const counts = {};
  for (const [fp, v] of byFp) counts[fp] = v.total;
  await ddb().send(new PutCommand({
    TableName: ERRORS_TABLE,
    Item: {
      errKey: STATE_KEY,
      counts,
      lastRun: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + STATE_TTL_DAYS * 86400,
    },
  }));

  // First run only establishes the baseline — alerting on every pre-existing
  // error would be noise. Subsequent runs diff against it.
  if (firstEverRun) {
    console.info('newsErrorDigest baseline established', { fingerprints: byFp.size });
    return { ok: true, baseline: true, fingerprints: byFp.size };
  }

  if (newOnes.length === 0 && spiking.length === 0) {
    console.info('newsErrorDigest quiet — nothing new or spiking', { fingerprints: byFp.size });
    return { ok: true, new: 0, spiking: 0, fingerprints: byFp.size };
  }

  const fmt = (e) => `  • [${e.total}× total, +${e.delta}] ${String(e.message).slice(0, 120)}\n      last seen ${e.lastSeen || '?'} · ${e.sampleUrl || ''}`;
  const lines = [];
  if (newOnes.length) {
    lines.push(`NEW (${newOnes.length}) — first time seen since last digest:`);
    newOnes.sort((a, b) => b.total - a.total).forEach((e) => lines.push(fmt(e)));
    lines.push('');
  }
  if (spiking.length) {
    lines.push(`SPIKING (${spiking.length}) — grew by >= ${SPIKE_MIN_DELTA} since last digest:`);
    spiking.sort((a, b) => b.delta - a.delta).forEach((e) => lines.push(fmt(e)));
    lines.push('');
  }
  lines.push(`Read full detail (source-map resolved): node scripts/errors.mjs --days 3`);
  lines.push(`Checked: ${new Date().toISOString()}`);

  await sns().send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject: `[GP] Client errors: ${newOnes.length} new, ${spiking.length} spiking`.slice(0, 100),
    Message: lines.join('\n'),
  }));

  console.warn('newsErrorDigest alerted', { new: newOnes.length, spiking: spiking.length });
  return { ok: true, new: newOnes.length, spiking: spiking.length };
};
