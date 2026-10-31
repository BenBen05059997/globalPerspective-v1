'use strict';

// Drift notes (decision 0042): each country DRIFT# item just stored (not the DRIFTLOG# copy) is also written to
// <NOTES_PREFIX>notes/drift/DAY.jsonl through shared notes.js; record/shadow/ until the switch is checked.
// Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');
const { resolveIso3 } = require('./_shared/resolveIso3');

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsDriftCorrector';

function s3Writer() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return notes.makeNoteWriter({ s3json: makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix: NOTES_PREFIX });
}

/** `item` is the stored drift fields (before PK/SK/ttl) of a country named by `country`. `writer` is injectable for tests. */
async function writeDriftNote({ country, item, model, runId, writer }) {
  try {
    const resolved = resolveIso3(country);
    if (!resolved) { console.warn(`[notes] drift note skipped: no ISO3 for "${country}"`); return null; }
    const note = notes.driftNote({ item, iso3: resolved.iso3, model, producer: { lambda: LAMBDA, runId } });
    const r = await (writer || s3Writer()).write('drift', [note]);
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
    const r = await (writer || s3Writer()).write('drift', [note]);
    console.log(`[notes] drift: story ${threadId} ${item.asOf} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] story drift note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeDriftNote, writeStoryDriftNote, NOTES_PREFIX };
