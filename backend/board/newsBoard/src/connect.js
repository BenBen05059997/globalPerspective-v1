'use strict';

// connect {a, b}: the cheap, no-LLM test of whether two pins are linked (record.js cheapGrounds), with the data
// read from the world tables. Nothing is written (record/pairs/ caching comes with newsConnect).

const { cheapGrounds, normalizeActor, pairKey } = require('./_shared/record');
const { resolveIso3 } = require('./_shared/resolveIso3');
const world = require('./world');

const KINDS = ['thread', 'country', 'actor'];

/** A pin from the request -> { kind, refId, key } or an error string. key is what pairKey uses: threadId, ISO3,
 *  or the normalised actor name. */
function parsePin(pin, label) {
  if (!pin || typeof pin !== 'object' || !KINDS.includes(pin.kind) || typeof pin.refId !== 'string' || !pin.refId.trim()) {
    return { error: `${label} must be {kind: thread|country|actor, refId}` };
  }
  const refId = pin.refId.trim().replace(/\s+/g, ' ');
  if (pin.kind === 'country') {
    const c = resolveIso3(refId);
    if (!c) return { error: `${label}: ${refId} is not a country` };
    return { kind: 'country', refId: c.iso3, key: c.iso3, name: c.name };
  }
  if (pin.kind === 'actor') return { kind: 'actor', refId, key: normalizeActor(refId) };
  return { kind: 'thread', refId, key: refId };
}

async function connect(store, env, nowMs, rawA, rawB) {
  const a = parsePin(rawA, 'a');
  if (a.error) return { error: a.error };
  const b = parsePin(rawB, 'b');
  if (b.error) return { error: b.error };
  if (a.key === b.key) return { error: 'a and b must be two different pins' };

  const pins = [a, b];
  const threadIds = pins.filter((p) => p.kind === 'thread').map((p) => p.refId);
  const [index, topics] = await Promise.all([world.webIndex(store, env), world.latestTopics(store, env)]);
  const topicOf = new Map();
  for (const t of topics) if (t.threadId && !topicOf.has(t.threadId)) topicOf.set(t.threadId, t);
  const rows = await world.analyses(store, env, threadIds, nowMs);

  const data = new Map(); // pin.key -> { actors, places, outlets, scores }
  const limits = [];
  for (const p of pins) {
    if (p.kind === 'thread') {
      const an = rows.get(p.refId);
      const topic = topicOf.get(p.refId);
      const outlets = topic ? [...new Set((topic.sources || []).map((s) => s && s.source).filter(Boolean))] : [];
      if (!topic) limits.push(`outlets unavailable for thread ${p.refId} (not in the latest topic pool)`);
      if (!an) limits.push(`no analysis row for thread ${p.refId}`);
      data.set(p.key, {
        actors: world.threadActors(p.refId, an, topic, index),
        places: world.threadIso3(an, index.threads[p.refId], topic),
        outlets,
        scores: await world.threadHistory(store, env, p.refId),
      });
    } else if (p.kind === 'country') {
      data.set(p.key, { actors: [p.name], places: [p.refId], outlets: [], scores: await world.countryHistory(store, env, p.name) });
    } else {
      const asCountry = resolveIso3(p.refId);
      data.set(p.key, { actors: [p.refId], places: asCountry ? [asCountry.iso3] : [], outlets: [], scores: [] });
    }
  }

  const ctx = {
    actorsOf: (pin) => data.get(pin.key).actors,
    placesOf: (pin) => data.get(pin.key).places,
    outletsOf: (pin) => data.get(pin.key).outlets,
    scoresOf: (pin) => data.get(pin.key).scores,
  };
  const result = cheapGrounds(a, b, ctx);
  return { result: { pairKey: pairKey(a.key, b.key), a: { kind: a.kind, refId: a.refId }, b: { kind: b.kind, refId: b.refId }, ...result, limits } };
}

module.exports = { connect, parsePin };
