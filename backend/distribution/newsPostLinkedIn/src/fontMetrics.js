'use strict';

const fs = require('fs');
const path = require('path');

// Text widths for the bundled Inter TTFs, read straight from the font (cmap format 4 + hmtx). The story card wraps and clips
// text with these so a line that fits here fits in librsvg. Kerning is ignored (a fraction of a percent), callers keep a margin.

const FILES = { 400: 'Inter-Regular.ttf', 600: 'Inter-SemiBold.ttf', 700: 'Inter-Bold.ttf' };
const cache = new Map();

function load(weight) {
  const w = FILES[weight] ? weight : 400;
  if (cache.has(w)) return cache.get(w);
  const b = fs.readFileSync(path.join(__dirname, 'fonts', FILES[w]));
  const tables = {};
  for (let i = 0, n = b.readUInt16BE(4); i < n; i++) {
    const o = 12 + i * 16;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const upem = b.readUInt16BE(tables.head + 18);
  const nHM = b.readUInt16BE(tables.hhea + 34);
  const cmap = tables.cmap;
  let sub = null;
  for (let i = 0, n = b.readUInt16BE(cmap + 2); i < n; i++) {
    const o = cmap + 4 + i * 8;
    const off = cmap + b.readUInt32BE(o + 4);
    if (b.readUInt16BE(o) === 3 && b.readUInt16BE(o + 2) === 1 && b.readUInt16BE(off) === 4) sub = off;
  }
  if (!sub) throw new Error('fontMetrics: no cmap format 4 in ' + FILES[w]);
  const segX2 = b.readUInt16BE(sub + 6);
  const endO = sub + 14;
  const startO = endO + segX2 + 2;
  const deltaO = startO + segX2;
  const rangeO = deltaO + segX2;
  const glyphOf = (cp) => {
    for (let s = 0; s < segX2; s += 2) {
      if (cp > b.readUInt16BE(endO + s)) continue;
      if (cp < b.readUInt16BE(startO + s)) return 0;
      const ro = b.readUInt16BE(rangeO + s);
      const delta = b.readUInt16BE(deltaO + s);
      if (ro === 0) return (cp + delta) & 0xffff;
      const g = b.readUInt16BE(rangeO + s + ro + (cp - b.readUInt16BE(startO + s)) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  const advance = (g) => b.readUInt16BE(tables.hmtx + 4 * Math.min(g, nHM - 1));
  const widths = new Map();
  const font = {
    upem,
    em(ch) {
      const cp = ch.codePointAt(0);
      if (!widths.has(cp)) widths.set(cp, advance(glyphOf(cp)) / upem);
      return widths.get(cp);
    },
  };
  cache.set(w, font);
  return font;
}

/** Width in px of `text` set in Inter `weight` at `size` px, with `spacing` px letter-spacing after every character. */
function textWidth(text, size, weight = 400, spacing = 0) {
  const f = load(weight);
  let w = 0;
  let n = 0;
  for (const ch of String(text)) { w += f.em(ch) * size + spacing; n++; }
  return n ? w : 0;
}

/**
 * Greedy wrap into at most `maxLines` lines no wider than `maxWidth`. Text that does not fit ends its last line with an ellipsis.
 * Returns { lines, clipped }. A single word wider than a line is broken by characters.
 */
function wrapText(text, { size, weight = 400, maxWidth, maxLines, spacing = 0 }) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const w = (s) => textWidth(s, size, weight, spacing);
  const lines = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (w(next) <= maxWidth) { cur = next; continue; }
    if (cur) {
      if (lines.length === maxLines - 1) break;
      lines.push(cur); cur = '';
      i--; continue;
    }
    // one word wider than a line: break it by characters
    let part = '';
    for (const ch of words[i]) { if (w(part + ch) > maxWidth) break; part += ch; }
    if (!part) part = words[i][0];
    if (lines.length === maxLines - 1) { cur = part; i++; break; }
    lines.push(part);
    words[i] = words[i].slice(part.length); i--;
  }
  const clipped = i < words.length;
  if (cur) lines.push(cur);
  if (clipped && lines.length) {
    let last = lines[lines.length - 1];
    while (last && w(`${last}…`) > maxWidth) last = last.replace(/\s*\S+$/, '') || last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s,;:.\-–—]+$/, '')}…`;
  }
  return { lines: lines.slice(0, maxLines), clipped };
}

module.exports = { textWidth, wrapText };
