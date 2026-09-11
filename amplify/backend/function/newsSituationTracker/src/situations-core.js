// ⚠️ SHARED MODULE — keep byte-identical with newsGdacsIngest/src/situations-core.js.
// (Manual-deploy repo has no Lambda layers; sync by hand. Canonical: DATA_STRATEGY.md.)
'use strict';

// situations-core — pure, no-I/O helpers shared by the situation subsystem
// (MAP_HOME_SITUATION_PLAN.md / DATA_STRATEGY.md). NO AWS, NO LLM.
//
//   buildObservation(feature)  — GDACS GeoJSON feature → a compact "observation" (a fact about the
//                                world right now). Openers write observations; they hold no state.
//   buildSituation / coolSituation — the FOLD: (prior situation state, observation) → next state
//                                with transition ('opened'|'raised'|'lowered'|'spread'|'unchanged'|
//                                'cooled'). Used by the tracker (S2), which is the sole writer of
//                                situation state in S3.
//
// Tiers are canonical utils/riskTiers.js bands: low · moderate · elevated · high. No 'critical'
// ("critical" on the map is display-only = high + escalating). GDACS Red→high, Orange→elevated.

const OPEN_STATES = ['emerging', 'escalating', 'peak', 'cooling'];
const OPENING_LEVELS = new Set(['Orange', 'Red']);
const LEVEL_RANK = { Green: 0, Orange: 1, Red: 2 };
const LEVEL_TIER = { Red: 'high', Orange: 'elevated', Green: 'low' };
// Re-check cadence by tier (plan §4 WS2 cadence table), minutes.
const TIER_CADENCE_MIN = { high: 30, elevated: 120, moderate: 360, low: 360 };
const EVENT_LABEL = {
  EQ: 'earthquake', TC: 'tropical cyclone', FL: 'flood', VO: 'volcanic eruption',
  DR: 'drought', WF: 'wildfire', TS: 'tsunami',
};
const HISTORY_CAP = 200;

// ── feature → observation ────────────────────────────────────────────────────

