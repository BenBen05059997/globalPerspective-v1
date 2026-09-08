'use strict';

// newsSituationTracker — the FOLDER (DATA_STRATEGY.md). Sole writer of situation state + the map
// bundle. Every rate(10 minutes) sweep:
//   1. read the latest observation snapshot(s) from situations/inbox/ (written by openers: GDACS now)
//   2. load current state (situations/index.json → situations/state/<id>.json)
//   3. FOLD: buildSituation for each observation, coolSituation for open situations gone from the
//      snapshot, apply the close rule (cooling for N sweeps → closed)
//   4. write changed state/<id>.json, situations/index.json, situations/history/<...>.json
//   5. assemble world/latest.json (+ member + timestamped snapshot) — situations + freshness + lede
//      + ranked + systemic
//   6. (live only) move processed inbox snapshots to situations/inbox/processed/
// NO LLM in S2 (what_changed is templated by the fold). DRY_RUN writes a parallel shadow universe
// under world/shadow/ and shadow/situations/ and never consumes the inbox.

const core = require('./situations-core');
const { buildSituation, coolSituation, LEVEL_TIER } = core;

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default true (shadow) until explicitly flipped
const SWEEP_MIN = Number(process.env.SWEEP_MIN) || 10;
const GDACS_STALE_MIN = Number(process.env.GDACS_STALE_MIN) || 45; // > 2× the 20-min GDACS cadence
const CLOSE_AFTER_COOL_CHECKS = Number(process.env.CLOSE_AFTER_COOL_CHECKS) || 3;
const CLOSED_KEEP_HOURS = Number(process.env.CLOSED_KEEP_HOURS) || 48;
const SITUATION_TTL_DAYS = Number(process.env.SITUATION_TTL_DAYS) || 60;
const METRIC_NS = process.env.METRIC_NS || 'GlobalPerspective/Situations';

// Prefixes differ in shadow so DRY_RUN is a fully parallel universe.
const P = DRY_RUN
  ? { state: 'shadow/situations/state', index: 'shadow/situations/index.json', history: 'shadow/situations/history', archive: 'shadow/situations/archive', world: 'world/shadow/latest.json', worldSnap: 'world/shadow', worldMember: 'world/shadow/latest.member.json' }
  : { state: 'situations/state', index: 'situations/index.json', history: 'situations/history', archive: 'situations/archive', world: 'world/latest.json', worldSnap: 'world', worldMember: 'world/latest.member.json' };
const INBOX_PREFIX = 'situations/inbox/';
const TIER_RANK = { high: 0, elevated: 1, moderate: 2, low: 3 };
// URL/S3-safe object-key form of a situationId (ids contain '#', unsafe in keys/paths).
const stateKey = (id) => id.replace(/[^A-Za-z0-9._-]/g, '_');

let _s3, _cw;
function s3() { if (!_s3) { const { S3Client } = require('@aws-sdk/client-s3'); _s3 = new S3Client({ region: REGION }); } return _s3; }
function cw() { if (!_cw) { const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch'); _cw = new CloudWatchClient({ region: REGION }); } return _cw; }

// ── pure logic (exported for tests) ──────────────────────────────────────────

// Fold the latest observations into prior state. priorStates: {id: state}. observations: obs[].
// Returns { states: {id: state}, changes: [{id, change}], counts }.
function foldSweep(priorStates, observations, nowIso, ttl, opts = {}) {
  const closeAfter = opts.closeAfter ?? CLOSE_AFTER_COOL_CHECKS;
  const states = {};
  const changes = [];
  const counts = { opened: 0, raised: 0, lowered: 0, spread: 0, cooled: 0, closed: 0, unchanged: 0 };
  const obsById = new Map();
  for (const o of observations) obsById.set(`gdacs#${o.eventKey}`, o);

  // Apply observations (open/raise/spread/unchanged).
  for (const [id, obs] of obsById) {
    const prev = priorStates[id] || null;
    const { change, item } = buildSituation(prev, obs, nowIso, ttl);
    states[id] = item;
    counts[change] = (counts[change] || 0) + 1;
    if (change !== 'unchanged') changes.push({ id, change });
  }

  const dropped = [];
  // Situations in prior state but absent from the snapshot → cool, then maybe close.
  for (const [id, prev] of Object.entries(priorStates)) {
    if (obsById.has(id)) continue;
    if (prev.state === 'closed') {
      // keep briefly for the map's grey-out, then drop (→ handler archives the object)
      const ageH = (new Date(nowIso) - new Date(prev.closed_at || prev.last_change_at || nowIso)) / 3.6e6;
      if (ageH <= (opts.keepHours ?? CLOSED_KEEP_HOURS)) states[id] = prev; else dropped.push(id);
      continue;
    }
    const { change, item } = coolSituation(prev, null, nowIso, ttl);
    const coolingChecks = (prev.cooling_checks || 0) + 1;
    item.cooling_checks = coolingChecks;
    if (coolingChecks >= closeAfter) {
      item.state = 'closed';
      item.closed_at = nowIso;
      item.what_changed = 'Closed — inactive';
      counts.closed++;
      changes.push({ id, change: 'closed' });
    } else {
      counts[change] = (counts[change] || 0) + 1;
      if (change !== 'unchanged') changes.push({ id, change });
    }
    states[id] = item;
  }
  return { states, changes, counts, dropped };
}

function summarize(state) {
  return {
    id: state.situationId, source: state.source, verb_label: state.verb_label,
    axis: state.axis, tier: state.tier, state: state.state,
    escalating: state.state === 'escalating',
    centroid: state.centroid, iso3_affected: state.iso3_affected, affected_names: state.affected_names || [], spread_arcs: state.spread_arcs || [],
    opened_at: state.opened_at, last_change_at: state.last_change_at,
    what_changed: state.what_changed, threadId: state.threadId || null,
  };
}

function situationHref(s) {
  return s.threadId ? `/weekly/thread/${encodeURIComponent(s.threadId)}` : `/map?focus=${encodeURIComponent(s.id)}`;
}

function rankKey(s) {
  return [TIER_RANK[s.tier] ?? 9, s.escalating ? 0 : 1, -(new Date(s.last_change_at || 0).getTime())];
}

function deriveRanked(summaries) {
  return summaries.filter((s) => s.state !== 'closed').sort((a, b) => {
    const ka = rankKey(a); const kb = rankKey(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  }).map((s) => ({ id: s.id, title: s.verb_label, tier: s.tier, axis: s.axis, escalating: s.escalating, href: situationHref(s) }));
}

const TIER_WORD = { high: 'high-severity', elevated: 'elevated', moderate: 'moderate', low: 'low-level' };
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
function deriveLede(ranked, summaries) {
  const open = summaries.filter((s) => s.state !== 'closed');
  if (!open.length) return 'No critical situations are being tracked right now — the map is quiet.';
  const top = ranked[0];
  const tierWord = TIER_WORD[top.tier] || top.tier;
  const axisWord = top.axis || 'humanitarian';
  const escalating = open.filter((s) => s.escalating).length;
  if (open.length === 1) {
    return `${top.title} — ${article(tierWord)} ${tierWord} ${axisWord} alert${top.escalating ? ', escalating' : ''}. It is the only situation currently being tracked.`;
  }
  const tail = escalating ? ` ${escalating} of them ${escalating === 1 ? 'is' : 'are'} escalating.` : '';
  return `${open.length} situations are being tracked; the most severe is ${top.title} (${tierWord}).${tail}`;
}

function computeStale(sources, nowIso, thresholds = {}) {
  const now = new Date(nowIso).getTime();
  const gdacsMin = thresholds.gdacs ?? GDACS_STALE_MIN;
  const g = sources.gdacs ? (now - new Date(sources.gdacs).getTime()) / 60000 : Infinity;
  return g > gdacsMin;
}

function assembleWorld(states, nowIso, sources) {
  const all = Object.values(states).map(summarize);
  const open = all.filter((s) => s.state !== 'closed');
  const ranked = deriveRanked(all);
  return {
    schema: 1,
    generated_at: nowIso,
    next_expected_at: new Date(new Date(nowIso).getTime() + SWEEP_MIN * 60000).toISOString(),
    sources,
    stale: computeStale(sources, nowIso),
    situations: all, // includes recently-closed (state:'closed') for the map's grey-out
    lede: deriveLede(ranked, all),
    systemic: [], // populated from markets/economic disruption in a later task
    ranked,
    _counts: { open: open.length, total: all.length },
  };
}

// ── I/O ──────────────────────────────────────────────────────────────────────

async function getJson(key) {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404 || e.$metadata?.httpStatusCode === 403) return null;
    throw e;
  }
}
async function putJson(key, obj, cacheSeconds) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3().send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: JSON.stringify(obj), ContentType: 'application/json',
    CacheControl: cacheSeconds ? `public, max-age=${cacheSeconds}` : undefined,
  }));
}
async function listKeys(prefix, stopAtProcessed = true) {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const out = [];
  let token;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents || []) {
      if (stopAtProcessed && o.Key.startsWith(`${prefix}processed/`)) continue;
      if (o.Key.endsWith('.json')) out.push(o.Key);
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

// GDACS is a full-snapshot source: read its STABLE current pointer every sweep (never consumed), so
// an empty inbox never spuriously cools live situations. (Per-event sources like breaking-alert append
// timestamped events under INBOX_PREFIX; those are read + moved to processed/ — added with S3.)
async function readObservations() {
  const snap = await getJson(`${INBOX_PREFIX}gdacs-latest.json`);
  const observations = (snap && snap.events) || [];
  const gdacsObservedAt = (snap && snap.observed_at) || null;
  return { observations, gdacsObservedAt, processedKeys: [] };
}

async function loadPriorStates() {
  const index = await getJson(P.index);
  const ids = (index && index.ids) || [];
  const states = {};
  await Promise.all(ids.map(async (id) => {
    const st = await getJson(`${P.state}/${stateKey(id)}.json`);
    if (st) states[id] = st;
  }));
  return states;
}

async function putMetric(name, value) {
  try {
    const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
    await cw().send(new PutMetricDataCommand({ Namespace: METRIC_NS, MetricData: [{ MetricName: name, Value: value, Unit: 'Count', Dimensions: [{ Name: 'Mode', Value: DRY_RUN ? 'shadow' : 'live' }] }] }));
  } catch (e) { console.warn('[tracker] metric failed', name, e.message); }
}

exports.handler = async () => {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + SITUATION_TTL_DAYS * 86400;

  const [{ observations, gdacsObservedAt, processedKeys }, priorStates] = await Promise.all([readObservations(), loadPriorStates()]);
  const { states, changes, counts, dropped } = foldSweep(priorStates, observations, now, ttl);

  // Persist changed state objects; write index; write history + world bundle.
  const openIds = Object.keys(states);
  const summaries = Object.values(states).map(summarize);
  await Promise.all(Object.entries(states).map(([id, st]) => putJson(`${P.state}/${stateKey(id)}.json`, st)));
  await putJson(P.index, { updated_at: now, ids: openIds, situations: summaries });

  // Aged-out closed situations: move state → archive (durable record of the full life story),
  // don't orphan them. (Prior state we still hold, so we can write the archive from memory.)
  for (const id of dropped) {
    const prev = priorStates[id];
    if (!prev) continue;
    try {
      await putJson(`${P.archive}/${stateKey(id)}.json`, { ...prev, archived_at: now });
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `${P.state}/${stateKey(id)}.json` }));
    } catch (e) { console.warn('[tracker] archive failed', id, e.message); }
  }

  const world = assembleWorld(states, now, { gdacs: gdacsObservedAt });
  const memberWorld = { ...world, _member: true }; // same content for now; gated depth arrives with stories (S3)
  await putJson(P.world, world, 60);
  await putJson(P.worldMember, memberWorld, 0);
  const hk = now.slice(0, 13).replace(/[:T-]/g, '/'); // YYYY/MM/DD/HH
  await putJson(`${P.worldSnap}/${hk}/${now.slice(11, 16).replace(':', '')}.json`, world);
  await putJson(`${P.history}/${hk}/${now.slice(11, 16).replace(':', '')}.json`, { updated_at: now, situations: summaries });

  // Live mode consumes the inbox; shadow leaves it for the real run.
  let moved = 0;
  if (!DRY_RUN && processedKeys.length) {
    const { CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    for (const key of processedKeys) {
      const dest = key.replace(INBOX_PREFIX, `${INBOX_PREFIX}processed/`);
      try {
        await s3().send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/${key}`, Key: dest, ContentType: 'application/json' }));
        await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
        moved++;
      } catch (e) { console.warn('[tracker] inbox move failed', key, e.message); }
    }
  }

  const openCount = summaries.filter((s) => s.state !== 'closed').length;
  // Per-transition counts make the cooling/close rule tunable against live churn (CLOSE_AFTER_COOL_CHECKS,
  // GDACS_STALE_MIN are env knobs — no redeploy needed to tune).
  await Promise.all([
    putMetric('SituationsOpen', openCount), putMetric('ChecksRun', 1), putMetric('Changes', changes.length),
    putMetric('Opened', counts.opened || 0), putMetric('Raised', counts.raised || 0), putMetric('Spread', counts.spread || 0),
    putMetric('Cooled', counts.cooled || 0), putMetric('Closed', counts.closed || 0),
    putMetric('Observations', observations.length), putMetric('Stale', world.stale ? 1 : 0), putMetric('LLMCallsToday', 0),
  ]);
  const result = { ok: true, mode: DRY_RUN ? 'shadow' : 'live', observations: observations.length, open: openCount, counts, changes: changes.length, movedInbox: moved, stale: world.stale };
  console.log(`[tracker] ${JSON.stringify(result)}`);
  return result;
};

exports._internal = { foldSweep, assembleWorld, deriveRanked, deriveLede, computeStale, summarize, situationHref };
