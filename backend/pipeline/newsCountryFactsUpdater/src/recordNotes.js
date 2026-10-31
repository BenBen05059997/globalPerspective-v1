'use strict';

// Country facts notes (decisions 0042, 0053): each FACTS#<country> / COUNTRY_FACTS item just stored is also written to
// <NOTES_PREFIX>notes/country_facts/DAY.jsonl through shared notes.js. Gated by NOTES_PREFIX: unset writes nothing; the
// coordinator sets record/shadow/ and then record/. Best-effort while DynamoDB stays the primary copy: a failure logs [notes]
// and never fails the run. No model wrote the facts (Wikidata and ACLED), so the note's model is null.
const notes = require('./_shared/notes');
const { resolveIso3 } = require('./_shared/resolveIso3');

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const LAMBDA = 'newsCountryFactsUpdater';

function s3Writer(prefix) {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return notes.makeNoteWriter({ s3json: makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix });
}

/** `item` is the stored facts item (with or without PK/SK/ttl) of `countryName`. `prefix` (default env NOTES_PREFIX) and `writer` are injectable for tests. */
async function writeFactsNote({ countryName, item, runId, prefix = process.env.NOTES_PREFIX, writer }) {
  if (!prefix) return null;
  try {
    const resolved = resolveIso3(countryName);
    if (!resolved) { console.warn(`[notes] country_facts note skipped: no ISO3 for "${countryName}"`); return null; }
    const note = notes.countryFactsNote({ item, iso3: resolved.iso3, producer: { lambda: LAMBDA, runId } });
    if (!note) return null;
    const r = await (writer || s3Writer(prefix)).write('country_facts', [note]);
    console.log(`[notes] country_facts: ${resolved.iso3} ${r.appended} appended, ${r.skipped} already stored (${prefix})`);
    return note;
  } catch (e) {
    console.error(`[notes] country_facts note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeFactsNote };
