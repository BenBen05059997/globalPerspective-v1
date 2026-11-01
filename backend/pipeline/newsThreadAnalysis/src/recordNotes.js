'use strict';

// Story analysis notes (decision 0042): the THREAD_ANALYSIS item just stored is also written to
// <NOTES_PREFIX>notes/story_analysis/DAY.jsonl through shared notes.js; record/shadow/ until the switch is checked.
// Best-effort while DynamoDB stays the primary copy: a failure logs [notes] and never fails the run.
const notes = require('./_shared/notes');
const { s3NoteWriter } = require('./_shared/s3NoteWriter');

const NOTES_PREFIX = process.env.NOTES_PREFIX || 'record/shadow/';
const LAMBDA = 'newsThreadAnalysis';

/** `item` as stored, `entries` the thread's archive entries it was built from. `writer` is injectable for tests. */
async function writeStoryNote({ item, entries, runId, writer }) {
  try {
    const note = notes.storyAnalysisNote({ item, entries, producer: { lambda: LAMBDA, runId } });
    if (!note) return null;
    const r = await (writer || s3NoteWriter(NOTES_PREFIX)).write('story_analysis', [note]);
    console.log(`[notes] story_analysis: ${item.threadId} ${r.appended} appended, ${r.skipped} already stored (${NOTES_PREFIX})`);
    return note;
  } catch (e) {
    console.error(`[notes] story_analysis note not written: ${e.message}`);
    return null;
  }
}

module.exports = { writeStoryNote, NOTES_PREFIX };
