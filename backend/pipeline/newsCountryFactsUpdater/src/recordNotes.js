'use strict';

// Country facts notes (decisions 0042, 0053): each FACTS#<country> / COUNTRY_FACTS item just stored is also written to
// <NOTES_PREFIX>notes/country_facts/DAY.jsonl through shared notes.js. Gated by NOTES_PREFIX: unset writes nothing; the
// coordinator sets record/shadow/ and then record/. Best-effort while DynamoDB stays the primary copy: a failure logs [notes]
// and never fails the run. No model wrote the facts (Wikidata and ACLED), so the note's model is null.
const notes = require('./_shared/notes');
const { s3NoteWriter } = require('./_shared/s3NoteWriter');
const { resolveIso3 } = require('./_shared/resolveIso3');

const LAMBDA = 'newsCountryFactsUpdater';

/** `item` is the stored facts item (with or without PK/SK/ttl) of `countryName`. `prefix` (default env NOTES_PREFIX) and `writer` are injectable for tests. */
async function writeFactsNote({ countryName, item, runId, prefix = process.env.NOTES_PREFIX, writer }) {
  if (!prefix) return null;
  try {
    const resolved = resolveIso3(countryName);
    if (!resolved) { console.warn(`[notes] country_facts note skipped: no ISO3 for "${countryName}"`); return null; }
    const note = notes.countryFactsNote({ item, iso3: resolved.iso3, producer: { lambda: LAMBDA, runId } });
    if (!note) return null;
    const r = await (writer || s3NoteWriter(prefix)).write('country_facts', [note]);
    console.log(`[notes] country_facts: ${resolved.iso3} ${r.appended} appended, ${r.skipped} already stored (${prefix})`);
    return note;
  } catch (e) {
    console.error(`[notes] country_facts note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeFactsNote };
