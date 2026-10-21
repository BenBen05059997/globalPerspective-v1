'use strict';
const { makeS3Json } = require('./_shared/s3json');
function makeRecordViews(options) {
  const { getJson } = makeS3Json(options);
  return { index: () => getJson('record/index.json'), story: (id) => {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('Invalid threadId');
    return getJson(`record/stories/${id}/latest.json`);
  }};
}
function liveRecordViews(env = process.env) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  return makeRecordViews({ client: new S3Client({region: env.AWS_REGION || 'ap-northeast-1'}), GetObjectCommand,
    bucket: env.WORLD_BUCKET || 'globalperspective-world-280362093938' });
}
async function enrichBoard(board, records) {
  const index = await records.index();
  const rows = new Map((index?.stories || []).map(r => [r.id,r]));
  return { ...board, recordAvailable: !!index, pins: board.pins.map(pin => {
    const row = pin.kind === 'thread' ? rows.get(pin.refId) : null;
    return row ? {...pin, recordAvailable: true, line: row.line, risk: row.risk, born: row.born,
      counts: {chapters: row.chapters, liveBranches: row.liveBranches, confirmedLinks: row.confirmedLinks}, lastMoved: row.lastMoved}
      : {...pin, recordAvailable: false};
  }) };
}
module.exports = {makeRecordViews, liveRecordViews, enrichBoard};
