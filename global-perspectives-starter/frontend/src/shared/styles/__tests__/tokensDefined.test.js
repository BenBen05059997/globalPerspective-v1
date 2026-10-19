// Every custom property the frontend reads with var(--name) must be defined somewhere (tokens.css, a
// component's own CSS, or an inline style object) — an undefined token renders as nothing (2026-10-19:
// home/AIComponents.css read --space-md/--font-size-* and drew its chain/timeline unspaced). A read
// with a fallback (`var(--x, 4px)`) is allowed; template prefixes (`var(--hue-${k})`) are skipped.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') files(p, out); }
    else if (/\.(css|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe('no undefined tokens', () => {
  it('every var(--name) without a fallback has a definition', () => {
    const defined = new Set();
    const reads = [];
    for (const f of files(SRC)) {
      const text = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/(--[a-zA-Z0-9-]+)['"]?\s*:/g)) defined.add(m[1]);
      for (const m of text.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9-]+)/g)) defined.add(m[1]);
      for (const m of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,)?/g)) {
        if (!m[2] && !m[1].endsWith('-')) reads.push(`${path.relative(SRC, f)}: ${m[1]}`);
      }
    }
    const missing = [...new Set(reads.filter((r) => !defined.has(r.split(': ')[1])))];
    expect(missing).toEqual([]);
  });
});
