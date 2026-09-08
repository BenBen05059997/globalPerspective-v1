'use strict';

// classifier-core — pure helpers for newsSituationIngest (S3). NO AWS, NO network.
//   buildMessages(articles)      — batch of articles → chat messages for the flash classifier
//   parseClassification(text)    — robust JSON extraction → array of per-article classifications
//   normalizeClassified(raw,art) — merge a classification with its source article + validate
//   clusterStories(classified, nowIso, prevIndex) — deterministic clustering → stories[]
//
// Axis is constrained to the 4 map hues; category is finer-grained. latlon is model-provided
// (the flash model knows locations well enough to place a dot), so no iso3→centroid table is needed.

const AXES = new Set(['conflict', 'political', 'economic', 'humanitarian']);

function buildMessages(articles) {
  const lines = articles.map((a, i) => `${i + 1}. ${a.title}${a.description ? ` — ${a.description.slice(0, 140)}` : ''}`).join('\n');
  const system = 'You are a precise geopolitical news classifier. Return STRICT JSON only, no prose.';
  const user = [
    'Classify each numbered headline. Return a JSON object: {"articles":[{...}]} with one entry per headline, in order.',
    'Each entry: {',
    '  "n": <the headline number>,',
    '  "iso3": [ISO 3166-1 alpha-3 country codes most involved, 0-4],',
    '  "latlon": [lat, lon] of the primary place the event is happening (approximate; country centroid is fine),',
    '  "category": one of "war"|"unrest"|"diplomacy"|"election"|"policy"|"economy"|"markets"|"disaster"|"health"|"tech"|"other",',
    '  "axis": one of "conflict"|"political"|"economic"|"humanitarian" (the dominant kind of impact),',
    '  "severity": integer 1-5 (5 = major, world-moving; 1 = minor/routine),',
    '  "kind": "event" (something happened) | "analysis" | "commentary",',
    '  "entities": [up to 4 key named actors/places/things]',
    '}',
    'If a headline is not about a real-world situation (sport, celebrity, lifestyle), set severity 1 and category "other".',
    'Headlines:',
    lines,
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function parseClassification(text) {
  if (!text) return [];
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  // Find the JSON object.
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const obj = JSON.parse(t);
    return Array.isArray(obj.articles) ? obj.articles : (Array.isArray(obj) ? obj : []);
  } catch {
    return [];
  }
}

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

// Merge one raw classification with its source article; drop invalid.
function normalizeClassified(raw, article) {
  if (!raw || !article) return null;
  const axis = AXES.has(raw.axis) ? raw.axis : null;
  let latlon = null;
  if (Array.isArray(raw.latlon) && raw.latlon.length === 2) {
    const lat = toNum(raw.latlon[0]); const lon = toNum(raw.latlon[1]);
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) latlon = { lat, lon };
  }
  const iso3 = Array.isArray(raw.iso3) ? raw.iso3.map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)).slice(0, 4) : [];
  const severity = Math.min(5, Math.max(1, Math.round(toNum(raw.severity) || 1)));
  const entities = Array.isArray(raw.entities) ? raw.entities.map((e) => String(e).trim()).filter(Boolean).slice(0, 4) : [];
  return {
    title: article.title, url: article.url, domain: domainOf(article.url), source: article.source || domainOf(article.url),
    iso3, latlon, axis, category: String(raw.category || 'other').toLowerCase(),
    severity, kind: ['event', 'analysis', 'commentary'].includes(raw.kind) ? raw.kind : 'event', entities,
  };
}

function domainOf(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
}

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }

// Deterministic clustering: group classifiable EVENTS by (axis, primary iso3, shared entity) →
// one story. storyId is stable across runs so velocity/spread accumulate. prevIndex: {storyId: prevStory}.
function clusterStories(classified, nowIso, prevIndex = {}) {
  const events = classified.filter((c) => c && c.axis && c.severity >= 2 && c.iso3.length && c.latlon);
  const groups = new Map();
  for (const c of events) {
    const iso = c.iso3[0];
    const ent = (c.entities[0] || c.category || 'general');
    const key = `${c.axis}#${iso}#${slug(ent)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const stories = [];
  for (const [storyId, items] of groups) {
    const domains = [...new Set(items.map((i) => i.domain).filter(Boolean))];
    const isoSet = [...new Set(items.flatMap((i) => i.iso3))];
    const maxSev = Math.max(...items.map((i) => i.severity));
    const lat = items.reduce((s, i) => s + i.latlon.lat, 0) / items.length;
    const lon = items.reduce((s, i) => s + i.latlon.lon, 0) / items.length;
    const prev = prevIndex[storyId] || null;
    const prevOutlets = prev ? (prev.outlets || 0) : 0;
    const prevIso = prev ? (prev.iso3 || []) : [];
    stories.push({
      storyId,
      axis: items[0].axis,
      category: items[0].category,
      title: items.sort((a, b) => b.severity - a.severity)[0].title,
      iso3: isoSet,
      centroid: { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 },
      max_severity: maxSev,
      outlets: domains.length,
      articles: items.length,
      velocity: prev ? +(domains.length / Math.max(prevOutlets, 1)).toFixed(2) : 1,
      spread_new_iso3: isoSet.filter((c) => !prevIso.includes(c)),
      first_seen: prev ? (prev.first_seen || nowIso) : nowIso,
      last_seen: nowIso,
      entities: [...new Set(items.flatMap((i) => i.entities))].slice(0, 6),
      headlines: items.slice(0, 5).map((i) => ({ title: i.title, url: i.url, domain: i.domain })),
    });
  }
  // Most significant first.
  stories.sort((a, b) => (b.outlets * b.max_severity) - (a.outlets * a.max_severity));
  return stories;
}

module.exports = { AXES, buildMessages, parseClassification, normalizeClassified, clusterStories, domainOf, slug };
