'use strict';

// newsGdeltConflict — SHADOW ingest of GDELT 2.0 MATERIAL-CONFLICT events (open, no account, free).
// Pulls the latest GDELT events export (15-min file), keeps QuadClass==4 (material conflict =
// actual violence) events with enough mentions, aggregates by COUNTRY, and stores a country-level
// conflict-intensity snapshot to GlobalPerspectiveGdeltConflict. This is the OPEN replacement for
// ACLED (dropped — not openly accessible): the conflict analogue of the GDACS disaster feed.
//
// SHADOW: writes only to its own table; never touches the live news feed.
// Column layout VERIFIED 2026-06-24 against a live export (GDELT 2.0, 61 cols, tab-delimited):
//   26 EventCode · 28 EventRootCode · 29 QuadClass · 30 GoldsteinScale · 31 NumMentions ·
//   34 AvgTone · 52 ActionGeo_FullName · 53 ActionGeo_CountryCode · 60 SOURCEURL

const AdmZip = require('adm-zip');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.GDELT_TABLE || 'GlobalPerspectiveGdeltConflict';
const LASTUPDATE = process.env.GDELT_LASTUPDATE || 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const MIN_MENTIONS = Number(process.env.GDELT_MIN_MENTIONS) || 10;
const TOP_N = Number(process.env.GDELT_TOP_N) || 30;
const TTL_DAYS = Number(process.env.GDELT_TTL_DAYS) || 10;

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const CORPUS_PREFIX = process.env.GDELT_CORPUS_PREFIX || 'corpus/gdelt';

const ROOT_LABEL = { 17: 'Coerce', 18: 'Assault', 19: 'Fight/Combat', 20: 'Mass violence' };

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

let _s3;
function s3() {
  if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); }
  return _s3;
}

async function latestExportUrl() {
  const res = await fetch(LASTUPDATE);
  if (!res.ok) throw new Error(`lastupdate HTTP ${res.status}`);
  const txt = await res.text();
  for (const line of txt.trim().split('\n')) {
    const url = line.trim().split(/\s+/).pop();
    if (url && url.includes('.export.CSV.zip')) return url;
  }
  return null;
}

exports.handler = async () => {
  let exportUrl, buf;
  try {
    exportUrl = await latestExportUrl();
    if (!exportUrl) throw new Error('no export URL in lastupdate');
    const res = await fetch(exportUrl);
    if (!res.ok) throw new Error(`export HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) { console.error('[gdelt] fetch failed:', e.message); return { ok: false, error: e.message }; }

  let rows;
  try {
    const zip = new AdmZip(buf);
    rows = zip.readAsText(zip.getEntries()[0]).split('\n');
  } catch (e) { console.error('[gdelt] unzip failed:', e.message); return { ok: false, error: e.message }; }

  // Aggregate material-conflict events by country.
  const byCountry = new Map();
  for (const line of rows) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 61) continue;
    if (c[29] !== '4') continue;                         // QuadClass == material conflict
    const mentions = parseInt(c[31], 10) || 0;
    if (mentions < MIN_MENTIONS) continue;
    const goldstein = parseFloat(c[30]);
    const tone = parseFloat(c[34]);
    const country = (c[52] || '').split(',').pop().trim() || c[53] || '';
    if (!country) continue;
    const cur = byCountry.get(country) || {
      country, mentions: 0, events: 0, minGoldstein: 0, worstTone: 0, topMentions: 0, topEvent: null, sourceUrl: '',
    };
    cur.mentions += mentions;
    cur.events += 1;
    if (Number.isFinite(goldstein) && goldstein < cur.minGoldstein) cur.minGoldstein = goldstein;
    if (Number.isFinite(tone) && tone < cur.worstTone) cur.worstTone = tone;
    if (mentions > cur.topMentions) {
      cur.topMentions = mentions;
      cur.topEvent = ROOT_LABEL[c[28]] || `CAMEO ${c[28]}`;
      cur.sourceUrl = c[60] || '';
    }
    byCountry.set(country, cur);
  }

  const top = [...byCountry.values()].sort((a, b) => b.mentions - a.mentions).slice(0, TOP_N);
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  const day = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const items = top.map((r) => ({
    conflictKey: `${day}#${r.country}`,
    day,
    country: r.country,
    totalMentions: r.mentions,
    eventCount: r.events,
    minGoldstein: r.minGoldstein,
    worstTone: Math.round(r.worstTone * 10) / 10,
    topEvent: r.topEvent,
    topEventMentions: r.topMentions,
    sourceUrl: r.sourceUrl,
    sourceFile: exportUrl,
    ingestedAt: nowIso,
  }));
  const stored = items.length;
  // S8·T2 (2026-09-09): the GlobalPerspectiveGdeltConflict DDB mirror was DROPPED — its only reader
  // (newsImpactAudit) now reads the per-day S3 corpus below. Events live only in `corpus/gdelt/<day>.json`.

  // S8·T2 (2026-09-09): the impact audit reads GDELT from S3 instead of scanning the DDB mirror.
  // One file per day, overwritten each run (last-run-wins, same as the DDB `day#country` upserts);
  // the audit reads today + yesterday to preserve its 2-day window. Best-effort — never fatal.
  let corpus = null;
  try {
    const key = `${CORPUS_PREFIX}/${day}.json`;
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3().send(new PutObjectCommand({
      Bucket: WORLD_BUCKET, Key: key,
      Body: JSON.stringify({ day, generated_at: nowIso, count: items.length, countries: items }),
      ContentType: 'application/json',
    }));
    corpus = { key, count: items.length };
    console.log(`[gdelt][corpus] wrote ${key} (${items.length} countries)`);
  } catch (e) {
    console.error('[gdelt][corpus] write failed:', e.message);
    corpus = { error: e.message };
  }

  console.log(`[gdelt] ${rows.length} rows → ${byCountry.size} conflict countries → stored top ${stored}`);
  return { ok: true, stored, conflictCountries: byCountry.size, corpus };
};
