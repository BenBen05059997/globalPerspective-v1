'use strict';

// RSS / Atom / RDF item parser, shared by the selector (newsInvokeGemini) and the recovery script (record/cli/recover-day.mjs),
// so a Wayback snapshot of a feed is read exactly as the live feed is. No dependencies. `nowMs` only feeds the `age` label.

// Tag helpers. Feeds differ in markup: `<item xmlns:...>` (Dawn), `<item rdf:about=...>` (DW, Nikkei, RDF/RSS 1.0),
// Atom `<entry>` with `<link href=.../>`, and `<dc:date>` instead of `<pubDate>`. Every opening tag may carry attributes.
// Text of a feed field: CDATA removed, entities decoded (Dawn and CNA escape their HTML), tags dropped, spaces collapsed.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', ndash: '\u2013', mdash: '\u2014' };
const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const stripMarkup = (s) => {
  const once = decodeEntities(String(s || '').replace(/<!\[CDATA\[|\]\]>/g, ''));
  return decodeEntities(once.replace(/<\/?[a-z!][^>]*>/gi, ' ')).replace(/\s+/g, ' ').trim();
};
function tagText(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : null;
}
function itemLink(block) {
  const text = tagText(block, 'link');
  if (text && text.replace(/<!\[CDATA\[|\]\]>/g, '').trim()) return text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  // Atom: <link href="..." rel="alternate"/>; prefer alternate (or no rel) over self/enclosure.
  const tags = block.match(/<link\s[^>]*>/gi) || [];
  const href = (t) => { const m = t.match(/\shref\s*=\s*["']([^"']+)["']/i); return m ? m[1].trim() : ''; };
  const rel = (t) => { const m = t.match(/\srel\s*=\s*["']([^"']+)["']/i); return m ? m[1].toLowerCase() : 'alternate'; };
  const best = tags.find((t) => rel(t) === 'alternate' && href(t)) || tags.find((t) => href(t));
  return best ? href(best) : '';
}

function parseRssXml(xml, sourceName, nowMs = Date.now()) {
  const articles = [];
  const firstItem = xml.search(/<(item|entry)[\s>]/i);
  const channelLang = stripMarkup(tagText(firstItem < 0 ? xml : xml.slice(0, firstItem), 'language') ?? tagText(firstItem < 0 ? xml : xml.slice(0, firstItem), 'dc:language')) || null;
  const itemRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[2];

    const title = stripMarkup(tagText(itemContent, 'title'));
    const url = itemLink(itemContent);

    // Summary: RSS description, Atom summary, then content:encoded / Atom content as a last resort.
    const rawDesc = tagText(itemContent, 'description') ?? tagText(itemContent, 'summary')
      ?? tagText(itemContent, 'content:encoded') ?? tagText(itemContent, 'content');
    const description = stripMarkup(rawDesc).substring(0, 300).trim();

    // Date: pubDate, then dc:date (RSS 1.0), then Atom published / updated.
    const rawDate = tagText(itemContent, 'pubDate') ?? tagText(itemContent, 'dc:date')
      ?? tagText(itemContent, 'published') ?? tagText(itemContent, 'updated');
    let age = '';
    let publishedAt = null;
    if (rawDate) {
      const pubTime = new Date(stripMarkup(rawDate)).getTime();
      if (!isNaN(pubTime)) {
        publishedAt = new Date(pubTime).toISOString();
        const hoursAgo = Math.floor((nowMs - pubTime) / (1000 * 60 * 60));
        if (hoursAgo < 1) age = 'Just now';
        else if (hoursAgo < 24) age = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        else {
          const daysAgo = Math.floor(hoursAgo / 24);
          age = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
        }
      }
    }

    const lang = stripMarkup(tagText(itemContent, 'dc:language')) || channelLang;

    if (title && url) {
      articles.push({ title, url, description, age, publishedAt, lang, source: sourceName });
    }
  }
  return articles;
}

module.exports = { parseRssXml, itemLink, tagText, stripMarkup, decodeEntities };
