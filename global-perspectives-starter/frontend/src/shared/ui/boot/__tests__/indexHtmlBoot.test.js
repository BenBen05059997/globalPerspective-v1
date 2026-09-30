// The pre-JS boot in index.html must stay in step with BootLoader: same minified CSS, and only
// class names the React component also produces (so the handoff never changes what is on screen).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..'); // frontend/
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(here, '../BootLoader.css'), 'utf8');
const jsx = fs.readFileSync(path.join(here, '../BootLoader.jsx'), 'utf8');

// Same minifier scripts/genboot uses to paste the CSS into index.html.
const min = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();

describe('index.html pre-JS boot', () => {
  it('inlines exactly the minified BootLoader.css (regenerate index.html if this fails)', () => {
    const m = html.match(/<style id="gp-boot-css">([\s\S]*?)<\/style>/);
    expect(m).toBeTruthy();
    expect(m[1]).toBe(min(css));
  });

  it('builds a #gp-boot node from a tiny inline script, full on "/" and compact elsewhere', () => {
    expect(html).toContain('id="gp-boot"');
    expect(html).toMatch(/location\.pathname === '\/'/);
    expect(html).toContain('gp-boot--full gp-boot--dark gp-console');
    expect(html).toContain('gp-boot--cover gp-boot--inline gp-boot--light');
  });

  it('is not written into the body markup, so no-JS readers and crawlers only see <noscript>', () => {
    const markup = html.slice(html.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    expect(markup).not.toMatch(/gp-boot/);
  });

  it('only uses class names the React component also renders', () => {
    const script = html.slice(html.indexOf('(function () {\n        try {'), html.indexOf('window.gpBootFail = function'));
    const used = new Set([...script.matchAll(/gp-boot(?:__|--)[a-z-]+/g)].map((x) => x[0]));
    expect(used.size).toBeGreaterThan(10);
    for (const c of used) {
      const inJsx = jsx.includes(c) || jsx.includes(c.replace(/^gp-boot--(dark|full|inline|light)$/, 'gp-boot--'));
      const isCoverOnly = c === 'gp-boot--cover'; // the light pre-JS cover; styled in BootLoader.css
      expect(inJsx || isCoverOnly, c).toBe(true);
      expect(css.includes(c) || ['gp-boot--dark', 'gp-boot__name'].includes(c), c).toBe(true);
    }
  });

  it('has an honest failure path if the app script cannot load', () => {
    expect(html).toContain('id="gp-boot-err"'); // a capture-phase window error listener (Vite drops onerror on the module tag)
    expect(html).toContain("t.tagName==='SCRIPT'&&t.type==='module'");
    expect(html).toContain('location.reload()');
  });
});

describe('boot colours come only from the site tokens', () => {
  it('every colour fallback equals tokens.css, no literal colours, no prefers-color-scheme', async () => {
    const { checkBootTokens } = await import('../../../../../../../quality/boot_tokens_guard.mjs');
    const { errors, checked } = checkBootTokens(path.resolve(root, '../..'));
    expect(errors).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});
