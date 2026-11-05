'use strict';
// node --test ../test/*.test.js  (offline: the fetcher and S3 are fakes; no network, no AWS)
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { recoverDay, refuse } = require('../src/index');
const R = require('../src/recover');

const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = iso(NOW - 86400000);             // yesterday, a closed UTC day
const D8 = DAY.replace(/-/g, '');
const quiet = { log() {}, warn() {} };

function zipOf(name, text) {
  const raw = Buffer.from(text, 'utf8');
  const data = zlib.deflateRawSync(raw);
  const n = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(0, 42);
  const local = Buffer.concat([lh, n, data]);
  const cdFull = Buffer.concat([cd, n]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cdFull.length, 12); eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, cdFull, eocd]);
}
const gkgRow = (date, host, url, title) => { const f = new Array(27).fill(''); f[0] = `${date}-0`; f[1] = date; f[3] = host; f[4] = url; f[26] = `<PAGE_TITLE>${title}</PAGE_TITLE>`; return f.join('\t'); };
const GKG = [
  gkgRow(`${D8}061500`, 'bbc.co.uk', 'https://www.bbc.co.uk/news/articles/c1', 'Floods hit the north'),
  gkgRow(`${D8}071500`, 'scmp.com', 'https://www.scmp.com/news/a2', 'Port reopens'),
  gkgRow(`${D8}071500`, 'example.org', 'https://example.org/x', 'Not one of our outlets'),
].join('\n');

/** The s3json surface the handler uses, over a Map. appendLines skips an idKey already stored. */
function fakeS3() {
  const files = new Map(); const writes = [];
  return {
    files, writes,
    async getLines(key) { return { lines: files.get(key) || [], etag: null }; },
    async appendLines(key, lines, { idKey }) {
      const cur = files.get(key) || []; const have = new Set(cur.map((l) => l[idKey]));
      const add = lines.filter((l) => !have.has(l[idKey]));
      files.set(key, [...cur, ...add]); writes.push(key);
      return { appended: add.length, skipped: lines.length - add.length };
    },
    async putLatest(key, obj) { files.set(key, obj); writes.push(key); },
  };
}
const gkgFetch = (text = GKG) => async (url) => {
  assert.ok(url.includes('data.gdeltproject.org'), `unexpected fetch ${url}`);
  return zipOf('x.gkg.csv', url.includes(`${D8}000000`) ? text : '');
};
const feeds = () => R.readFeeds();
const ARTICLES = `record/inbox/articles/${DAY}.jsonl`;
const RESULT = `monitoring/heal/recover/${DAY}.json`;

test('a closed day is rebuilt from GDELT GKG: only fetched rows, each marked recovered, result file written', async () => {
  const s3 = fakeS3();
  const r = await recoverDay({ day: DAY, noWayback: true }, { s3, fetchText: gkgFetch(), feeds: feeds(), now: NOW, log: quiet });
  assert.equal(r.status, 'ok');
  assert.equal(r.gkg.status, 'ok');
  assert.equal(r.counts.appended, 2);              // the example.org row is not one of our outlets
  assert.equal(r.counts.inboxLines, 2);
  const lines = s3.files.get(ARTICLES);
  assert.deepEqual(lines.map((l) => l.title).sort(), ['Floods hit the north', 'Port reopens']);
  assert.ok(lines.every((l) => l.recoveredFrom === 'gdelt-gkg' && l.recoveredAt && l.rawId));
  assert.deepEqual(s3.files.get(RESULT).counts.appended, 2);
  assert.deepEqual(s3.writes.sort(), [ARTICLES, RESULT].sort());
});

test('a second run adds nothing (rawId already stored) and says so', async () => {
  const s3 = fakeS3();
  const deps = { s3, fetchText: gkgFetch(), feeds: feeds(), now: NOW, log: quiet };
  await recoverDay({ day: DAY, noWayback: true }, deps);
  const again = await recoverDay({ day: DAY, noWayback: true }, deps);
  assert.equal(again.counts.appended, 0);
  assert.equal(again.counts.found, 0);             // dedupe against the stored day file
  assert.equal(again.counts.inboxLines, 2);
  assert.equal(s3.files.get(ARTICLES).length, 2);
});

test('GDELT unreachable: status failed, nothing written to the inbox, the failure is in the result', async () => {
  const s3 = fakeS3();
  const fetchText = async () => { throw Object.assign(new Error('HTTP 503'), { status: 503 }); };
  const r = await recoverDay({ day: DAY, noWayback: true }, { s3, fetchText, feeds: feeds(), now: NOW, log: quiet });
  assert.equal(r.status, 'failed');
  assert.equal(r.gkg.status, 'failed');
  assert.equal(r.counts.inboxLines, 0);
  assert.ok(r.failureCount > 0 && r.failures[0].error);
  assert.equal(s3.files.has(ARTICLES), false);
  assert.equal(s3.files.get(RESULT).status, 'failed');
});

test('some quarters missing: partial, and what was read is kept', async () => {
  const s3 = fakeS3();
  const fetchText = async (url) => {
    if (url.includes(`${D8}001500`)) throw Object.assign(new Error('HTTP 404'), { final: true, status: 404 });
    return gkgFetch()(url);
  };
  const r = await recoverDay({ day: DAY, noWayback: true }, { s3, fetchText, feeds: feeds(), now: NOW, log: quiet });
  assert.equal(r.status, 'partial');
  assert.equal(r.gkg.filesMissing, 1);
  assert.equal(r.counts.appended, 2);
});

test('dryRun fetches and reports but writes nothing', async () => {
  const s3 = fakeS3();
  const r = await recoverDay({ day: DAY, noWayback: true, dryRun: true }, { s3, fetchText: gkgFetch(), feeds: feeds(), now: NOW, log: quiet });
  assert.equal(r.counts.found, 2);
  assert.equal(r.counts.appended, 0);
  assert.equal(s3.writes.length, 0);
});

test('Wayback past its time budget is skipped feed by feed and listed, not guessed', async () => {
  const s3 = fakeS3();
  const fetchText = async (url) => {
    assert.ok(url.includes('data.gdeltproject.org'), 'no Wayback request once the budget is gone');
    return gkgFetch()(url);
  };
  const r = await recoverDay({ day: DAY }, { s3, fetchText, feeds: feeds(), now: NOW - 10000, budgetMs: 0, log: quiet });
  assert.equal(r.status, 'ok');
  assert.ok(r.failureCount >= feeds().length);
  assert.match(r.failures[0].error, /time budget/);
});

test('refuses an open day, an old day and a bad day without touching anything', async () => {
  assert.match(refuse(iso(NOW), NOW), /not closed/);
  assert.match(refuse(iso(NOW + 86400000), NOW), /not closed/);
  assert.match(refuse(iso(NOW - 40 * 86400000), NOW), /older than/);
  assert.match(refuse('2026-13-40', NOW), /YYYY-MM-DD/);
  assert.match(refuse(undefined, NOW), /YYYY-MM-DD/);
  assert.equal(refuse(DAY, NOW), null);
  const s3 = fakeS3();
  const r = await recoverDay({ day: iso(NOW) }, { s3, fetchText: async () => { throw new Error('must not fetch'); }, feeds: feeds(), now: NOW, log: quiet });
  assert.equal(r.status, 'refused');
  assert.equal(s3.writes.length, 0);
});
