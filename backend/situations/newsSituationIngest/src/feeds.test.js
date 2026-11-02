'use strict';
// Offline tests for newsSituationIngest's feed side: parseRss (adapter over backend/shared/src/rss.js), fetchRss, fetchGdelt, getJson/putObj, and the
// handler when every feed is down. Fake fetch, fake S3. Run: node --test feeds.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// ── fake @aws-sdk/client-s3 ──────────────────────────────────────────────────
const store = new Map();
const puts = [];
let getError = null;
class GetObjectCommand { constructor(input) { this.input = input; this.get = true; } }
class PutObjectCommand { constructor(input) { this.input = input; } }
class S3Client {
  async send(cmd) {
    if (cmd.get) {
      if (getError) throw getError;
      if (!store.has(cmd.input.Key)) { const e = new Error('missing'); e.name = 'NoSuchKey'; throw e; }
      return { Body: { transformToString: async () => store.get(cmd.input.Key) } };
    }
    puts.push(cmd.input);
    return {};
  }
}
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === '@aws-sdk/client-s3') return { S3Client, GetObjectCommand, PutObjectCommand };
  return realLoad.call(this, request, ...rest);
};
test.after(() => { Module._load = realLoad; });

const INDEX = require.resolve('./index.js');
function load(env = {}) {
  delete require.cache[INDEX];
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try { return require(INDEX); } finally {
    for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
const fetched = [];
function fakeFetch(impl) { globalThis.fetch = async (url, opts) => { fetched.push(String(url)); return impl(String(url), opts); }; }
const xmlRes = (xml) => ({ ok: true, status: 200, text: async () => xml });

test.beforeEach((t) => {
  fetched.length = 0; puts.length = 0; store.clear(); getError = null;
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  // Collapse the 10s abort timers and GDELT's 5.2s politeness sleeps so failure paths run instantly.
  globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms >= 5000 ? 1 : ms, ...a);
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
});
test.afterEach(() => { globalThis.fetch = realFetch; globalThis.setTimeout = realSetTimeout; });

// ── fixtures ─────────────────────────────────────────────────────────────────
const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>BBC News - World</title>
<item>
  <title><![CDATA[Ukraine says drones hit energy sites]]></title>
  <description><![CDATA[Officials say <b>three</b> regions lost power overnight.]]></description>
  <link>https://www.bbc.com/news/world-1</link>
  <media:title>ignored thumbnail title</media:title>
  <pubDate>Fri, 31 Oct 2026 10:00:00 GMT</pubDate>
</item>
<item>
  <title>Rock &amp; roll &#8217;s &quot;comeback&quot; &lt;live&gt;</title>
  <link><![CDATA[https://www.bbc.com/news/world-2]]></link>
  <description>${'x'.repeat(400)}</description>
  <pubDate>Fri, 31 Oct 2026 11:30:00 GMT</pubDate>
</item>
<item>
  <title>No link here</title>
  <pubDate>Fri, 31 Oct 2026 11:30:00 GMT</pubDate>
</item>
<item>
  <link>https://www.bbc.com/news/world-4</link>
  <description>Has a link but no title</description>
</item>
<item>
  <title>Undated headline</title>
  <link>https://www.bbc.com/news/world-5</link>
</item>
<item>
  <title>Garbled date headline</title>
  <link>https://www.bbc.com/news/world-6</link>
  <pubDate>not a date</pubDate>
</item>
</channel></rss>`;

// ── parseRss ─────────────────────────────────────────────────────────────────
test('parseRss reads RSS 2.0: CDATA, tags stripped, entities decoded, dates to ISO and age', () => {
  const { parseRss } = load()._internal;
  const out = parseRss(RSS2, 'bbc.com');
  assert.deepEqual(out.map((a) => a.url), [
    'https://www.bbc.com/news/world-1', 'https://www.bbc.com/news/world-2',
    'https://www.bbc.com/news/world-5', 'https://www.bbc.com/news/world-6',
  ]);
  const [a, b] = out;
  assert.equal(a.title, 'Ukraine says drones hit energy sites');
  assert.equal(a.description, 'Officials say three regions lost power overnight.');
  assert.equal(a.source, 'bbc.com');
  assert.equal(a.publishedAt, '2026-10-31T10:00:00.000Z');
  assert.equal(a.ageH, 2);
  // named and decimal numeric entities decode; an escaped tag (&lt;live&gt;) is markup, so the shared parser drops it
  assert.equal(b.title, 'Rock & roll ’s "comeback"');
  assert.equal(b.ageH, 0.5);
  assert.equal(b.description.length, 220); // description is capped
});

test('parseRss: items missing title or link are dropped; missing or garbled pubDate keeps the item undated', () => {
  const { parseRss } = load()._internal;
  const out = parseRss(RSS2, 'bbc.com');
  assert.ok(!out.some((a) => a.title === 'No link here'));
  assert.ok(!out.some((a) => a.url.endsWith('world-4')));
  for (const url of ['world-5', 'world-6']) {
    const a = out.find((x) => x.url.endsWith(url));
    assert.equal(a.publishedAt, null);
    assert.equal(a.ageH, 0); // undated items are treated as fresh, so the age filter keeps them
    assert.equal(a.description, '');
  }
});

test('parseRss returns [] for empty, non-feed and truncated input', () => {
  const { parseRss } = load()._internal;
  assert.deepEqual(parseRss('', 's'), []);
  assert.deepEqual(parseRss('<html><body>Service Unavailable</body></html>', 's'), []);
  assert.deepEqual(parseRss('<rss><channel><item><title>cut off', 's'), []);
});

test('decodeEntities handles named, numeric, astral and unknown entities', () => {
  const { decodeEntities } = load()._internal;
  assert.equal(decodeEntities('a &amp; b &lt;c&gt; &#39;d&#39; &nbsp;e'), "a & b <c> 'd'  e");
  assert.equal(decodeEntities('&#128512;'), '😀');
  assert.equal(decodeEntities('&#99999999999;'), '&#99999999999;'); // out of range stays literal, no throw
  assert.equal(decodeEntities('&hellip; &amp;amp;'), '&hellip; &amp;'); // one pass: no double decoding
});

test('decodeEntities decodes hex numeric entities (&#x27;)', () => {
  const { decodeEntities } = load()._internal;
  assert.equal(decodeEntities('It&#x27;s &#x2019;'), 'It\'s ’');
});

// RDF (RSS 1.0) items carry attributes and dc:date. DW English and AllAfrica are RDF feeds in RSS_FEEDS.
test('parseRss reads RDF items (<item rdf:about> with dc:date)', () => {
  const { parseRss } = load()._internal;
  const rdf = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item rdf:about="https://www.dw.com/en/story/a-1"><title>DW story</title><link>https://www.dw.com/en/story/a-1</link><dc:date>2026-10-31T11:00:00Z</dc:date></item></rdf:RDF>`;
  const out = parseRss(rdf, 'dw.com');
  assert.equal(out.length, 1);
  assert.equal(out[0].publishedAt, '2026-10-31T11:00:00.000Z');
});

const DW_RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel rdf:about="https://rss.dw.com/rdf/rss-en-all"><title>DW.com - All</title><link>https://www.dw.com/en/</link><description>Deutsche Welle</description>
<dc:language>en</dc:language><items><rdf:Seq><rdf:li rdf:resource="https://www.dw.com/en/gaza-talks/a-100"/><rdf:li rdf:resource="https://www.dw.com/en/ecb-rates/a-101"/></rdf:Seq></items></channel>
<item rdf:about="https://www.dw.com/en/gaza-talks/a-100">
  <title><![CDATA[Gaza talks resume in Cairo]]></title>
  <link>https://www.dw.com/en/gaza-talks/a-100</link>
  <description><![CDATA[<p>Mediators say <strong>both sides</strong> sent delegations.</p>]]></description>
  <dc:date>2026-10-31T11:00:00Z</dc:date>
</item>
<item rdf:about="https://www.dw.com/en/ecb-rates/a-101">
  <title>ECB holds rates &amp; signals caution</title>
  <link>https://www.dw.com/en/ecb-rates/a-101</link>
  <description>Markets expect no move until spring.</description>
  <dc:date>2026-10-31T09:30:00+00:00</dc:date>
</item>
<item rdf:about="https://www.dw.com/en/no-date/a-102">
  <title>Undated DW item</title>
  <link>https://www.dw.com/en/no-date/a-102</link>
</item>
</rdf:RDF>`;

test('parseRss reads a DW-style RDF feed: rdf:about items, dc:date, CDATA; channel and rdf:li are not items', () => {
  const { parseRss } = load()._internal;
  assert.deepEqual(parseRss(DW_RDF, 'dw.com'), [
    { title: 'Gaza talks resume in Cairo', url: 'https://www.dw.com/en/gaza-talks/a-100', description: 'Mediators say both sides sent delegations.', source: 'dw.com', ageH: 1, publishedAt: '2026-10-31T11:00:00.000Z' },
    { title: 'ECB holds rates & signals caution', url: 'https://www.dw.com/en/ecb-rates/a-101', description: 'Markets expect no move until spring.', source: 'dw.com', ageH: 2.5, publishedAt: '2026-10-31T09:30:00.000Z' },
    { title: 'Undated DW item', url: 'https://www.dw.com/en/no-date/a-102', description: '', source: 'dw.com', ageH: 0, publishedAt: null },
  ]);
});

test('parseRss reads an AllAfrica-style RDF feed: attributes on item, dc:date with offset, CDATA title and link, extra dc fields', () => {
  const { parseRss } = load()._internal;
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://purl.org/rss/1.0/">
<channel rdf:about="https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf"><title>allAfrica.com: Latest</title><link>https://allafrica.com/</link></channel>
<item rdf:about="https://allafrica.com/stories/202610310101.html"><title><![CDATA[Nigeria: Senate Passes 2027 Budget]]></title><link><![CDATA[https://allafrica.com/stories/202610310101.html]]></link><description><![CDATA[Lawmakers approved the spending plan after a late sitting.]]></description><dc:creator>Daily Trust</dc:creator><dc:date>2026-10-31T10:45:00+01:00</dc:date></item>
<item rdf:about="https://allafrica.com/stories/202610310102.html"><title>Kenya: Court Halts Tax Rule</title><link>https://allafrica.com/stories/202610310102.html</link><dc:date>2026-10-30T12:00:00Z</dc:date></item>
<item rdf:about="https://allafrica.com/stories/202610310103.html"><title>No link item</title><dc:date>2026-10-31T10:00:00Z</dc:date></item>
</rdf:RDF>`;
  assert.deepEqual(parseRss(xml, 'allafrica.com'), [
    { title: 'Nigeria: Senate Passes 2027 Budget', url: 'https://allafrica.com/stories/202610310101.html', description: 'Lawmakers approved the spending plan after a late sitting.', source: 'allafrica.com', ageH: 2.25, publishedAt: '2026-10-31T09:45:00.000Z' },
    { title: 'Kenya: Court Halts Tax Rule', url: 'https://allafrica.com/stories/202610310102.html', description: '', source: 'allafrica.com', ageH: 24, publishedAt: '2026-10-30T12:00:00.000Z' },
  ]);
});

