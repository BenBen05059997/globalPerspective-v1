'use strict';

// In-memory store with the same interface and the same conditional-put semantics as store.js.
function fakeStore(preds = []) {
  const rows = new Map();
  const key = (PK, SK) => `${PK}\u0000${SK}`;
  const s = {
    rows,
    puts: [],
    async putOnce(item) {
      const k = key(item.PK, item.SK);
      if (rows.has(k)) return false;
      rows.set(k, JSON.parse(JSON.stringify(item)));
      s.puts.push(item.PK + ' ' + item.SK);
      return true;
    },
    async get(PK, SK) { return rows.get(key(PK, SK)) || null; },
    async listCommits() { return [...rows.values()].filter((r) => r.PK.startsWith('SEED#') && r.SK === 'COMMIT'); },
    async predRows(a, b) { return preds.filter((r) => r.SK >= a && r.SK <= b && r.questionSchema); },
    async allQuestionPreds() { return preds.filter((r) => r.questionSchema); },
    async listQuestionRows() { return [...rows.values()].filter((r) => r.PK.startsWith('Q#')); },
    async queryPK(PK) { return [...rows.values()].filter((r) => r.PK === PK); },
  };
  return s;
}

// A PRED row with N question triggers, all `lead` days out.
function predRow(topic, sk, n, { lead = 30, thread } = {}) {
  const addDays = (d, k) => new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);
  return {
    PK: `PRED#${topic}`, SK: sk, topicId: topic, title: `Story ${topic}`, generatedAt: `${sk}T05:00:00.000Z`,
    threadId: thread === undefined ? `thread-${topic}` : thread, questionSchema: 1,
    scenarios: [{
      label: 'Most Likely', probability: 0.6,
      triggers: Array.from({ length: n }, (_, i) => ({
        id: `0-${i}`, qid: `${topic}-${sk}-${i}`, text: `Event ${i} of ${topic} happens`, deadline: addDays(sk, lead + i),
        question: true, p: 55, resolutionSource: 'Reuters or AP wire report',
      })),
    }],
  };
}



// An injected record/facts reader: files = { 'YYYY-MM-DD': [fact, ...] }.
// runs = { 'YYYY-MM-DD': runObject|null|Error } for record/runs; omitted = every day has a healthy Run.
const okRun = (extra = {}) => ({ status: 'ok', inputs: { archiveDay: 'present', todayArchive: 'present' }, ...extra });
function fakeFacts(files = {}, runs) {
  return {
    async getJson(key) {
      const m = /record\/runs\/(\d{4}-\d{2}-\d{2})\.json$/.exec(key);
      const r = runs === undefined ? okRun() : runs[m && m[1]];
      if (r instanceof Error) throw r;
      return { obj: r || null, etag: null };
    },
    async getLines(key) { const m = /record\/facts\/(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(key); return { lines: (m && files[m[1]]) || [], etag: null }; },
  };
}
let evN = 0;
const entryFact = (threadId, date, extra = {}) => ({ kind: 'entry', threadId, date, eventId: `ev${threadId}${date}${++evN}`, at: `${date}T08:00:00.000Z`, payload: { title: `Update ${threadId}`, summary: `New development for ${threadId}` }, sources: [{ outlet: 'ex.com', url: `https://ex.com/${threadId}`, title: `Update ${threadId}` }], ...extra });

// The real s3json helper over an in-memory S3 client (offline). objects: Map(key -> text).
function fakeS3() {
  const { makeS3Json } = require('../src/_shared/s3json');
  const objects = new Map();
  class GetObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  const client = {
    async send(cmd) {
      const { Key, Body, IfNoneMatch, IfMatch } = cmd.input;
      if (cmd instanceof GetObjectCommand) {
        if (!objects.has(Key)) { const e = new Error('NoSuchKey'); e.name = 'NoSuchKey'; throw e; }
        return { Body: String(objects.get(Key)), ETag: `"${objects.get(Key).length}"` };
      }
      if (IfNoneMatch && objects.has(Key)) { const e = new Error('412'); e.name = 'PreconditionFailed'; throw e; }
      if (IfMatch && (!objects.has(Key) || `"${objects.get(Key).length}"` !== IfMatch)) { const e = new Error('412'); e.name = 'PreconditionFailed'; throw e; }
      objects.set(Key, Body);
      return {};
    },
  };
  const s3json = makeS3Json({ client, GetObjectCommand, PutObjectCommand, bucket: 'b' });
  const lines = (key) => (objects.get(key) || '').split('\n').filter(Boolean).map(JSON.parse);
  return { s3json, objects, lines };
}

module.exports = { okRun, fakeStore, predRow, fakeFacts, entryFact, fakeS3 };
