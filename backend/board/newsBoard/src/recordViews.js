'use strict';
// newsBoard's server-side reads of the record views (decision 0037 section 4): the active index for pin enrichment,
// the all index for a pinned story that is no longer active, and links/{id} for arrivals candidates. Nothing else.
const { makeS3Json } = require('./_shared/s3json');
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const VIEWS = 'record/views';
// An index file is {stories:[rows]} (the old index's container); a bare array is accepted too.
const rowsOf = (index) => (Array.isArray(index) ? index : Array.isArray(index?.stories) ? index.stories : null);
function makeRecordViews(options) {
  const { getJson } = makeS3Json(options);
  return {
    active: () => getJson(`${VIEWS}/index/active.json`),
    all: () => getJson(`${VIEWS}/index/all.json`),
    links: (id) => {
      if (!ID.test(id)) throw new Error('Invalid threadId');
      return getJson(`${VIEWS}/links/${id}.json`);
    },
  };
}
function liveRecordViews(env = process.env) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  return makeRecordViews({ client: new S3Client({region: env.AWS_REGION || 'ap-northeast-1'}), GetObjectCommand,
    bucket: env.WORLD_BUCKET || 'globalperspective-world-280362093938' });
}
// Pins get the index row: facts, plus the weekly reading's one-line `line` when the row has one (else null, the 0037 s6
// empty text). Chapters and confirmedLinks counts stay null: the index carries neither and pins add no per-story GETs. Risk is omitted.
async function enrichBoard(board, records) {
  const rows = rowsOf(await records.active());
  if (!rows) return { ...board, recordAvailable: false, pins: board.pins.map(pin => ({...pin, recordAvailable: false})) };
  const byId = new Map(rows.map(r => [r.threadId, r]));
  let allRows = null;
  const needAll = board.pins.some(p => p.kind === 'thread' && !byId.has(p.refId));
  if (needAll) for (const r of rowsOf(await records.all()) || []) if (!byId.has(r.threadId)) byId.set(r.threadId, r);
  const rowOf = (id) => { // a merged story shows its survivor's row
    let row = byId.get(id);
    for (let hop = 0; row?.aliasOf && hop < 5; hop++) row = byId.get(row.aliasOf);
    return row && !row.aliasOf ? row : null;
  };
  return { ...board, recordAvailable: true, pins: board.pins.map(pin => {
    const row = pin.kind === 'thread' ? rowOf(pin.refId) : null;
    return row ? {...pin, recordAvailable: true, line: typeof row.line==='string'&&row.line?row.line:null, born: row.born, entryCount: row.entryCount,
      counts: {chapters: null, liveBranches: row.liveBranchCount, confirmedLinks: null}, lastMoved: row.lastFactAt}
      : {...pin, recordAvailable: false};
  }) };
}
module.exports = {makeRecordViews, liveRecordViews, enrichBoard, rowsOf};
