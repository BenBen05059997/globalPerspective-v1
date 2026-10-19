// The style ratchets (quality/check_color_literals.mjs, check_style_px.mjs, check_shared_blocks.mjs on the
// quality/ratchet.mjs engine): counting rules, the compare rule (a rise or a brand-new file/kind fails;
// falls are allowed), and the live repo vs each baseline.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare, measure } from '../../../../../../quality/ratchet.mjs';
import { countColours, tokenColours, measure as measureColours } from '../../../../../../quality/check_color_literals.mjs';
import { countPx } from '../../../../../../quality/check_style_px.mjs';
import { countBlocks, skipSharedUi } from '../../../../../../quality/check_shared_blocks.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const baseline = (name) => JSON.parse(fs.readFileSync(path.join(repoRoot, `quality/${name}_baseline.json`), 'utf8')).files;

describe('countColours', () => {
  it('counts hex (3/4/6/8 digits) and colour functions, not ids or var()', () => {
    expect(countColours('a{color:#fff;background:#0a0a0aff;border:1px solid #abc1;x:#a2442e}', 'a.css').hex).toBe(4);
    expect(countColours('c: rgba(0,0,0,.4); d: rgb(1 2 3); e: hsl(10 20% 30%); f: oklch(0.7 0.1 200)', 'a.js').func).toBe(4);
    expect(countColours('#gp-console-status {} href="#a3e779z" var(--bg, #070d15) #12345', 'a.jsx').hex).toBe(1);
  });
  it('ignores CSS comments', () => {
    expect(countColours('/* was #fff, white */ a { color: var(--ink); }', 'a.css')).toMatchObject({ hex: 0, named: 0 });
  });
  it('counts named colours in CSS values and JS colour properties, not in selectors or data strings', () => {
    expect(countColours('.red, .x:not(.white) { color: white; border: 1px solid Red; }', 'a.css').named).toBe(2);
    expect(countColours("style={{ color: 'white', border: '1px solid black' }} fill=\"red\"", 'a.jsx').named).toBe(3);
    expect(countColours("const LEVELS = { Red: 'red', metal: 'gold' }", 'a.js').named).toBe(0);
  });
  it('counts rgb arrays, 0x colours and template-built colours', () => {
    const c = countColours('const A = [238, 119, 84]; const B = [24, 31, 44, 255]; idx = [0, 1, 2]; m = 0xff8800; cp = 0x1F1E6; h = `#${hex}`; k = "#" + hex;', 'a.js');
    expect(c).toMatchObject({ rgbArray: 2, hexNumber: 1, template: 2 });
  });
  it('flags literals that copy a token value, across hex / rgb() / array forms', () => {
    const tokens = tokenColours(':root { --hue-conflict: #ee7754; --panel: rgba(6, 12, 20, 0.95); --x: var(--y); }');
    const c = countColours('a = "#EE7754"; b = [238, 119, 84]; c = "rgba(6,12,20,.95)"; d = "#ee7755"', 'a.js', tokens);
    expect(c.tokenCopy).toBe(3);
  });
});

describe('countPx', () => {
  it('counts non-zero px per CSS property group', () => {
    const css = '/* padding: 9px */ a { font-size: 13px; font: 600 12px/1.4 var(--mono); border-radius: 4px; border-top-left-radius: 2px; padding: 0 8px; margin: 4px 0 12px; gap: var(--space-2); max-width: 600px; }';
    expect(countPx(css, 'a.css')).toEqual({ fontSize: 2, radius: 2, spacing: 3 });
  });
  it('counts JS inline styles, DOM assignments and JSX attributes', () => {
    const js = "style={{ fontSize: 11, borderRadius: '50%', padding: '10px 16px', marginTop: 0, gap: 10 }} el.style.fontSize = '12px'; <text fontSize=\"12\" /> font: 'bold 11px Inter'; const padding = 20;";
    expect(countPx(js, 'a.jsx')).toEqual({ fontSize: 4, radius: 0, spacing: 3 });
  });
});

describe('countBlocks', () => {
  it('counts distinct hand-made tier chip / tab / section-header classes, not gp-* or source tiers', () => {
    const css = '.al-tier, .al-tier-high {} .al-tier {} .tp-source-tier {} .gp-tier {} .cpg-tabs .cpg-tab {} .cpg-tab:hover {} .table {} .cpg-section-lbl {} .tp-rail-hd {} .as-section {} @media (max-width: 600px) { .x-tabs {} }';
    expect(countBlocks(css, 'a.css')).toEqual({ tierChip: 2, tabs: 3, sectionHeader: 2 });
  });
  it('counts role="tablist" in JSX', () => {
    expect(countBlocks('<div role="tablist"><b role="tab" /></div><div role={"tablist"} />', 'a.jsx')).toEqual({ tabs: 2 });
  });
});

describe('compare', () => {
  it('fails on a rise, a new file and a new kind; allows a fall', () => {
    const base = { 'a.css': { hex: 5 }, 'b.css': { hex: 3, func: 1 } };
    expect(compare({ 'a.css': { hex: 6 }, 'b.css': { hex: 3, func: 1 } }, base).rose).toHaveLength(1);
    expect(compare({ 'a.css': { hex: 5 }, 'b.css': { hex: 3, func: 1 }, 'c.jsx': { hex: 1 } }, base).rose).toHaveLength(1);
    expect(compare({ 'a.css': { hex: 5, named: 1 }, 'b.css': { hex: 3, func: 1 } }, base).rose).toHaveLength(1);
    const ok = compare({ 'a.css': { hex: 4 } }, base);
    expect(ok.rose).toEqual([]);
    expect(ok.fell).toHaveLength(3);
  });
});

describe('live repo', () => {
  it('no file is above any style baseline', () => {
    expect(compare(measureColours(repoRoot), baseline('color_literals')).rose).toEqual([]);
    expect(compare(measure(repoRoot, countPx), baseline('style_px')).rose).toEqual([]);
    expect(compare(measure(repoRoot, countBlocks, skipSharedUi), baseline('shared_blocks')).rose).toEqual([]);
  });
});