test('parseRss decodes hex and decimal numeric entities in RSS 2.0 titles and descriptions', () => {
  const { parseRss } = load()._internal;
  const xml = `<rss version="2.0"><channel><item>
<title>Trump&#x27;s tariffs &#x2019;hit&#x2019; Canada&#8217;s exports &#39;again&#39;</title>
<link>https://example.org/hex-1</link>
<description>It&#x27;s &#x201C;worse&#x201D; than &#8216;expected&#8217;</description>
<pubDate>Fri, 31 Oct 2026 10:00:00 GMT</pubDate>
</item></channel></rss>`;
  assert.deepEqual(parseRss(xml, 'example.org'), [{
    title: 'Trump\'s tariffs ’hit’ Canada’s exports \'again\'', url: 'https://example.org/hex-1',
    description: 'It\'s “worse” than ‘expected’', source: 'example.org', ageH: 2, publishedAt: '2026-10-31T10:00:00.000Z',
  }]);
});

// Atom <entry> with <link href> and <updated> is read by the shared parser (new with the adapter; no Atom feed is configured today).
test('parseRss reads Atom entries', () => {
  const { parseRss } = load()._internal;
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story</title><link href="https://example.org/a" rel="alternate"/><updated>2026-10-31T11:00:00Z</updated></entry></feed>`;
  assert.deepEqual(parseRss(atom, 'example.org'), [
    { title: 'Atom story', url: 'https://example.org/a', description: '', source: 'example.org', ageH: 1, publishedAt: '2026-10-31T11:00:00.000Z' },
  ]);
});

// ── fetchRss ─────────────────────────────────────────────────────────────────
const feedFor = (n, ageHours = 1) => {
  const pub = new Date(NOW - ageHours * 3.6e6).toUTCString();
  return `<rss><channel><item><title>Story ${n}</title><link>https://x.example/${n}</link><pubDate>${pub}</pubDate></item></channel></rss>`;
};

test('fetchRss tolerates dead feeds: non-200, network error and abort timeout give [] for that feed only', async () => {
  const { fetchRss } = load()._internal;
  fakeFetch(async (url, opts) => {
    if (url.includes('bbci.co.uk')) return xmlRes(feedFor('bbc'));
    if (url.includes('aljazeera')) return { ok: false, status: 503, text: async () => 'down' };
    if (url.includes('france24')) throw new Error('ECONNREFUSED');
    if (url.includes('scmp.com')) { // hangs until the 10s abort timer fires
      return new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    }
    return xmlRes('<html>not a feed</html>');
  });
  const out = await fetchRss();
  assert.deepEqual(out.map((a) => [a.title, a.source]), [['Story bbc', 'bbc.com']]);
  assert.equal(fetched.length, 25); // every configured feed was tried; none threw out of fetchRss
});

test('fetchRss reads the configured RDF feeds (DW English, AllAfrica) and attributes them to their source', async () => {
  const { fetchRss } = load()._internal;
  fakeFetch(async (url) => (url.includes('rss.dw.com') ? xmlRes(DW_RDF) : xmlRes('')));
  const out = await fetchRss();
  assert.deepEqual(out.map((a) => [a.title, a.source, a.ageH]), [
    ['Gaza talks resume in Cairo', 'dw.com', 1], ['ECB holds rates & signals caution', 'dw.com', 2.5], ['Undated DW item', 'dw.com', 0],
  ]);
});

test('fetchRss drops items older than the age limit, de-duplicates by url and caps each feed at 30', async () => {
  const { fetchRss } = load()._internal;
  const many = Array.from({ length: 40 }, (_, i) => `<item><title>BBC ${i}</title><link>https://x.example/b${i}</link></item>`).join('');
  fakeFetch(async (url) => {
    if (url.includes('bbci.co.uk')) return xmlRes(`<rss><channel>${many}</channel></rss>`);
    if (url.includes('aljazeera')) return xmlRes(feedFor('dup', 1)); // same url as france24's item
    if (url.includes('france24')) return xmlRes(feedFor('dup', 2));
    if (url.includes('scmp.com')) return xmlRes(feedFor('old', 40)); // > 36h
    if (url.includes('thediplomat')) return xmlRes(feedFor('edge', 35));
    return xmlRes('');
  });
  const out = await fetchRss();
  assert.equal(out.filter((a) => a.source === 'bbc.com').length, 30);
  assert.equal(out.filter((a) => a.url === 'https://x.example/dup').length, 1);
  assert.ok(!out.some((a) => a.title === 'Story old'));
  assert.ok(out.some((a) => a.title === 'Story edge'));
});

// ── fetchGdelt ───────────────────────────────────────────────────────────────
test('fetchGdelt is off by default: no request, empty list', async () => {
  const { fetchGdelt } = load()._internal;
  fakeFetch(async () => { throw new Error('must not be called'); });
  assert.deepEqual(await fetchGdelt(), []);
  assert.equal(fetched.length, 0);
});

test('fetchGdelt (enabled) skips HTTP errors, HTML overload pages and network errors, keeps good articles', async () => {
  const { fetchGdelt } = load({ GDELT_ENABLED: 'true' })._internal;
  let call = 0;
  fakeFetch(async (url) => {
    call++;
    assert.match(url, /^https:\/\/api\.gdeltproject\.org\/api\/v2\/doc\/doc\?query=/);
    if (call === 1) return { ok: false, status: 429, text: async () => 'Please limit requests' };
    if (call === 2) return { ok: true, status: 200, text: async () => '<html>Overloaded</html>' };
    if (call === 3) throw new Error('ECONNREFUSED');
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ articles: [
        { url: 'https://news.example/a', title: ' Flood &amp; fury ', domain: 'news.example', language: 'English' },
        { url: 'https://news.example/b', title: 'No domain' },
        { title: 'No url' },
        { url: 'https://news.example/c' },
      ] }),
    };
  });
  const out = await fetchGdelt();
  assert.equal(call, 4); // one failure never stops the remaining queries
  assert.deepEqual(out.map((a) => [a.title, a.url, a.source]), [
    ['Flood & fury', 'https://news.example/a', 'news.example'],
    ['No domain', 'https://news.example/b', 'gdelt'],
  ]);
  assert.equal(out[0].ageH, 0);
});

