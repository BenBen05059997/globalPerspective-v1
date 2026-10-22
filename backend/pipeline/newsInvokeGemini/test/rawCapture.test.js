'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FakeS3, runHandler } = require('./fakes');
const { captureRawArticles, rawLine, groupByDay } = require('../src/rawCapture');
const { makeS3Json } = require('../src/_shared/s3json');
const { canonicalUrl, sha1 } = require('../src/_shared/record');

const quiet = { log() {}, warn() {} };
const art = (o = {}) => ({ title: 'Quake kills 40', url: 'https://www.bbc.co.uk/news/articles/a?at_medium=RSS&utm_source=x', description: 'Rescue.', source: 'bbc.com', feed: 'BBC World', publishedAt: '2026-10-22T08:00:00.000Z', lang: 'en-gb', ...o });
const s3jsonOver = (s3) => makeS3Json({ ...s3.makeClient(), bucket: 'b' });

test('rawLine: shape, rawId = sha1(canonical url), outlet from the table, nulls for missing fields', () => {
  const l = rawLine(art(), '2026-10-22T12:00:00.000Z');
  assert.deepEqual(Object.keys(l), ['schemaVersion', 'rawId', 'url', 'canonicalUrl', 'title', 'outlet', 'feed', 'publishedAt', 'fetchedAt', 'snippet', 'lang']);
  assert.equal(l.schemaVersion, 1);
  assert.equal(l.canonicalUrl, canonicalUrl(l.url));
  assert.equal(l.rawId, sha1(l.canonicalUrl));
  assert.equal(l.feed, 'BBC World');
  const bare = rawLine({ title: 'T', url: 'https://x.example/1', source: 'x.example' }, '2026-10-22T12:00:00.000Z');
  assert.equal(bare.publishedAt, null); assert.equal(bare.snippet, null); assert.equal(bare.lang, null); assert.equal(bare.outlet, null);
  assert.equal(rawLine({ title: 'no url' }, 'x'), null);
});

test('groupByDay: publishedAt day (UTC), else the fetch day', () => {
  const f = '2026-10-22T12:00:00.000Z';
  const days = groupByDay([rawLine(art({ publishedAt: '2026-10-21T23:30:00.000Z' }), f), rawLine(art({ url: 'https://x.example/2', publishedAt: null }), f)]);
  assert.deepEqual([...days.keys()].sort(), ['2026-10-21', '2026-10-22']);
});

test('captureRawArticles: one file per day, a second run adds only new rawIds', async () => {
  const s3 = new FakeS3();
  const s3json = s3jsonOver(s3);
  const now = new Date('2026-10-22T12:00:00Z');
  const first = await captureRawArticles({ articles: [art(), art({ url: 'https://x.example/2', publishedAt: '2026-10-21T10:00:00Z' })], s3json, now, log: quiet });
  assert.deepEqual([first.ok, first.lines, first.days, first.appended], [true, 2, 2, 2]);
  assert.deepEqual(s3.keys(), ['record/inbox/articles/2026-10-21.jsonl', 'record/inbox/articles/2026-10-22.jsonl']);
  const again = await captureRawArticles({ articles: [art(), art({ url: 'https://x.example/3' })], s3json, now: new Date('2026-10-22T20:00:00Z'), log: quiet });
  assert.equal(again.appended, 1);
  assert.equal(s3.lines('record/inbox/articles/2026-10-22.jsonl').length, 2);
  assert.equal(s3.lines('record/inbox/articles/2026-10-22.jsonl')[0].fetchedAt, '2026-10-22T12:00:00.000Z', 'the stored line is kept');
});

test('captureRawArticles: shadow writes under record/shadow/inbox/articles/', async () => {
  const s3 = new FakeS3();
  await captureRawArticles({ articles: [art()], s3json: s3jsonOver(s3), shadow: true, now: new Date('2026-10-22T12:00:00Z'), log: quiet });
  assert.deepEqual(s3.keys(), ['record/shadow/inbox/articles/2026-10-22.jsonl']);
});

