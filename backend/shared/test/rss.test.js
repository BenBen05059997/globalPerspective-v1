'use strict';
// node --test backend/shared/test/rss.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRssXml, itemLink } = require('../src/rss');

test('RSS item with CDATA, entities, date and age from the given clock', () => {
  const xml = '<rss><channel><language>en-gb</language><item><title><![CDATA[A &amp; B]]></title><link>https://x.com/a</link><description>&lt;p&gt;hi&lt;/p&gt;</description><pubDate>Sun, 20 Sep 2026 08:00:00 GMT</pubDate></item></channel></rss>';
  const [a] = parseRssXml(xml, 'x.com', Date.parse('2026-09-20T10:30:00Z'));
  assert.equal(a.title, 'A & B');
  assert.equal(a.description, 'hi');
  assert.equal(a.publishedAt, '2026-09-20T08:00:00.000Z');
  assert.equal(a.age, '2 hours ago');
  assert.equal(a.lang, 'en-gb');
  assert.equal(a.source, 'x.com');
});

test('Atom entry link and dc:date; items without title or url are dropped', () => {
  const xml = '<feed><entry><title>T</title><link rel="self" href="https://x.com/self"/><link rel="alternate" href="https://x.com/alt"/><updated>2026-09-20T08:00:00Z</updated></entry><item><title>no link</title></item></feed>';
  const out = parseRssXml(xml, 'x.com', 0);
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://x.com/alt');
  assert.equal(itemLink('<link>https://y.com/</link>'), 'https://y.com/');
});
