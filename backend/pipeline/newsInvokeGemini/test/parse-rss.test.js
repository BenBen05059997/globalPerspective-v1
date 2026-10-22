'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadIndex } = require('./load');

const { parseRssXml, RSS_FEEDS } = loadIndex()._internal;
const FIXTURES = path.join(__dirname, 'fixtures', 'feeds');
const fixtureName = (feed) => `${feed.name.replace(/\W+/g, '_')}.xml`;

test('Dawn shape: <item xmlns:default=...> is parsed, escaped HTML description becomes text', () => {
  const xml = `<rss><channel><item xmlns:default="http://purl.org/rss/1.0/modules/content/">
    <title>PM chairs apex committee</title><link>https://www.dawn.com/news/1/pm</link>
    <description>&lt;p&gt;Prime Minister &lt;em&gt;Shehbaz&lt;/em&gt; is chairing&amp;nbsp;a meeting.&lt;/p&gt;</description>
    <pubDate>Thu, 22 Oct 2026 08:00:00 +0000</pubDate></item></channel></rss>`;
  const [a] = parseRssXml(xml, 'dawn.com');
  assert.equal(a.title, 'PM chairs apex committee');
  assert.equal(a.url, 'https://www.dawn.com/news/1/pm');
  assert.equal(a.description, 'Prime Minister Shehbaz is chairing a meeting.');
  assert.equal(a.publishedAt, '2026-10-22T08:00:00.000Z');
});

test('DW / Nikkei shape: <item rdf:about=...> with <dc:date> is parsed; the <items> list is not an item', () => {
  const xml = `<rdf:RDF><channel><items><rdf:Seq><rdf:li rdf:resource="https://dw.com/x"/></rdf:Seq></items></channel>
    <item rdf:about="https://www.dw.com/en/x/a-1?maca=en-rss">
      <title>Germany news: sites back online</title>
      <link>https://www.dw.com/en/x/a-1?maca=en-rss</link>
      <description>Officials warned it will take time.</description>
      <dc:date>2026-10-22T08:40:00Z</dc:date></item>
    <item rdf:about="https://asia.nikkei.com/y"><title><![CDATA[BOJ to hold rate]]></title><link>https://asia.nikkei.com/y</link></item></rdf:RDF>`;
  const [dw, nikkei, ...rest] = parseRssXml(xml, 'x');
  assert.equal(rest.length, 0);
  assert.equal(dw.publishedAt, '2026-10-22T08:40:00.000Z');
  assert.equal(dw.description, 'Officials warned it will take time.');
  assert.equal(nikkei.title, 'BOJ to hold rate');
  assert.equal(nikkei.publishedAt, null);
  assert.equal(nikkei.description, '');
});

test('Atom shape: <entry> with <link href> (alternate preferred), <summary> and <published>/<updated>', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title type="html">Quake hits coast</title>
      <link rel="self" href="https://x.example/self"/><link rel="alternate" type="text/html" href="https://x.example/a/1"/>
      <summary type="html">&lt;b&gt;Strong&lt;/b&gt; quake</summary><published>2026-10-21T10:00:00+02:00</published><updated>2026-10-22T00:00:00Z</updated></entry>
    <entry><title>Only updated</title><link href="https://x.example/a/2"/><content type="html"><![CDATA[<p>Body text</p>]]></content><updated>2026-10-22T00:00:00Z</updated></entry></feed>`;
  const [a, b] = parseRssXml(xml, 'x');
  assert.equal(a.url, 'https://x.example/a/1');
  assert.equal(a.description, 'Strong quake');
  assert.equal(a.publishedAt, '2026-10-21T08:00:00.000Z');
  assert.equal(b.url, 'https://x.example/a/2');
  assert.equal(b.description, 'Body text');
  assert.equal(b.publishedAt, '2026-10-22T00:00:00.000Z');
});

test('plain RSS still works: pubDate wins over dc:date, items without title or link are skipped', () => {
  const xml = `<rss><channel><item><title>A</title><link>https://a.example/1</link><pubDate>Tue, 20 Oct 2026 09:30:00 +0900</pubDate><dc:date>2020-01-01T00:00:00Z</dc:date></item>
    <item><title>No link</title></item><item><link>https://a.example/3</link></item></channel></rss>`;
  const out = parseRssXml(xml, 'a');
  assert.equal(out.length, 1);
  assert.equal(out[0].publishedAt, '2026-10-20T00:30:00.000Z');
});

test('the 26-feed list: every feed has a fixture and parses to items with title and url', () => {
  assert.equal(RSS_FEEDS.length, 26);
  const noDate = [];
  for (const feed of RSS_FEEDS) {
    const xml = fs.readFileSync(path.join(FIXTURES, fixtureName(feed)), 'utf8');
    const items = parseRssXml(xml, feed.source);
    assert.ok(items.length >= 3, `${feed.name}: ${items.length} items`);
    for (const it of items) {
      assert.ok(it.title && /^https?:\/\//.test(it.url), `${feed.name}: bad item ${JSON.stringify(it)}`);
      assert.equal(it.source, feed.source);
    }
    if (items.every((i) => !i.publishedAt)) noDate.push(feed.name);
  }
  // Nikkei Asia's RDF feed carries only title and link (no date, no description): the one feed without a date.
  assert.deepEqual(noDate, ['Nikkei Asia']);
});

test('the three feeds the old parser dropped (Dawn, DW English, Nikkei Asia) now yield items', () => {
  for (const name of ['Dawn', 'DW English', 'Nikkei Asia']) {
    const feed = RSS_FEEDS.find((f) => f.name === name);
    const xml = fs.readFileSync(path.join(FIXTURES, fixtureName(feed)), 'utf8');
    assert.equal(xml.match(/<item>/gi), null, `${name} fixture should use <item ...attributes>`);
    assert.equal(parseRssXml(xml, feed.source).length, 3);
  }
});

test('lang: item dc:language wins, else the channel <language>, else null', () => {
  const xml = `<rss><channel><language>en-gb</language><item><title>A</title><link>https://a.example/1</link></item>
    <item><title>B</title><link>https://a.example/2</link><dc:language>fr</dc:language></item></channel></rss>`;
  assert.deepEqual([...parseRssXml(xml, 'a')].map((i) => i.lang), ['en-gb', 'fr']);
  assert.equal(parseRssXml('<rss><channel><item><title>A</title><link>https://a.example/1</link></item></channel></rss>', 'a')[0].lang, null);
});
