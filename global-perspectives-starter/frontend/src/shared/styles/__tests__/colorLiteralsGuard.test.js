// The colour-literal ratchet (quality/check_color_literals.mjs): counting rules, the compare rule
// (a rise or a brand-new file with literals fails; falls are allowed), and the live repo vs its baseline.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countLiterals, compare, measure } from '../../../../../../quality/check_color_literals.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

describe('countLiterals', () => {
  it('counts hex (3/4/6/8 digits) and rgb/rgba/hsl/hsla literals, not ids or var()', () => {
    expect(countLiterals('a{color:#fff;background:#0a0a0aff;border:1px solid #abc1;x:#a2442e}')).toBe(4);
    expect(countLiterals('c: rgba(0,0,0,.4); d: rgb(1 2 3); e: hsl(10 20% 30%); f: hsla(1,2%,3%,.5)')).toBe(4);
    expect(countLiterals('#gp-console-status {} href="#a3e779z" var(--bg, #070d15) #12345')).toBe(1); // only the var() fallback hex
  });
});

describe('compare', () => {
  it('fails on a rise and on a new file; allows a fall', () => {
    const base = { 'a.css': 5, 'b.css': 3 };
    expect(compare({ 'a.css': 6, 'b.css': 3 }, base).rose).toHaveLength(1);
    expect(compare({ 'a.css': 5, 'b.css': 3, 'c.jsx': 1 }, base).rose).toHaveLength(1);
    const ok = compare({ 'a.css': 4 }, base);
    expect(ok.rose).toEqual([]);
    expect(ok.fell).toHaveLength(2);
  });
});

describe('live repo', () => {
  it('no file is above quality/color_literals_baseline.json', () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(repoRoot, 'quality/color_literals_baseline.json'), 'utf8')).files;
    expect(compare(measure(repoRoot), baseline).rose).toEqual([]);
  });
});