function parseGeometry(feature) {
  const g = feature && feature.geometry;
  if (!g || !Array.isArray(g.coordinates)) return null;
  let pair = g.coordinates; // GeoJSON Point is [lon, lat]; drill into nested geometries.
  while (Array.isArray(pair) && Array.isArray(pair[0])) pair = pair[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lon = Number(pair[0]);
  const lat = Number(pair[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function eventKeyOf(p) { return `${p.eventtype}#${p.eventid}`; }

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

function affectedNames(p) {
  const out = [];
  const push = (v) => { const s = String(v || '').trim(); if (s && !out.includes(s)) out.push(s); };
  push(p.country);
  for (const c of Array.isArray(p.affectedcountries) ? p.affectedcountries : []) push(c && c.countryname);
  return out;
}

// GDACS severitytext is often a placeholder like "Magnitude 0" (no real scale, e.g. floods).
function cleanSeverity(sevText) {
  const s = String(sevText || '').trim();
  if (!s) return '';
  if (/^magnitude\s*0(\.0+)?\b/i.test(s)) return '';
  return s;
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function verbLabel(p) {
  const place = p.country || (p.name || '').replace(/^.* in /, '') || 'Unknown';
  const sev = cleanSeverity(p.severitydata && p.severitydata.severitytext);
  const base = `${place} — ${eventLabel(p)}`;
  return sev && sev.length <= 40 ? `${base} (${sev})` : base;
}

// A GDACS feature → a compact, provider-neutral observation (the inbox event payload).
function buildObservation(feature, observedAt) {
  const p = feature.properties || {};
  const label = eventLabel(p);
  const affected = affectedIso3(p);
  return {
    source: 'gdacs',
    eventKey: eventKeyOf(p),
    eventType: p.eventtype,
    level: p.alertlevel || 'Green',
    score: typeof p.alertscore === 'number' ? p.alertscore : null,
    episodeLevel: p.episodealertlevel || null,
    title: p.name || `${label[0].toUpperCase()}${label.slice(1)} in ${p.country || 'unknown location'}`,
    verb_label: verbLabel(p),
    axis: 'humanitarian',
    iso3_origin: p.iso3 ? [String(p.iso3).toUpperCase()] : affected.slice(0, 1),
    iso3_affected: affected,
    affected_names: affectedNames(p),
    centroid: parseGeometry(feature),
    severityText: cleanSeverity(p.severitydata && p.severitydata.severitytext),
    description: stripHtml(p.htmldescription || p.description).slice(0, 400) || null,
    reportUrl: (p.url && p.url.report) || null,
    dateModified: p.datemodified || null,
    observed_at: observedAt || null,
  };
}

// ── the fold: (prev state, observation) → next state ─────────────────────────

function nextCheckAt(nowIso, tier) {
  const mins = TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low;
  return new Date(new Date(nowIso).getTime() + mins * 60000).toISOString();
}

function appendHistory(prev, entry) {
  const h = Array.isArray(prev && prev.history) ? prev.history.slice(-(HISTORY_CAP - 1)) : [];
  h.push(entry);
  return h;
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

// Fold an Orange/Red observation into situation state. Pure; returns { item, change }.
function buildSituation(prev, obs, nowIso, ttl) {
  const level = obs.level || 'Green';
  const tier = LEVEL_TIER[level] || 'low';
  const affected = Array.isArray(obs.iso3_affected) ? obs.iso3_affected : [];
  const sevText = obs.severityText || '';
  const evidence = {
    gdacs_level: level,
    gdacs_score: typeof obs.score === 'number' ? obs.score : null,
    gdacs_episode_level: obs.episodeLevel || null,
    gdacs_severity_text: sevText,
    gdacs_report_url: obs.reportUrl || null,
    gdacs_date_modified: obs.dateModified || null,
    gdacs_description: obs.description || null,
    affected_count: affected.length,
  };
  const base = {
    situationId: `gdacs#${obs.eventKey}`,
    source: 'gdacs',
    gdacsEventKey: obs.eventKey,
    threadId: (prev && prev.threadId) || null,
    title: obs.title,
    verb_label: obs.verb_label,
    axis: obs.axis || 'humanitarian',
    tier,
    iso3_origin: obs.iso3_origin && obs.iso3_origin.length ? obs.iso3_origin : affected.slice(0, 1),
    iso3_affected: affected,
    affected_names: obs.affected_names || [],
    centroid: obs.centroid || (prev && prev.centroid) || null,
    spread_arcs: Array.isArray(prev && prev.spread_arcs) ? prev.spread_arcs : [],
    opened_at: (prev && prev.opened_at) || nowIso,
    updated_at: nowIso,
    last_checked_at: nowIso,
    check_count: ((prev && prev.check_count) || 0) + (prev ? 1 : 0),
    cadence_min: TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low,
    next_check_at: nextCheckAt(nowIso, tier),
    evidence,
    ttl,
  };

  if (!prev) {
    const what = `GDACS ${level} alert opened · ${eventLabel({ eventtype: obs.eventType })}${sevText ? ` · ${sevText}` : ''} · ${plural(affected.length, 'country', 'countries')} affected`;
    return { change: 'opened', item: { ...base, state: 'emerging', last_change_at: nowIso, what_changed: what, history: [{ at: nowIso, tier, level, score: evidence.gdacs_score, state: 'emerging', note: what }] } };
  }

  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Green';
  const prevRank = LEVEL_RANK[prevLevel] ?? 0;
  const rank = LEVEL_RANK[level] ?? 0;
  const prevAffected = Array.isArray(prev.iso3_affected) ? prev.iso3_affected : [];
  const newIso3 = affected.filter((c) => !prevAffected.includes(c));

  if (rank > prevRank) {
    const what = `Alert raised ${prevLevel}→${level}${sevText ? ` · ${sevText}` : ''}`;
    return { change: 'raised', item: { ...base, state: 'escalating', last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }) } };
  }
  if (rank < prevRank) {
    const what = `Alert lowered ${prevLevel}→${level}`;
    return { change: 'lowered', item: { ...base, state: 'cooling', last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'cooling', note: what }) } };
  }
  if (newIso3.length) {
    const origin = base.iso3_origin[0] || affected[0];
    const arcs = base.spread_arcs.concat(newIso3.filter((c) => c !== origin).map((c) => ({ from: origin, to: c, since: nowIso })));
    const what = `Spread to ${plural(newIso3.length, 'new country', 'new countries')}: ${newIso3.join(', ')}`;
    return { change: 'spread', item: { ...base, state: 'escalating', spread_arcs: arcs, last_change_at: nowIso, what_changed: what, history: appendHistory(prev, { at: nowIso, tier, level, score: evidence.gdacs_score, state: 'escalating', note: what }) } };
  }
  // Nothing moved.
  return { change: 'unchanged', item: { ...base, state: prev.state || 'peak', last_change_at: prev.last_change_at || prev.opened_at || nowIso, what_changed: prev.what_changed || null, history: Array.isArray(prev.history) ? prev.history : [] } };
}

// An open situation whose event is no longer Orange/Red (Green observation, or gone from the feed →
// obs === null). Marks it cooling at tier 'low' once; the tracker closes it after 3 low checks.
function coolSituation(prev, obs, nowIso, ttl) {
  const isNews = prev.source === 'news';
  // Keep the pre-cool tier through the grey-out window — `state: 'cooling'` already conveys
  // ended-ness; snapping to 'low' hid still-significant events during their cooldown (audit F3).
  const tier = prev.tier || 'low';
  const base = {
    ...prev, tier, updated_at: nowIso, last_checked_at: nowIso,
    check_count: ((prev.check_count) || 0) + 1,
    cadence_min: TIER_CADENCE_MIN.low, next_check_at: nextCheckAt(nowIso, 'low'), ttl,
  };
  if (prev.state === 'cooling') return { change: 'unchanged', item: base };
  // Source-aware wording: never leak GDACS vocabulary / gdacs_* fields onto a news situation (audit F3).
  const prevLevel = (prev.evidence && prev.evidence.gdacs_level) || 'Orange';
  const what = isNews
    ? 'No longer in active coverage'
    : (obs ? `Alert lowered ${prevLevel}→Green` : 'Event no longer current in GDACS');
  const evidence = isNews
    ? { ...(prev.evidence || {}) }
    : {
        ...(prev.evidence || {}),
        gdacs_level: obs ? 'Green' : 'Gone',
        gdacs_score: obs && typeof obs.score === 'number' ? obs.score : (prev.evidence && prev.evidence.gdacs_score) || null,
        gdacs_date_modified: (obs && obs.dateModified) || (prev.evidence && prev.evidence.gdacs_date_modified) || null,
      };
  return {
    change: 'cooled',
    item: {
      ...base, state: 'cooling', last_change_at: nowIso, what_changed: what,
      evidence,
      history: appendHistory(prev, { at: nowIso, tier, level: isNews ? null : (obs ? 'Green' : 'Gone'), score: obs && typeof obs.score === 'number' ? obs.score : null, state: 'cooling', note: what }),
    },
  };
}

// ── news stories → situations (S3·T3) ────────────────────────────────────────
// A clustered news story (from newsSituationIngest) → situation state. Tier from severity, axis from
// the story; escalating when coverage is accelerating or spreading. situationId `news#<storyId>`.
const SEV_TIER = { 5: 'high', 4: 'elevated', 3: 'moderate', 2: 'low', 1: 'low' };
const TIER_ORDER = ['low', 'moderate', 'elevated', 'high'];
// Corroboration cap (audit F2): a single-outlet story can't claim 'high' on one LLM severity call.
// 1 outlet → moderate max, 2 → elevated max, ≥3 → uncapped. GDACS disasters never flow through here
// (they carry official severity, not outlet counts), so this can never touch their tiers.
const OUTLET_TIER_CAP = { 1: 'moderate', 2: 'elevated' };
function capTierByOutlets(tier, outlets, capMap = OUTLET_TIER_CAP) {
  const cap = capMap[Number(outlets) || 0];
  if (!cap) return tier; // ≥3 outlets (or unknown) → no cap
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(cap) ? cap : tier;
}
function buildStorySituation(prev, story, nowIso, ttl, opts = {}) {
  const rawTier = SEV_TIER[story.max_severity] || 'moderate';
  const tier = opts.corroborationCap === false ? rawTier : capTierByOutlets(rawTier, story.outlets, opts.outletTierCap);
  const affected = Array.isArray(story.iso3) ? story.iso3 : [];
  // Escalation hysteresis (audit F4): a 1→2 outlet bump reads as velocity 2.0 — require prior
  // corroboration (prev outlets ≥ 2) before velocity counts; ignore spread on a brand-new story
  // (prev === null re-announces its whole country set); rate-limit repeat 'raised' via a cooldown.
  const prevOutlets = prev && prev.evidence ? Number(prev.evidence.outlets) || 0 : 0;
  const velEscalating = (Number(story.velocity) || 1) >= 1.5 && prevOutlets >= 2;
  const spreadEscalating = !!prev && Array.isArray(story.spread_new_iso3) && story.spread_new_iso3.length > 0;
  const escalating = velEscalating || spreadEscalating;
  const parts = [`${plural(story.outlets || 1, 'outlet', 'outlets')}`];
  if (velEscalating) parts.push(`coverage ${story.velocity}× prior`);
  if (spreadEscalating) parts.push(`spreading to ${story.spread_new_iso3.join(', ')}`);
  const what = parts.join(' · ');
  const label = String(story.title || '').slice(0, 90);
  // Reopen handling (audit F6): a closed situation whose storyId reappears re-opens fresh — it does
  // not silently resume at 'peak' with a stale opened_at.
  const reopened = !!prev && prev.state === 'closed';
  const tierChanged = !prev || reopened || prev.tier !== tier;
  const raiseCooldownMs = (opts.raiseCooldownMin ?? 180) * 60000;
  const lastRaisedAt = prev && prev.last_raised_at ? new Date(prev.last_raised_at).getTime() : 0;
  const raiseCooledDown = (new Date(nowIso).getTime() - lastRaisedAt) >= raiseCooldownMs;
  let change = 'unchanged';
  if (!prev) change = 'opened';
  else if (reopened) change = 'reopened';
  else if (escalating && prev.state !== 'escalating' && raiseCooledDown) change = 'raised';
  const state = (!prev || reopened) ? 'emerging' : (escalating ? 'escalating' : 'peak');
  const base = {
    situationId: `news#${story.storyId}`, source: 'news', storyId: story.storyId,
    // Event-registry link (Phase 1): the current map wins when present; otherwise LATCH the
    // previously-proven threadId for the situation's lifetime. Latching (not mirroring) because
    // topics rotate every ~4h while the thread page lives 90 days — a URL-proven link shouldn't
    // blink off when its topic ages out. Situations close in days ≪ 90d, so a latched link can't
    // outlive its page.
    threadId: opts.threadId || (prev && prev.threadId) || null,
    title: story.title, verb_label: label, axis: story.axis || 'political', tier,
    iso3_origin: affected.slice(0, 1), iso3_affected: affected, affected_names: [],
    centroid: story.centroid || (prev && prev.centroid) || null,
    spread_arcs: Array.isArray(prev && prev.spread_arcs) ? prev.spread_arcs : [],
    // reopen resets the age clock; a continuing story keeps its original opened_at.
    opened_at: (prev && !reopened && prev.opened_at) || nowIso,
    tier_changed_at: tierChanged ? nowIso : (prev.tier_changed_at || prev.opened_at || nowIso),
    last_raised_at: change === 'raised' ? nowIso : ((prev && prev.last_raised_at) || null),
    updated_at: nowIso, last_checked_at: nowIso,
    check_count: ((prev && prev.check_count) || 0) + (prev ? 1 : 0),
    cadence_min: TIER_CADENCE_MIN[tier] || TIER_CADENCE_MIN.low, next_check_at: nextCheckAt(nowIso, tier),
    evidence: { outlets: story.outlets, max_severity: story.max_severity, velocity: story.velocity, coverage_ratio: Number(story.velocity) || null, spread_new_iso3: story.spread_new_iso3 || [], category: story.category, headlines: story.headlines || [] },
    ttl,
  };
  return {
    change,
    item: {
      ...base, state,
      last_change_at: change === 'unchanged' ? (prev.last_change_at || nowIso) : nowIso,
      what_changed: change === 'unchanged' ? (prev.what_changed || what) : what,
      history: change === 'unchanged' ? (Array.isArray(prev.history) ? prev.history : []) : appendHistory(prev, { at: nowIso, tier, state, note: what }),
    },
  };
}

module.exports = {
  OPEN_STATES, OPENING_LEVELS, LEVEL_RANK, LEVEL_TIER, TIER_CADENCE_MIN,
  parseGeometry, eventKeyOf, eventLabel, affectedIso3, cleanSeverity, verbLabel,
  buildObservation, nextCheckAt, appendHistory, buildSituation, coolSituation, buildStorySituation,
  capTierByOutlets,
};
