'use strict';

// Story analysis notes (decision 0042): the THREAD_ANALYSIS item just stored is also written to
// <NOTES_PREFIX>notes/story_analysis/DAY.jsonl through shared notes.js; record/shadow/ until the switch is checked.
// Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');

const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsThreadAnalysis';

function s3Writer() {
  const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { makeS3Json } = require('./_shared/s3json');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  return notes.makeNoteWriter({ s3json: makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: WORLD_BUCKET }), prefix: NOTES_PREFIX });
}

/** `item` as stored, `entries` the thread's archive entries it was built from. `writer` is injectable for tests. */
async function writeStoryNote({ item, entries, runId, writer }) {
  try {
    const note = notes.storyAnalysisNote({ item, entries, producer: { lambda: LAMBDA, runId } });
    if (!note) return null;
    const r = await (writer || s3Writer()).write('story_analysis', [note]);
    console.log(`[notes] story_analysis: ${item.threadId} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] story_analysis note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeStoryNote, NOTES_PREFIX };
