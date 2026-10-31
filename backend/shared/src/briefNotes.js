'use strict';

// Brief notes (decisions 0042, 0048): the DAILY_BRIEF# / WEEKLY_BRIEF# row just stored is also written to
// <NOTES_PREFIX>notes/daily_brief|weekly_brief/DAY.jsonl through notes.js. Gated by NOTES_PREFIX: unset writes nothing; the
// coordinator sets record/shadow/ and then record/. Best-effort while DynamoDB stays the primary copy: a failure logs [notes]
// and never fails the run. One helper for both writers (newsPostDevTo, newsWeeklyBrief): they differ only in subtype and builder.
const notes = require('./notes');

const BUILDERS = {daily_brief: notes.dailyBriefNote, weekly_brief: notes.weeklyBriefNote};

function s3Writer(prefix) {
  const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
  const {makeS3Json} = require('./s3json');
  const client = new S3Client({region: process.env.AWS_REGION || 'ap-northeast-1'});
  const bucket = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
  return notes.makeNoteWriter({s3json: makeS3Json({client, GetObjectCommand, PutObjectCommand, bucket}), prefix});
}

/**
 * `subtype` daily_brief | weekly_brief, `item` the stored row, `lambda` the writer's name. `prefix` (default env NOTES_PREFIX) and
 * `writer` are injectable for tests. -> the note, or null when there is none to write (no prefix, an unusable row, a failure).
 */
async function writeBriefNote({subtype, item, lambda, runId, prefix = process.env.NOTES_PREFIX, writer}) {
  if (!prefix) return null;
  try {
    const note = BUILDERS[subtype]({item, producer: {lambda, runId}});
    if (!note) return null;
    const r = await (writer || s3Writer(prefix)).write(subtype, [note]);
    console.log(`[notes] ${subtype}: ${note.subject.id} ${r.appended} appended, ${r.skipped} already stored (${prefix})`);
    return note;
  } catch (e) {
    console.error(`[notes] ${subtype} note not written: ${e.message}`);
    return null;
  }
}

module.exports = {writeBriefNote};
