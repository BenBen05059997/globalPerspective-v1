'use strict';

// newsGdacsIngest — ingest of GDACS (UN+EU Global Disaster Alert & Coordination System).
// Free, keyless, NO LLM. Every run:
//   1. Mirrors current disaster events into GlobalPerspectiveGdacsEvents (alert level, severity,
//      coordinates) so the impact pipeline can catch high-impact disasters the news selector misses.
//   2. Acts as the DETERMINISTIC OPENER for the situation tracker: Orange/Red events are upserted into
//      GlobalPerspectiveSituations (tier, state, affected countries, centroid, templated what_changed,
//      history). No tracker dependency — the tracker Lambda only sweeps the table.
//      GDACS Red → tier 'high', Orange → 'elevated', Green → 'low' (canonical utils/riskTiers.js bands;
//      there is no "critical" tier — "critical" on the map is display-only = high + escalating).
//
// History: shadow-only (own table) 2026-06-24 → 2026-09-08 (IMPACT_FIRST_REDESIGN_PLAN.md §3.5);
// promoted to situation opener by MAP_HOME_SITUATION_PLAN.md (§3.1 LLM boundary, §4 WS1.6 / WS2).

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.GDACS_TABLE || 'GlobalPerspectiveGdacsEvents';
const FEED = process.env.GDACS_FEED || 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';
const TTL_DAYS = Number(process.env.GDACS_TTL_DAYS) || 30;

const SITUATIONS_TABLE = process.env.SITUATIONS_TABLE || 'GlobalPerspectiveSituations';
const SITUATIONS_STATE_INDEX = process.env.SITUATIONS_STATE_INDEX || 'state-next_check_at-index';
const SITUATION_TTL_DAYS = Number(process.env.SITUATION_TTL_DAYS) || 60;
const SITUATIONS_DISABLED = process.env.SITUATIONS_DISABLED === 'true';

// Situation states the ingest treats as "open" (the tracker owns 'closed').
const OPEN_STATES = ['emerging', 'escalating', 'peak', 'cooling'];
// Alert levels that open/keep a situation. Green is tracked in the events table only.
const OPENING_LEVELS = new Set(['Orange', 'Red']);
const LEVEL_RANK = { Green: 0, Orange: 1, Red: 2 };
// Canonical tiers (utils/riskTiers.js): low · moderate · elevated · high. No 'critical'.
const LEVEL_TIER = { Red: 'high', Orange: 'elevated', Green: 'low' };
// Re-check cadence by tier (MAP_HOME_SITUATION_PLAN.md §4 WS2 cadence table), in minutes.
const TIER_CADENCE_MIN = { high: 30, elevated: 120, moderate: 360, low: 360 };
const EVENT_LABEL = {
  EQ: 'earthquake', TC: 'tropical cyclone', FL: 'flood', VO: 'volcanic eruption',
  DR: 'drought', WF: 'wildfire', TS: 'tsunami',
};
const HISTORY_CAP = 200;

// Lazy so the pure helpers (and their tests) load without the AWS SDK present.
let _ddb;
function ddb() {
  if (!_ddb) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    _ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}
function cmd(name) {
  return require('@aws-sdk/lib-dynamodb')[name];
}

// ---------------------------------------------------------------------------
// Pure helpers (exported under _internal for tests)
// ---------------------------------------------------------------------------

function parseGeometry(feature) {
  const g = feature && feature.geometry;
  if (!g || !Array.isArray(g.coordinates)) return null;
  // GeoJSON Point is [lon, lat]. For nested geometries take the first coordinate pair.
  let pair = g.coordinates;
  while (Array.isArray(pair) && Array.isArray(pair[0])) pair = pair[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lon = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function eventKeyOf(p) {
  return `${p.eventtype}#${p.eventid}`;
}

function eventLabel(p) {
  const t = String(p.eventtype || '').toUpperCase();
  return EVENT_LABEL[t] || t.toLowerCase() || 'disaster event';
}

function affectedIso3(p) {
  const out = [];
  const push = (v) => { const s = String(v || '').toUpperCase(); if (s && !out.includes(s)) out.push(s); };
  push(p.iso3);
  for (const c of Array.isArray(p.affectedcountries) ? p.affectedcountries : []) push(c && c.iso3);
  return out;
}

// GDACS severitytext is often a placeholder like "Magnitude 0" (no real scale, e.g. floods).
// Return a clean string only when it carries meaning.
function cleanSeverity(sevText) {
  const s = String(sevText || '').trim();
  if (!s) return '';
  if (/^magnitude\s*0(\.0+)?\b/i.test(s)) return '';
  return s;
}

function verbLabel(p) {
  const place = p.country || (p.name || '').replace(/^.* in /, '') || 'Unknown';
  const sev = cleanSeverity(p.severitydata && p.severitydata.severitytext);
  const base = `${place} — ${eventLabel(p)}`;
  return sev && sev.length <= 40 ? `${base} (${sev})` : base;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

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

function nextCheckAt(nowIso, tier) {
  const mins = TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low;
  return new Date(new Date(nowIso).getTime() + mins * 60000).toISOString();
}

function appendHistory(prev, entry) {
  const h = Array.isArray(prev && prev.history) ? prev.history.slice(-(HISTORY_CAP - 1)) : [];
  h.push(entry);
  return h;
}

// Upsert decision for an Orange/Red feature. Returns { item, change } where change is one of
// 'opened' | 'raised' | 'lowered' | 'spread' | 'unchanged'. Pure: no I/O.
function buildSituation(prev, feature, nowIso, ttl) {
  const p = feature.properties || {};
  const level = p.alertlevel || 'Green';
  const tier = LEVEL_TIER[level] || 'low';
  const label = eventLabel(p);
  const affected = affectedIso3(p);
  const geo = parseGeometry(feature);
  const sevText = cleanSeverity(p.severitydata && p.severitydata.severitytext);
  const evidence = {
    gdacs_level: level,
    gdacs_score: typeof p.alertscore === 'number' ? p.alertscore : null,
    gdacs_episode_level: p.episodealertlevel || null,
    gdacs_severity_text: sevText,
    gdacs_report_url: (p.url && p.url.report) || null,
    gdacs_date_modified: p.datemodified || null,
    affected_count: affected.length,
  };

  const base = {
    situationId: `gdacs#${eventKeyOf(p)}`,
    gsiAll: 'ALL',
    source: 'gdacs',
    gdacsEventKey: eventKeyOf(p),
    threadId: (prev && prev.threadId) || null,
    title: p.name || `${label[0].toUpperCase()}${label.slice(1)} in ${p.country || 'unknown location'}`,
    verb_label: verbLabel(p),
    axis: 'humanitarian',
    tier,
    iso3_origin: p.iso3 ? [String(p.iso3).toUpperCase()] : affected.slice(0, 1),
    iso3_affected: affected,
    centroid: geo || (prev && prev.centroid) || null,
    spread_arcs: Array.isArray(prev && prev.spread_arcs) ? prev.spread_arcs : [],
    opened_at: (prev && prev.opened_at) || nowIso,
    updated_at: nowIso,
    last_checked_at: nowIso,
    check_count: (prev && prev.check_count) || 0,
    cadence_min: TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low,
    next_check_at: nextCheckAt(nowIso, tier),
    evidence,
    ttl,
  };

  if (!prev) {
    const what = `GDACS ${level} alert opened · ${label}${sevText ? ` · ${sevText}` : ''} · ${plural(affected.length, 'country', 'countries')} affected`;
    return {
      change: 'opened',
      item: {
        ...base,
        state: 'emerging',
        last_change_at: nowIso,
        what_changed: what,
        history: [{ at: nowIso, tier, level, score: evidence.gdacs_score, state: 'emerging', note: what }],
      },
    };
  }

  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Green';
  const prevRank = LEVEL_RANK[prevLevel] ?? 0;
  const rank = LEVEL_RANK[level] ?? 0;
  const prevAffected = Array.isArray(prev.iso3_affected) ? prev.iso3_affected : [];
  const newIso3 = affected.filter((c) => !prevAffected.includes(c));

  if (rank > prevRank) {
    const what = `Alert raised ${prevLevel}→${level}${sevText ? ` · ${sevText}` : ''}`;
    return {
      change: 'raised',
      item: {
        ...base,
        state: 'escalating',
        last_change_at: nowIso,
        what_changed: what,
        history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }),
      },
    };
  }
  if (rank < prevRank) {
    const what = `Alert lowered ${prevLevel}→${level}`;
    return {
      change: 'lowered',
      item: {
        ...base,
        state: 'cooling',
        last_change_at: nowIso,
        what_changed: what,
        history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'cooling', note: what }),
      },
    };
  }
  if (newIso3.length) {
    const origin = base.iso3_origin[0] || affected[0];
    const arcs = base.spread_arcs.concat(newIso3.filter((c) => c !== origin).map((c) => ({ from: origin, to: c, since: nowIso })));
    const what = `Spread to ${plural(newIso3.length, 'new country', 'new countries')}: ${newIso3.join(', ')}`;
    return {
      change: 'spread',
      item: {
        ...base,
        state: 'escalating',
        spread_arcs: arcs,
        last_change_at: nowIso,
        what_changed: what,
        history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }),
      },
    };
  }

  // Nothing moved: keep state/what_changed/history, refresh the check stamps only.
  return {
    change: 'unchanged',
    item: {
      ...base,
      state: prev.state || 'peak',
      last_change_at: prev.last_change_at || prev.opened_at || nowIso,
      what_changed: prev.what_changed || null,
      history: Array.isArray(prev.history) ? prev.history : [],
    },
  };
}

// An open GDACS situation whose event is no longer Orange/Red (dropped to Green, or gone from the
// feed). Marks it cooling at tier 'low' once; the tracker closes it after 3 consecutive low checks.
function coolSituation(prev, greenFeature, nowIso, ttl) {
  const alreadyCool = prev.tier === 'low' && prev.state === 'cooling';
  const tier = 'low';
  const base = {
    ...prev,
    tier,
    updated_at: nowIso,
    last_checked_at: nowIso,
    cadence_min: TIER_CADENCE_MIN[tier],
    next_check_at: nextCheckAt(nowIso, tier),
    ttl,
  };
  if (alreadyCool) return { change: 'unchanged', item: base };
  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Orange';
  const what = greenFeature
    ? `Alert lowered ${prevLevel}→Green`
    : 'Event no longer current in GDACS';
  const gp = (greenFeature && greenFeature.properties) || {};
  return {
    change: 'cooled',
    item: {
      ...base,
      state: 'cooling',
      last_change_at: nowIso,
      what_changed: what,
      evidence: {
        ...(prev.evidence || {}),
        gdacs_level: greenFeature ? 'Green' : 'Gone',
        gdacs_score: typeof gp.alertscore === 'number' ? gp.alertscore : (prev.evidence && prev.evidence.gdacs_score) || null,
        gdacs_date_modified: gp.datemodified || (prev.evidence && prev.evidence.gdacs_date_modified) || null,
      },
      history: appendHistory(prev, { at: nowIso, tier, level: greenFeature ? 'Green' : 'Gone', score: typeof gp.alertscore === 'number' ? gp.alertscore : null, state: 'cooling', note: what }),
    },
  };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

async function loadOpenGdacsSituations() {
  const byKey = new Map();
  for (const state of OPEN_STATES) {
    let ExclusiveStartKey;
    do {
      const out = await ddb().send(new (cmd("QueryCommand"))({
        TableName: SITUATIONS_TABLE,
        IndexName: SITUATIONS_STATE_INDEX,
        KeyConditionExpression: '#s = :s',
        FilterExpression: '#src = :src',
        ExpressionAttributeNames: { '#s': 'state', '#src': 'source' },
        ExpressionAttributeValues: { ':s': state, ':src': 'gdacs' },
        ExclusiveStartKey,
      }));
      for (const it of out.Items || []) if (it.gdacsEventKey) byKey.set(it.gdacsEventKey, it);
      ExclusiveStartKey = out.LastEvaluatedKey;
    } while (ExclusiveStartKey);
  }
  return byKey;
}

async function syncSituations(feats, nowIso) {
  const ttl = Math.floor(Date.now() / 1000) + SITUATION_TTL_DAYS * 86400;
  const counts = { open: 0, opened: 0, raised: 0, lowered: 0, spread: 0, cooled: 0, unchanged: 0, failed: 0 };
  const prevByKey = await loadOpenGdacsSituations();
  const featByKey = new Map();
  for (const f of feats) {
    const p = f.properties || {};
    if (p.eventid && p.eventtype) featByKey.set(eventKeyOf(p), f);
  }

  const writes = [];
  for (const [key, f] of featByKey) {
    const level = (f.properties || {}).alertlevel || 'Green';
    const prev = prevByKey.get(key) || null;
    if (OPENING_LEVELS.has(level)) {
      writes.push(buildSituation(prev, f, nowIso, ttl));
    } else if (prev) {
      writes.push(coolSituation(prev, f, nowIso, ttl));
    }
  }
  for (const [key, prev] of prevByKey) {
    if (!featByKey.has(key)) writes.push(coolSituation(prev, null, nowIso, ttl));
  }

  for (const { item, change } of writes) {
    try {
      await ddb().send(new (cmd("PutCommand"))({ TableName: SITUATIONS_TABLE, Item: item }));
      counts[change] = (counts[change] || 0) + 1;
      counts.open++;
      if (change !== 'unchanged') console.log(`[gdacs][situation] ${change}: ${item.situationId} tier=${item.tier} state=${item.state} — ${item.what_changed}`);
    } catch (e) {
      counts.failed++;
      console.warn('[gdacs][situation] put failed', item.situationId, e.message);
    }
  }
  return counts;
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
  let stored = 0;
  let withGeo = 0;
  const byLevel = { Green: 0, Orange: 0, Red: 0 };

  for (const f of feats) {
    const p = f.properties || {};
    if (!p.eventid || !p.eventtype) continue;
    if (p.alertlevel in byLevel) byLevel[p.alertlevel]++;
    const item = buildEventItem(f, now, ttl);
    if (item.lat !== null) withGeo++;
    try { await ddb().send(new (cmd("PutCommand"))({ TableName: TABLE, Item: item })); stored++; }
    catch (e) { console.warn('[gdacs] put failed', item.eventKey, e.message); }
  }
  console.log(`[gdacs] stored ${stored}/${feats.length} events (${withGeo} with coordinates) | levels=${JSON.stringify(byLevel)}`);

  let situations = null;
  if (SITUATIONS_DISABLED) {
    console.log('[gdacs][situation] disabled via SITUATIONS_DISABLED');
  } else {
    try {
      situations = await syncSituations(feats, now);
      console.log(`[gdacs][situation] ${JSON.stringify(situations)}`);
    } catch (e) {
      // Situations are additive: a missing table / IAM gap must never fail the events mirror.
      console.error('[gdacs][situation] sync failed:', e.message);
      situations = { error: e.message };
    }
  }

  return { ok: true, stored, withGeo, byLevel, situations };
};

exports._internal = {
  parseGeometry, eventKeyOf, eventLabel, affectedIso3, verbLabel,
  buildEventItem, buildSituation, coolSituation, nextCheckAt,
  LEVEL_TIER, TIER_CADENCE_MIN, OPEN_STATES,
};
