// node --test backend/record/cli/recover.test.mjs   (no network, no AWS)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  readFeeds, gdeltTargets, gdeltUrl, parseGdeltDoc, gdeltLine, seendateIso, cdxUrl, snapshotUrl, parseCdx, waybackLines,
  dedupeLines, tally, dayRange, splitWindow,
} from './recover-lib.mjs';
import { recoverGdelt, recoverWayback, makeFetcher, main, gdeltSummary } from './recover-day.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fx = (n) => fs.readFileSync(path.join(HERE, 'fixtures', n), 'utf8');
const { canonicalUrl, sha1 } = createRequire(import.meta.url)('../../shared/src/record.js');
const NOW = '2026-10-23T00:00:00.000Z';
const quiet = { log() {}, warn() {} };

test('feed list is read from the selector: 26 feeds, 26 domains', () => {
  const feeds = readFeeds();
  assert.equal(feeds.length, 26);
  assert.equal(gdeltTargets(feeds).length, 26);
  assert.deepEqual(gdeltTargets(feeds).find((t) => t.domain === 'bbc.com').domains, ['bbc.com', 'bbc.co.uk']);
});

test('GDELT URL: parameter names per the DOC 2.0 API', () => {
  const u = new URL(gdeltUrl(['bbc.com'], '2026-09-20'));
  assert.equal(u.searchParams.get('query'), 'domainis:bbc.com sourcelang:english');
  assert.equal(u.searchParams.get('mode'), 'artlist');
  assert.equal(u.searchParams.get('format'), 'json');
  assert.equal(u.searchParams.get('maxrecords'), '250');
  assert.equal(u.searchParams.get('startdatetime'), '20260920000000');
  assert.equal(u.searchParams.get('enddatetime'), '20260920235959');
  assert.equal(new URL(gdeltUrl(['bbc.com', 'bbc.co.uk'], '2026-09-20', { englishOnly: false })).searchParams.get('query'), '(domainis:bbc.com OR domainis:bbc.co.uk)');
});

test('GDELT DOC JSON fixture -> inbox lines', () => {
  const arts = parseGdeltDoc(fx('gdelt-doc.json'));
  assert.equal(arts.length, 4);
  const lines = arts.map((a) => gdeltLine(a, NOW));
  assert.equal(lines[3], null); // no title
  const l = lines[0];
  assert.deepEqual(Object.keys(l).sort(), ['canonicalUrl', 'feed', 'fetchedAt', 'lang', 'outlet', 'precision', 'publishedAt', 'rawId', 'recoveredAt', 'recoveredFrom', 'schemaVersion', 'snippet', 'title', 'url'].sort());
  assert.equal(l.schemaVersion, 1);
  assert.equal(l.canonicalUrl, 'https://bbc.com/news/articles/c1'); // utm_ dropped
  assert.equal(l.rawId, sha1(canonicalUrl(l.url)));
  assert.equal(l.title, 'Floods hit northern region');
  assert.equal(l.outlet, 'BBC');
  assert.equal(l.feed, 'gdelt-doc');
  assert.equal(l.publishedAt, '2026-09-20T06:30:00.000Z');
  assert.equal(l.snippet, null);
  assert.equal(l.lang, 'en');
  assert.equal(l.recoveredFrom, 'gdelt-doc');
  assert.equal(l.recoveredAt, NOW);
  assert.equal(lines[1].outlet, 'Nikkei Asia');
  assert.equal(lines[2].outlet, 'BBC'); // bbc.co.uk
});

test('GDELT: empty window and rate-limit text', () => {
  assert.deepEqual(parseGdeltDoc('{}'), []);
  assert.throws(() => parseGdeltDoc(''), /empty body/);
  assert.throws(() => parseGdeltDoc('Please limit requests to one every 5 seconds'), /non-JSON/);
  assert.equal(seendateIso('garbage'), null);
});

test('CDX parsing: header row dropped, identical digests collapsed', () => {
  const snaps = parseCdx(fx('cdx.json'));
  assert.deepEqual(snaps.map((s) => s.timestamp), ['20260920031500', '20260920151500']);
  assert.deepEqual(parseCdx('[]'), []);
  assert.deepEqual(parseCdx(''), []);
  assert.equal(snapshotUrl('20260920031500', 'http://f/x.xml'), 'https://web.archive.org/web/20260920031500id_/http://f/x.xml');
  const u = new URL(cdxUrl('http://feeds.bbci.co.uk/news/world/rss.xml', '2026-09-20'));
  assert.equal(u.searchParams.get('from'), '20260920');
  assert.equal(u.searchParams.get('to'), '20260920');
  assert.equal(u.searchParams.get('output'), 'json');
  assert.equal(u.searchParams.get('filter'), 'statuscode:200');
});

