// tokens.js mirrors the role tokens in tokens.css :root — one palette, two spellings.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOKENS, RISK_SOLID } from '../tokens.js';

const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tokens.css'), 'utf8');
const rootBody = css.slice(css.indexOf(':root {'), css.indexOf('/* ═════════ ALIASES'));
const norm = (v) => String(v).toLowerCase().replace(/\s+/g, '');
const cssVal = (name) => {
  const m = rootBody.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'));
  return m ? m[1].replace(/\/\*.*$/, '').trim() : null;
};

describe('tokens.js == tokens.css :root', () => {
  it('every TOKENS entry has the same value as its CSS custom property', () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(cssVal(name), `--${name} missing in tokens.css`).not.toBeNull();
      expect(norm(cssVal(name)), `--${name}`).toBe(norm(value));
    }
  });

  it('RISK_SOLID is the tier-* role tokens', () => {
    for (const t of ['low', 'moderate', 'elevated', 'high']) expect(RISK_SOLID[t]).toBe(TOKENS[`tier-${t}`]);
  });

  it('every remaining alias is a var() of a role token, never a second palette', () => {
    const aliasBody = css.slice(css.indexOf('/* ═════════ ALIASES'), css.indexOf('scrollbar-color'));
    const defs = [...aliasBody.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)];
    expect(defs.length).toBeGreaterThan(0);
    for (const [, n, v] of defs) expect(v.trim(), `--${n}`).toMatch(/^var\(--/);
  });
});
