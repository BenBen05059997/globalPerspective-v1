'use strict';

// newsGdacsIngest — ingest of GDACS (UN+EU Global Disaster Alert & Coordination System).
// Free, keyless, NO LLM. Every run (rate(20 minutes)):
//   1. Mirrors current disaster events into GlobalPerspectiveGdacsEvents (alert level, severity,
//      coordinates) — the existing impact-pipeline feed (migrates to S3 corpus in S8).
//   2. Acts as a deterministic situation OPENER: writes ONE observation snapshot of all current
//      Orange/Red events to s3://<world>/situations/inbox/<ts>-gdacs.json. It holds NO situation
//      state — the tracker (S2) folds observations into situation state and is the sole writer of it
//      (DATA_STRATEGY.md: one writer per prefix; openers append, the folder owns state).
//
// History: shadow-only 2026-06-24; DDB situation opener 2026-09-08 (P1·T1, superseded);
// S3 inbox opener 2026-09-08 (S1·T1 of MAP_HOME_SITUATION_PLAN.md).

const {
  eventKeyOf, buildObservation, OPENING_LEVELS, parseGeometry,
} = require('./situations-core');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.GDACS_TABLE || 'GlobalPerspectiveGdacsEvents';
const FEED = process.env.GDACS_FEED || 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';
const TTL_DAYS = Number(process.env.GDACS_TTL_DAYS) || 30;

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const INBOX_PREFIX = process.env.SITUATIONS_INBOX_PREFIX || 'situations/inbox';
const INBOX_DISABLED = process.env.SITUATIONS_INBOX_DISABLED === 'true';
const CORPUS_PREFIX = process.env.GDACS_CORPUS_PREFIX || 'corpus/gdacs';

// Lazy clients so pure helpers (and tests) load without the AWS SDK.
let _ddb, _s3;
function ddb() {
  if (!_ddb) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
  }
  return _ddb;
}
function s3() {
  if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); }
  return _s3;
}
function ddbCmd(name) { return require('@aws-sdk/lib-dynamodb')[name]; }

function buildEventItem(feature, nowIso, ttl) {
  const p = feature.properties || {};
  const sev = p.severitydata || {};
  const geo = parseGeometry(feature);
  return {
    eventKey: eventKeyOf(p),
    eventType: p.eventtype,
    alertLevel: p.alertlevel || 'Green',
    alertScore: typeof p.alertscore === 'number' ? p.alertscore : null,
    episodeAlertLevel: p.episodealertlevel || null,
    episodeAlertScore: typeof p.episodealertscore === 'number' ? p.episodealertscore : null,
    isCurrent: String(p.iscurrent) === 'true',
    country: p.country || '',
    affectedCountries: p.affectedcountries || null,
    iso3: p.iso3 || '',
    lat: geo ? geo.lat : null,
    lon: geo ? geo.lon : null,
    name: p.name || p.eventname || '',
    description: (p.htmldescription || p.description || '').slice(0, 500),
    severity: typeof sev.severity === 'number' ? sev.severity : null,
    severityText: sev.severitytext || '',
    severityUnit: sev.severityunit || '',
    fromDate: p.fromdate || null,
    toDate: p.todate || null,
    dateModified: p.datemodified || null,
    reportUrl: (p.url && p.url.report) || null,
    ingestedAt: nowIso,
    ttl,
  };
}

// GDACS is a FULL-SNAPSHOT source: each run reports the complete current Orange/Red set. So it writes
// a STABLE current pointer (situations/inbox/gdacs-latest.json, overwritten), which the tracker reads
// every sweep as the authoritative GDACS truth. (Contrast with per-event sources like breaking-alert,
// which append timestamped events.) A stable pointer means a tracker run never sees an empty inbox and
// spuriously cools live situations.
async function writeInboxSnapshot(feats, nowIso) {
  const events = [];
  for (const f of feats) {
    const p = f.properties || {};
    if (!p.eventid || !p.eventtype) continue;
    if (OPENING_LEVELS.has(p.alertlevel)) events.push(buildObservation(f, nowIso));
  }
  const body = JSON.stringify({ source: 'gdacs', observed_at: nowIso, events });
  const key = `${INBOX_PREFIX}/gdacs-latest.json`;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: WORLD_BUCKET, Key: key, Body: body, ContentType: 'application/json' }));
  return { key, count: events.length };
}

// S8·T2 (2026-09-09): the impact audit reads the current disaster set from S3 instead of scanning
// the GdacsEvents DDB mirror. Full current event array, SAME field shape as the DDB items, at a
// stable pointer overwritten each run — so the audit's Orange/Red + recency filter works unchanged.
// Best-effort: an S3/IAM failure must never fail the events mirror (identical posture to the inbox).
async function writeCorpusSnapshot(items, nowIso) {
  const body = JSON.stringify({ source: 'gdacs', observed_at: nowIso, count: items.length, events: items });
  const key = `${CORPUS_PREFIX}/latest.json`;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({ Bucket: WORLD_BUCKET, Key: key, Body: body, ContentType: 'application/json' }));
  return { key, count: items.length };
}

exports.handler = async () => {
  let feats;
  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': 'globalperspective-gdacs/1.0' } });
    if (!res.ok) throw new Error(`GDACS HTTP ${res.status}`);
    const data = await res.json();
    feats = data.features || [];
  } catch (e) {
    console.error('[gdacs] fetch failed:', e.message);
    return { ok: false, error: e.message };
  }

  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  const now = new Date().toISOString();
  let withGeo = 0;
  const byLevel = { Green: 0, Orange: 0, Red: 0 };
  const items = [];

  for (const f of feats) {
    const p = f.properties || {};
    if (!p.eventid || !p.eventtype) continue;
    if (p.alertlevel in byLevel) byLevel[p.alertlevel]++;
    const item = buildEventItem(f, now, ttl);
    if (item.lat !== null) withGeo++;
    items.push(item);
  }
  const stored = items.length;
  // S8·T2 (2026-09-09): the GlobalPerspectiveGdacsEvents DDB mirror was DROPPED — its only reader
  // (newsImpactAudit) now reads the S3 corpus below, and the tracker reads the S3 inbox. This used
  // to PutItem each event (~1,100 writes/day). The events now live only in `corpus/gdacs/latest.json`.
  console.log(`[gdacs] ${stored}/${feats.length} events (${withGeo} with coordinates) | levels=${JSON.stringify(byLevel)}`);

  // S8·T2: mirror the full current set to S3 for the impact audit (best-effort, never fatal).
  let corpus = null;
  try {
    corpus = await writeCorpusSnapshot(items, now);
    console.log(`[gdacs][corpus] wrote ${corpus.key} (${corpus.count} events)`);
  } catch (e) {
    console.error('[gdacs][corpus] snapshot failed:', e.message);
    corpus = { error: e.message };
  }

  let inbox = null;
  if (INBOX_DISABLED) {
    console.log('[gdacs][inbox] disabled via SITUATIONS_INBOX_DISABLED');
  } else {
    try {
      inbox = await writeInboxSnapshot(feats, now);
      console.log(`[gdacs][inbox] wrote ${inbox.key} (${inbox.count} Orange/Red observations)`);
    } catch (e) {
      // The inbox snapshot is additive: an S3/IAM failure must never fail the events mirror.
      console.error('[gdacs][inbox] snapshot failed:', e.message);
      inbox = { error: e.message };
    }
  }

  return { ok: true, stored, withGeo, byLevel, inbox, corpus };
};

exports._internal = { buildEventItem, writeInboxSnapshot };