// ── getJson / putObj ─────────────────────────────────────────────────────────
test('getJson parses a stored object, returns null for missing/403/404 and rethrows other errors', async () => {
  const { getJson } = load()._internal;
  store.set('stories/index.json', JSON.stringify({ count: 2 }));
  assert.deepEqual(await getJson('stories/index.json'), { count: 2 });
  assert.equal(await getJson('nope.json'), null);
  for (const code of [403, 404]) {
    getError = Object.assign(new Error('x'), { name: 'Other', $metadata: { httpStatusCode: code } });
    assert.equal(await getJson('k'), null);
  }
  getError = Object.assign(new Error('boom'), { name: 'InternalError', $metadata: { httpStatusCode: 500 } });
  await assert.rejects(getJson('k'), /boom/);
  getError = null;
  store.set('bad.json', '{not json');
  await assert.rejects(getJson('bad.json')); // corrupt JSON is not silently treated as missing
});

test('putObj stringifies objects, passes strings through and sets the content type', async () => {
  const { putObj } = load()._internal;
  await putObj('stories/index.json', { a: 1 });
  await putObj('corpus/2026/10/31/12.jsonl', '{"a":1}\n{"a":2}', 'application/x-ndjson');
  assert.equal(puts[0].Key, 'stories/index.json');
  assert.equal(puts[0].Body, '{"a":1}');
  assert.equal(puts[0].ContentType, 'application/json');
  assert.equal(puts[1].Body, '{"a":1}\n{"a":2}');
  assert.equal(puts[1].ContentType, 'application/x-ndjson');
  assert.equal(puts[0].Bucket, 'globalperspective-world-280362093938');
});

// ── handler with every feed down ─────────────────────────────────────────────
test('handler: every RSS feed failing publishes a no-articles failure marker and keeps the last good stories', async () => {
  const ingest = load();
  fakeFetch(async () => ({ ok: false, status: 500, text: async () => '' }));
  const objects = new Map([['stories/index.json', { updated_at: '2026-10-31T08:00:00Z', count: 1, stories: [{ storyId: 'conflict#UKR#x', title: 'Last good' }] }]]);
  const writes = [];
  const run = ingest.makeHandler({
    apiKey: 'k', now: () => '2026-10-31T12:00:00.000Z',
    getJson: async (k) => objects.get(k) || null,
    putObj: async (k, v) => { objects.set(k, v); writes.push(k); },
    putMetric: async () => {},
  });
  const r = await run();
  assert.equal(r.ok, false);
  assert.equal(r.degraded, true);
  assert.equal(r.reason, 'no-articles');
  const idx = objects.get('stories/index.json');
  assert.equal(idx.status, 'failed');
  assert.equal(idx.degraded, true);
  assert.equal(idx.updated_at, '2026-10-31T08:00:00Z'); // last good timestamp kept
  assert.deepEqual(idx.stories.map((s) => s.title), ['Last good']);
  assert.ok(writes.every((k) => !k.startsWith('corpus/') && !k.startsWith('stories/state/')));
});
