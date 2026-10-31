'use strict';

// Country notes (decision 0042): each COUNTRY_INTELLIGENCE item just stored is also written to
// <NOTES_PREFIX>notes/country/DAY.jsonl through shared notes.js; record/shadow/ until the switch is checked.
// The HISTORY#<date> row stored beside it is a subset of the same item (same generatedAt), so it is not a second note.
// Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');
const { resolveIso3 } = require('./_shared/resolveIso3');

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsCountryIntelligence';

function s3Writer() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return notes.makeNoteWriter({ s3json: makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix: NOTES_PREFIX });
}

/** `item` is the stored COUNTRY_INTELLIGENCE item (with or without PK/SK/ttl) of the country `countryName`. `writer` is injectable for tests. */
async function writeCountryNote({ countryName, item, runId, writer }) {
  try {
    const resolved = resolveIso3(countryName);
    if (!resolved) { console.warn(`[notes] country note skipped: no ISO3 for "${countryName}"`); return null; }
    const note = notes.countryNote({ item, iso3: resolved.iso3, producer: { lambda: LAMBDA, runId } });
    if (!note) return null;
    const r = await (writer || s3Writer()).write('country', [note]);
    console.log(`[notes] country: ${resolved.iso3} ${item.generatedAt} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] country note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeCountryNote, NOTES_PREFIX };