test('captureRawArticles: a failing write is reported, not thrown', async () => {
  const s3 = new FakeS3();
  s3.failPuts = true;
  const warns = [];
  const r = await captureRawArticles({ articles: [art()], s3json: s3jsonOver(s3), log: { log() {}, warn: (m) => warns.push(m) } });
  assert.equal(r.ok, false);
  assert.match(warns[0], /failed \(non-fatal/);
});

test('captureRawArticles: no articles is a no-op', async () => {
  const r = await captureRawArticles({ articles: [], s3json: { appendLines: () => { throw new Error('must not be called'); } }, log: quiet });
  assert.equal(r.ok, true);
});

// ---- the whole handler -------------------------------------------------------------------------------------

test('handler: raw lines are written before the model call', async () => {
  const { events, s3, result } = await runHandler();
  const firstPut = events.findIndex((e) => e.startsWith('s3 put record/inbox/articles/'));
  assert.ok(firstPut >= 0 && firstPut < events.indexOf('model'), `order: ${events.join(' | ')}`);
  assert.equal(result.status, 'ok');
  const all = s3.keys().filter((k) => k.startsWith('record/inbox/articles/')).flatMap((k) => s3.lines(k));
  assert.ok(all.length > 60, `${all.length} lines`);
  assert.ok(all.every((l) => l.schemaVersion === 1 && l.rawId && l.feed && l.fetchedAt === '2026-10-22T12:00:00.000Z'));
  assert.equal(new Set(all.map((l) => l.rawId)).size, all.length);
  assert.ok(all.some((l) => l.feed === 'Dawn') && all.some((l) => l.feed === 'DW English') && all.some((l) => l.feed === 'Nikkei Asia'));
  assert.ok(all.filter((l) => l.snippet).length > all.length * 0.9, 'feeds give a description; snippets are filled');
});

test('handler: a model outage still leaves the raw day', async () => {
  const s3 = new FakeS3();
  await assert.rejects(runHandler({ s3, modelError: 'model down' }), /model down/);
  assert.ok(s3.keys().some((k) => k.startsWith('record/inbox/articles/')));
});

test('handler: a failing capture write does not block the run', async () => {
  const s3 = new FakeS3();
  s3.failPuts = true;
  const { result, events } = await runHandler({ s3 });
  assert.equal(result.status, 'ok');
  assert.ok(events.includes('model'));
});

test('handler: RAW_CAPTURE_SHADOW=1 writes the shadow prefix only', async () => {
  const { s3 } = await runHandler({ env: { RAW_CAPTURE_SHADOW: '1' } });
  assert.ok(s3.keys().some((k) => k.startsWith('record/shadow/inbox/articles/')));
  assert.ok(!s3.keys().some((k) => k.startsWith('record/inbox/articles/')));
});

// ---- W3 in the handler ----------------------------------------------------------------------------------------

test('handler (W3): a topic repeating an entry of yesterday is dropped; one with a new number stays', async () => {
  const topics = (urls) => [
    { title: 'Flood emergency in Bangkok', category: 'disaster', sources: [{ url: urls[0] }] },
    { title: 'Boat capsizes off Djibouti killing 139', category: 'disaster', sources: [{ url: urls[1] }] },
    { title: 'Totally fresh event in Chile', category: 'society', sources: [{ url: urls[2] }] },
  ];
  const { result, written } = await runHandler({
    topics,
    archive: { '2026-10-21': ['Flood emergency in Bangkok', 'Boat capsizes off Djibouti killing 109'], '2026-10-15': ['Totally fresh event in Chile'] },
  });
  assert.equal(result.count, 2);
  const titles = written.find((i) => i.id === 'staging').topics.map((t) => t.title);
  assert.deepEqual(titles, ['Boat capsizes off Djibouti killing 139', 'Totally fresh event in Chile']);
});

test('W7: 25 items per feed are fetched and captured; the model sees the newest 8 per feed', async () => {
  const feedXml = (feed) => {
    const items = Array.from({ length: 25 }, (_, i) => `<item><title>${feed.name.replace(/\W/g, '')}${i}a ${feed.name.replace(/\W/g, '')}${i}b ${feed.name.replace(/\W/g, '')}${i}c ${feed.name.replace(/\W/g, '')}${i}d</title><link>https://${feed.source}/a/${i}</link><pubDate>Thu, 22 Oct 2026 ${String(10 - Math.floor(i / 3)).padStart(2, '0')}:${String(59 - i).padStart(2, '0')}:00 +0000</pubDate></item>`);
    return `<rss><channel>${items.join('')}</channel></rss>`;
  };
  const { prompts, s3 } = await runHandler({ feedXml });
  const captured = s3.keys().filter((k) => k.startsWith('record/inbox/articles/')).flatMap((k) => s3.lines(k));
  assert.equal(captured.length, 26 * 25);
  const rows = [...prompts[0].matchAll(/URL: https:\/\/(\S+?)\/a\/(\d+)/g)];
  assert.equal(rows.length, 26 * 8);
  assert.ok(rows.every((m) => Number(m[2]) < 8), 'the newest 8 of each feed (items 0-7 are the newest here)');
});
