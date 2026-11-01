'use strict';

// Drift notes (decision 0042): each country DRIFT# item just stored (not the DRIFTLOG# copy) is also written to
// <NOTES_PREFIX>notes/drift/DAY.jsonl through shared notes.js; record/shadow/ until the switch is checked.
// Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');
const { s3NoteWriter } = require('./_shared/s3NoteWriter');
const { resolveIso3 } = require('./_shared/resolveIso3');

const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsDriftCorrector';

/** `item` is the stored drift fields (before PK/SK/ttl) of a country named by `country`. `writer` is injectable for tests. */
async function writeDriftNote({ country, item, model, runId, writer }) {
  try {
    const resolved = resolveIso3(country);
    if (!resolved) { console.warn(`[notes] drift note skipped: no ISO3 for "${country}"`); return null; }
    const note = notes.driftNote({ item, iso3: resolved.iso3, model, producer: { lambda: LAMBDA, runId } });
    const r = await (writer || s3NoteWriter(NOTES_PREFIX)).write('drift', [note]);
    console.log(`[notes] drift: ${resolved.iso3} ${item.asOf} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] drift note not written: ${e.message}`);
    return null;
  }
}

/** `item` is the stored story drift fields (before PK/SK/ttl) of the story `threadId`: the same drift file, subject kind story. */
async function writeStoryDriftNote({ threadId, item, model, runId, writer }) {
  try {
    const note = notes.storyDriftNote({ item, threadId, model, producer: { lambda: LAMBDA, runId } });
    const r = await (writer || s3NoteWriter(NOTES_PREFIX)).write('drift', [note]);
    console.log(`[notes] drift: story ${threadId} ${item.asOf} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] story drift note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeDriftNote, writeStoryDriftNote, NOTES_PREFIX };
