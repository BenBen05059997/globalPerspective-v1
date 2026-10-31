'use strict';

// Link notes (decision 0042): every story-to-story edge of the country webs written in this run is also written to
// <NOTES_PREFIX>notes/link/DAY.jsonl through shared notes.js, one note per edge and country web; record/shadow/ until the
// switch is checked. Each web is also one `web` note about its country (its nodes, with or without an edge, and the deterministic
// shared-actor `backbone`, no model): a web with no edge has no link note, and the story page reads coverage and shared actors
// from it. The node summaries stay in SYSTEMS#. Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');
const { resolveIso3 } = require('./_shared/resolveIso3');

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsSystemsAnalysis';

function s3Writer() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return notes.makeNoteWriter({ s3json: makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix: NOTES_PREFIX });
}

const CONF_RANK = { strong: 3, medium: 2, weak: 1 };

/**
 * A web can hold both directions of one pair (a -> b and b -> a). A note is keyed by pair, country and time, so only one can be
 * stored: keep the stronger confidence (the first on a tie). The dropped edge stays in SYSTEMS#; `dropped` lists it.
 */
function oneEdgePerPair(edges, dropped = []) {
  const best = new Map();
  const bad = []; // self-loops and edges without ends go on to the builder, which refuses them and reports
  for (const e of edges || []) {
    if (!e || !e.from || !e.to || e.from === e.to) { bad.push(e); continue; }
    const k = [e.from, e.to].sort().join('__');
    const prev = best.get(k);
    if (!prev) best.set(k, e);
    else if ((CONF_RANK[e.confidence] || 0) > (CONF_RANK[prev.confidence] || 0)) { dropped.push(prev); best.set(k, e); } else dropped.push(e);
  }
  return [...best.values(), ...bad];
}

/**
 * Pure: country webs {countryName, edges, generatedAt} written in this run + the archive entries (topicId, date, title, sources)
 * -> {notes, skipped}. A web whose country has no ISO3, or an edge the builder refuses, is skipped (reported, never thrown).
 */
function planLinkNotes({ rows, entries, model, runId, lambda = LAMBDA }) {
  const eventIds = notes.entryEventIdIndex(entries);
  const out = [];
  const skipped = [];
  for (const row of rows || []) {
    const resolved = resolveIso3(row.countryName);
    if (!resolved) { skipped.push({ country: row.countryName, reason: 'no_iso3' }); continue; }
    const dropped = [];
    const edges = oneEdgePerPair(row.edges, dropped);
    for (const e of dropped) skipped.push({ country: row.countryName, from: e.from, to: e.to, reason: 'pair_both_ways' });
    for (const edge of edges) {
      try {
        const note = notes.linkNote({ edge, countryName: row.countryName, iso3: resolved.iso3, at: row.generatedAt, model: row.model === undefined ? model : row.model, eventIds, producer: { lambda, runId } });
        if (note) out.push(note); else skipped.push({ country: row.countryName, from: edge && edge.from, to: edge && edge.to, reason: 'no_pair' });
      } catch (e) {
        skipped.push({ country: row.countryName, from: edge && edge.from, to: edge && edge.to, reason: e.message });
      }
    }
  }
  return { notes: out, skipped };
}

/** Pure: the webs of a run -> one web note each (a web whose country has no ISO3, or that the builder refuses, is skipped and reported). */
function planWebNotes({ rows, model, runId, lambda = LAMBDA }) {
  const out = [];
  const skipped = [];
  for (const row of rows || []) {
    const resolved = resolveIso3(row.countryName);
    if (!resolved) { skipped.push({ country: row.countryName, reason: 'no_iso3' }); continue; }
    try {
      const note = notes.webNote({ row, iso3: resolved.iso3, at: row.generatedAt, model: row.model === undefined ? model : row.model, producer: { lambda, runId } });
      if (note) out.push(note); else skipped.push({ country: row.countryName, reason: 'no_web' });
    } catch (e) {
      skipped.push({ country: row.countryName, reason: e.message });
    }
  }
  return { notes: out, skipped };
}

/** `rows` are the webs just written (a run's countries), `entries` the archive entries the run read. `writer` is injectable for tests. */
async function writeLinkNotes({ rows, entries, model, runId, writer }) {
  try {
    const plan = planLinkNotes({ rows, entries, model, runId });
    for (const s of plan.skipped) console.warn(`[notes] link skipped: ${JSON.stringify(s)}`);
    const webs = planWebNotes({ rows, model, runId });
    for (const s of webs.skipped) console.warn(`[notes] web skipped: ${JSON.stringify(s)}`);
    const w = writer || s3Writer();
    // the web notes go first: a reader that finds a web's links can then find the web
    if (webs.notes.length) {
      const r = await w.write('web', webs.notes);
      console.log(`[notes] web: ${webs.notes.length} webs, ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    }
    if (!plan.notes.length) return plan.notes;
    const r = await w.write('link', plan.notes);
    console.log(`[notes] link: ${plan.notes.length} links, ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return plan.notes;
  } catch (e) {
    console.error(`[notes] link notes not written: ${e.message}`);
    return [];
  }
}

module.exports = { writeLinkNotes, planLinkNotes, planWebNotes, NOTES_PREFIX };