test('Wayback feed snapshot: only the day, same line shape', () => {
  const feed = readFeeds().find((f) => f.source === 'bbc.com');
  const lines = waybackLines(fx('feed.xml'), feed, '2026-09-20', NOW);
  assert.deepEqual(lines.map((l) => l.title), ['Storm warning & evacuation', 'Floods hit northern region']);
  const l = lines[0];
  assert.equal(l.recoveredFrom, 'wayback-rss');
  assert.equal(l.feed, 'BBC World');
  assert.equal(l.publishedAt, '2026-09-20T08:00:00.000Z');
  assert.equal(l.lang, 'en-gb');
  assert.equal(l.outlet, 'BBC');
  assert.equal(l.canonicalUrl, 'https://bbc.com/news/articles/s1?at_medium=rss');
  assert.equal(l.precision, undefined);
});

test('dedupe: by rawId across sources and against the existing inbox; first group wins', () => {
  const feed = readFeeds().find((f) => f.source === 'bbc.com');
  const w = waybackLines(fx('feed.xml'), feed, '2026-09-20', NOW);
  const g = parseGdeltDoc(fx('gdelt-doc.json')).map((a) => gdeltLine(a, NOW)).filter(Boolean);
  // c1 is in wayback, gdelt (bbc.com) and gdelt (bbc.co.uk): one line survives, the wayback one.
  const { lines, dupes } = dedupeLines([w, g]);
  assert.equal(lines.filter((l) => l.canonicalUrl === 'https://bbc.com/news/articles/c1').length, 1);
  assert.equal(lines.find((l) => l.canonicalUrl === 'https://bbc.com/news/articles/c1').recoveredFrom, 'wayback-rss');
  assert.equal(dupes['gdelt-doc'], 1); // bbc.com c1 (bbc.co.uk c1 has another host, another rawId)
  assert.equal(new Set(lines.map((l) => l.rawId)).size, lines.length);
  const again = dedupeLines([w, g], lines.map((l) => ({ ...l, recoveredFrom: undefined })));
  assert.equal(again.lines.length, 0);
  assert.deepEqual(tally(lines).bySource, { 'wayback-rss': 2, 'gdelt-doc': 2 });
});

test('range and window helpers', () => {
  assert.deepEqual(dayRange('2026-09-30', '2026-10-02'), ['2026-09-30', '2026-10-01', '2026-10-02']);
  assert.throws(() => dayRange('2026-02-31'), /bad day/);
  assert.throws(() => dayRange('2026-10-02', '2026-10-01'), /before/);
  const [a, b] = splitWindow('20260920000000', '20260920235959');
  assert.equal(a[0], '20260920000000');
  assert.equal(a[1], '20260920115959');
  assert.equal(b[0], '20260920120000');
  assert.equal(splitWindow('20260920000000', '20260920001500'), null);
});

test('recoverGdelt splits a capped window; recoverWayback walks CDX then snapshots (fake fetch)', async () => {
  const urls = [];
  const full = JSON.stringify({ articles: Array.from({ length: 250 }, (_, i) => ({ url: `https://www.bbc.com/a${i}`, title: `t${i}`, seendate: '20260920T010000Z', domain: 'bbc.com', language: 'English' })) });
  const fetchText = async (u) => { urls.push(u); return new URL(u).searchParams.get('startdatetime') === '20260920000000' && new URL(u).searchParams.get('enddatetime') === '20260920235959' ? full : '{}'; };
  const r = await recoverGdelt({ targets: [{ domain: 'bbc.com', domains: ['bbc.com'] }], day: '2026-09-20', fetchText, now: NOW, log: quiet });
  assert.equal(urls.length, 3); // whole day (capped) + two halves
  assert.equal(r.lines.length, 0); // capped window was replaced by its halves, which answered {}
  const feed = readFeeds().find((f) => f.source === 'bbc.com');
  const wf = async (u) => (u.includes('/cdx/') ? fx('cdx.json') : fx('feed.xml'));
  const w = await recoverWayback({ feeds: [feed], day: '2026-09-20', fetchText: wf, now: NOW, log: quiet });
  assert.equal(w.perFeed['BBC World'].snapshots, 2);
  assert.equal(w.lines.length, 4); // 2 snapshots x 2 items on the day; dedupe happens later
  const failing = await recoverGdelt({ targets: [{ domain: 'bbc.com', domains: ['bbc.com'] }], day: '2026-09-20', fetchText: async () => { throw new Error('boom'); }, now: NOW, log: quiet, retryPassWaitMs: 0 });
  assert.equal(failing.failures.length, 1);
  let calls = 0;
  const flaky = await recoverGdelt({ targets: [{ domain: 'bbc.com', domains: ['bbc.com'] }], day: '2026-09-20', fetchText: async () => { calls += 1; if (calls === 1) throw new Error('HTTP 429'); return fx('gdelt-doc.json'); }, now: NOW, log: quiet, retryPassWaitMs: 0 });
  assert.equal(flaky.failures.length, 0); // the second pass recovered it
  assert.equal(flaky.lines.length, 3);
});

