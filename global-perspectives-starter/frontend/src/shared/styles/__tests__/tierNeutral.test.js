// DS1 (REDESIGN_MASTER_PLAN §3.1): risk is a number + a tier word + ring weight, NOT a traffic-light
// colour. The --tier-* tokens (and every JS spelling of them) must therefore be neutral greys that
// get brighter with the tier: no red / orange / yellow / green may ever encode a risk tier.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOKENS, RISK_SOLID, RISK_RGB, RISK_COLORS } from '../tokens.js';

const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tokens.css'), 'utf8');
const TIERS = ['low', 'moderate', 'elevated', 'high'];

const parse = (v) => {
  const hex = String(v).match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const rgb = String(v).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [1, 2, 3].map((i) => Number(rgb[i])) : null;
};
// Neutral = low saturation: the channels sit within 30 of each other (the greys here are slightly cool).
const isNeutral = (v) => { const c = parse(v); return !!c && Math.max(...c) - Math.min(...c) <= 30; };
const lum = (v) => { const c = parse(v); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

describe('tier tokens are neutral', () => {
  it('tokens.css --tier-* and --tier-*-wash are neutral greys', () => {
    for (const t of TIERS) {
      for (const name of [`tier-${t}`, `tier-${t}-wash`]) {
        const m = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'));
        expect(m, `--${name}`).not.toBeNull();
        expect(isNeutral(m[1].trim()), `--${name}: ${m[1]}`).toBe(true);
      }
    }
  });

  it('the ramp gets brighter with the tier (weight carries the tier)', () => {
    const l = TIERS.map((t) => lum(TOKENS[`tier-${t}`]));
    expect([...l].sort((a, b) => a - b)).toEqual(l);
    expect(new Set(l).size).toBe(4);
  });

  it('every JS spelling is neutral too (RISK_SOLID, RISK_RGB, RISK_COLORS)', () => {
    for (const t of TIERS) {
      expect(isNeutral(RISK_SOLID[t]), `RISK_SOLID.${t}`).toBe(true);
      expect(isNeutral(RISK_COLORS[t].color), `RISK_COLORS.${t}`).toBe(true);
      expect(isNeutral(RISK_COLORS[t].bg), `RISK_COLORS.${t}.bg`).toBe(true);
    }
    for (const k of Object.keys(RISK_RGB)) expect(Math.max(...RISK_RGB[k]) - Math.min(...RISK_RGB[k]), `RISK_RGB.${k}`).toBeLessThanOrEqual(30);
  });

  it('status colours stay distinct from the tier ramp: --ok / --warn / --error and their washes exist', () => {
    for (const n of ['ok', 'warn', 'error', 'ok-wash', 'warn-wash', 'error-wash']) expect(css, `--${n}`).toMatch(new RegExp(`^\\s*--${n}:`, 'm'));
  });
});
