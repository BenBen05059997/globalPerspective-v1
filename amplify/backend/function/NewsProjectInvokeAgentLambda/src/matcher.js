'use strict';

// Event-registry matcher (EVENT_REGISTRY_PLAN / MATCHER_SPEC). Pure, no AWS deps.
// Builds a storyId → { threadId, tier, evidence } map linking MAP stories (S3 stories/state) to
// EDITORIAL threads (topics' threadId) via two tiers, BOTH null-on-ambiguity (a wrong "Full
// analysis →" link is misinformation — the hard no):
//   Tier 1  exact article-URL overlap (topic sources[].url ∩ story headlines[].url, normalized).
//   Tier 2  R3 fingerprint — ≥2 shared ISO3 countries AND ≥1 shared normalized named actor.
//           GATED off by default (opts.enableR3); ships only after the real-tag re-measurement.
// Keyed by storyId so the tracker's O(1) lookup is pairs["<storyId>"] (situationId = "news#"+storyId).

const { normalizeUrl } = require('./url-normalize');
const { normalizeEntity } = require('./entity-normalize');

function urlSet(objs) {
  const s = new Set();
  for (const o of objs || []) { const n = normalizeUrl(o && (o.url || o.link)); if (n) s.add(n); }
  return s;
}
function iso3Set(arr) {
  const s = new Set();
  for (const c of arr || []) { const u = String(c || '').toUpperCase().trim(); if (/^[A-Z]{3}$/.test(u)) s.add(u); }
  return s;
}
function actorSet(arr) {
  const s = new Set();
  for (const a of arr || []) { const n = normalizeEntity(a); if (n) s.add(n); }
  return s;
}
function firstShared(a, b) { for (const x of a) if (b.has(x)) return x; return null; }
function allShared(a, b) { const out = []; for (const x of a) if (b.has(x)) out.push(x); return out; }

// A story links only if every candidate agrees on ONE threadId (same-thread duplicates are fine;
// two different threads = ambiguous = no link).
function pickUnambiguous(cands) {
  if (!cands.length) return null;
  if (new Set(cands.map((c) => c.threadId)).size !== 1) return null;
  return cands[0];
}

// topics:  [{ id, threadId, sources:[{url}], iso3:[], actors:[] }]  (raw staging topics, Phase 1b tags)
// stories: [{ storyId, headlines:[{url}], iso3:[], entities:[] }]   (S3 stories/state objects)
function buildStoryMap(topics, stories, opts = {}) {
  const enableR3 = opts.enableR3 === true;
  const now = opts.now || new Date().toISOString();
  const T = (topics || [])
    .filter((t) => t && t.threadId) // no threadId ⇒ nothing to link to
    .map((t) => ({ id: t.id, threadId: t.threadId, urls: urlSet(t.sources), iso3: iso3Set(t.iso3), actors: actorSet(t.actors) }));

  const pairs = {};
  const counts = { tier1: 0, tier2: 0, ambiguous_url: 0, ambiguous_r3: 0, stories: 0, topics: T.length };
  for (const st of stories || []) {
    if (!st || !st.storyId) continue;
    counts.stories++;
    const sUrls = urlSet(st.headlines);
    // Tier 1 — URL overlap
    const t1 = [];
    for (const t of T) { const u = firstShared(sUrls, t.urls); if (u) t1.push({ threadId: t.threadId, topic_id: t.id, evidence: { shared_url: u } }); }
    const c1 = pickUnambiguous(t1);
    if (c1) { pairs[st.storyId] = { ...c1, tier: 1, matched_at: now }; counts.tier1++; continue; }
    if (t1.length > 0) { counts.ambiguous_url++; continue; } // URL candidates disagreed → no link, don't fall through to the weaker tier
    if (!enableR3) continue;
    // Tier 2 — R3 fingerprint
    const sIso3 = iso3Set(st.iso3);
    const sActors = actorSet(st.entities);
    const t2 = [];
    for (const t of T) {
      const sharedIso3 = allShared(sIso3, t.iso3);
      const sharedActor = firstShared(sActors, t.actors);
      if (sharedIso3.length >= 2 && sharedActor) t2.push({ threadId: t.threadId, topic_id: t.id, evidence: { shared_iso3: sharedIso3, shared_actor: sharedActor } });
    }
    const c2 = pickUnambiguous(t2);
    if (c2) { pairs[st.storyId] = { ...c2, tier: 2, matched_at: now }; counts.tier2++; } else if (t2.length > 0) counts.ambiguous_r3++;
  }
  return { updated_at: now, generated_by: 'NewsProjectInvokeAgentLambda', r3_enabled: enableR3, counts, pairs };
}

module.exports = { buildStoryMap };
