'use strict';

// newsGdacsIngest — SHADOW ingest of GDACS (UN+EU Global Disaster Alert & Coordination System)
// into GlobalPerspectiveGdacsEvents. Free, keyless. Stores current disaster events with alert level
// + severity so the impact pipeline can catch high-impact disasters the news selector misses
// (coverage gap) — measured against impact, not media coverage.
//
// SHADOW: writes only to its own table; does NOT touch the live news feed. See
// IMPACT_FIRST_REDESIGN_PLAN.md §3.5 / IMPACT_VALIDATION_METHODOLOGY.md.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.GDACS_TABLE || 'GlobalPerspectiveGdacsEvents';
const FEED = process.env.GDACS_FEED || 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';
const TTL_DAYS = Number(process.env.GDACS_TTL_DAYS) || 30;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

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
  let stored = 0;
  const byLevel = { Green: 0, Orange: 0, Red: 0 };

  for (const f of feats) {
    const p = f.properties || {};
    if (!p.eventid || !p.eventtype) continue;
    if (p.alertlevel in byLevel) byLevel[p.alertlevel]++;
    const sev = p.severitydata || {};
    const item = {
      eventKey: `${p.eventtype}#${p.eventid}`,
      eventType: p.eventtype,
      alertLevel: p.alertlevel || 'Green',
      alertScore: typeof p.alertscore === 'number' ? p.alertscore : null,
      country: p.country || '',
      affectedCountries: p.affectedcountries || null,
      iso3: p.iso3 || '',
      name: p.name || p.eventname || '',
      description: (p.htmldescription || p.description || '').slice(0, 500),
      severity: typeof sev.severity === 'number' ? sev.severity : null,
      severityText: sev.severitytext || '',
      severityUnit: sev.severityunit || '',
      fromDate: p.fromdate || null,
      toDate: p.todate || null,
      dateModified: p.datemodified || null,
      reportUrl: (p.url && p.url.report) || null,
      ingestedAt: now,
      ttl,
    };
    try { await ddb.send(new PutCommand({ TableName: TABLE, Item: item })); stored++; }
    catch (e) { console.warn('[gdacs] put failed', item.eventKey, e.message); }
  }

  console.log(`[gdacs] stored ${stored}/${feats.length} events | levels=${JSON.stringify(byLevel)}`);
  return { ok: true, stored, byLevel };
};