const T1 = [{ domain: 'bbc.com', domains: ['bbc.com'] }];
const res = (status, body = '') => ({ status, ok: status >= 200 && status < 300, text: async () => body });

test('throttle: 429 then 429 is a failure, not a zero', async () => {
  const fetchText = makeFetcher({ fetchImpl: async () => res(429, 'Please limit requests to one every 5 seconds'), retries: 1, sleepImpl: async () => {}, defaultGapMs: 0, log: quiet });
  const r = await recoverGdelt({ targets: T1, day: '2026-09-20', fetchText, now: NOW, log: quiet, retryPassWaitMs: 0, sleepImpl: async () => {} });
  assert.equal(r.domainStatus['bbc.com'], 'failed');
  assert.equal(r.failures.length, 1);
  assert.deepEqual(Object.keys(r.failures[0]).sort(), ['domain', 'error', 'source', 'window']);
  assert.match(r.failures[0].error, /429/);
  assert.equal(r.gdelt.domainsFailed, 1);
});

test('throttle: a failed window whose retry pass answers 0 stays failed', async () => {
  let n = 0;
  const r = await recoverGdelt({ targets: T1, day: '2026-09-20', fetchText: async () => { n += 1; if (n === 1) throw new Error('HTTP 429'); return '{"articles":[]}'; }, now: NOW, log: quiet, retryPassWaitMs: 0, sleepImpl: async () => {} });
  assert.equal(r.domainStatus['bbc.com'], 'failed');
});

test('throttle: 429 then a real empty body is a zero, ok', async () => {
  let n = 0;
  const fetchText = makeFetcher({ fetchImpl: async () => res(++n === 1 ? 429 : 200, '{"articles":[]}'), sleepImpl: async () => {}, defaultGapMs: 0, log: quiet });
  const r = await recoverGdelt({ targets: T1, day: '2026-09-20', fetchText, now: NOW, log: quiet, retryPassWaitMs: 0 });
  assert.equal(r.domainStatus['bbc.com'], 'zero');
  assert.equal(r.failures.length, 0);
  assert.deepEqual(r.gdelt, { status: 'ok', domainsOk: 0, domainsZero: 1, domainsFailed: 0 });
});

test('throttle: all domains 429 -> manifest gdelt throttled, exit 2', async () => {
  const out = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'recover-'));
  const quietLog = console.log; console.log = () => {};
  let code;
  try {
    code = await main(['--day', '2026-09-20', '--out', out, '--no-wayback', '--no-split'], { fetchText: async () => { throw new Error('HTTP 429'); }, sleepImpl: async () => {} });
  } finally { console.log = quietLog; }
  assert.equal(code, 2);
  const m = JSON.parse(fs.readFileSync(path.join(out, 'recovery-manifest-2026-09-20.json'), 'utf8'));
  assert.deepEqual(m.gdelt, { status: 'throttled', domainsOk: 0, domainsZero: 0, domainsFailed: 26 });
  assert.equal(m.failures.length, 26);
});

test('throttle: partial when some domains answer; summary classes', () => {
  const t = [{ domain: 'a' }, { domain: 'b' }];
  assert.equal(gdeltSummary(t, { a: 'ok', b: 'failed' }, [{ error: 'HTTP 429' }]).status, 'partial');
  assert.equal(gdeltSummary(t, { a: 'failed', b: 'failed' }, [{ error: 'fetch failed' }]).status, 'failed');
  assert.equal(gdeltSummary(t, { a: 'zero', b: 'ok' }, []).status, 'ok');
});

test('throttle: 3 consecutive 429s trigger the cool-down; backoff starts at 60 s', async () => {
  const sleeps = [];
  let n = 0;
  const fetchText = makeFetcher({ fetchImpl: async () => res(++n <= 4 ? 429 : 200, '{}'), sleepImpl: async (ms) => { sleeps.push(ms); }, defaultGapMs: 0, cooldownMs: 5000, log: quiet });
  await fetchText('https://api.gdeltproject.org/x');
  assert.deepEqual(sleeps.filter((ms) => ms > 1000), [60000, 120000, 5000, 480000]);
});
