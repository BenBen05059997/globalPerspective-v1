// One token set (2026-10-01): the console palette is the `:root` default. This asserts the role
// tokens exist with the approved values, that the old `--c-*` console names still resolve to them,
// and that `.gp-console` is now a no-op class.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tokens.css'), 'utf8');
const rootStart = css.indexOf(':root {');
const rootBlock = css.slice(rootStart, css.indexOf('\n}\n', rootStart));

describe('tokens.css — one :root palette (console values are the defaults)', () => {
  it('defines the surface/accent/status role tokens', () => {
    expect(rootBlock).toMatch(/--bg:\s*#070d15/);
    expect(rootBlock).toMatch(/--accent:\s*#5fd4ff/);
    expect(rootBlock).toMatch(/--warn:\s*#ffb347/);
  });

  it('defines all four crisis hues, matching SituationHome.css exactly', () => {
    expect(rootBlock).toMatch(/--hue-conflict:\s*#ee7754/);
    expect(rootBlock).toMatch(/--hue-political:\s*#9b8cf8/);
    expect(rootBlock).toMatch(/--hue-economic:\s*#38b6e0/);
    expect(rootBlock).toMatch(/--hue-humanitarian:\s*#d89e28/);
  });

  it('defines the four tier outlines, four freshness tokens and a 44px tap target', () => {
    for (const t of ['low', 'moderate', 'elevated', 'high']) expect(rootBlock).toMatch(new RegExp(`--tier-${t}:\\s*#`));
    for (const f of ['fresh-live-glow', 'fresh-plain-filter', 'fresh-older-filter', 'fresh-older-label']) expect(rootBlock).toContain(`--${f}:`);
    expect(rootBlock).toMatch(/--tap-min:\s*44px/);
  });

  it('keeps the old --c-* names as aliases of the role tokens', () => {
    expect(rootBlock).toMatch(/--c-bg:\s*var\(--bg\)/);
    expect(rootBlock).toMatch(/--c-accent:\s*var\(--accent\)/);
    expect(rootBlock).toMatch(/--c-tap-min:\s*var\(--tap-min\)/);
  });

  it('has a reduced-motion rule on :root that collapses the motion durations', () => {
    const mqStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(mqStart).toBeGreaterThan(-1);
    const mqBlock = css.slice(mqStart, css.indexOf('}\n}', mqStart) + 3);
    expect(mqBlock).toMatch(/:root\s*{/);
    expect(mqBlock).toMatch(/--motion-pulse:\s*0s/);
    expect(mqBlock).toMatch(/--motion-sweep:\s*0s/);
  });

  it('.gp-console defines no custom properties (no-op class)', () => {
    const start = css.indexOf('.gp-console {');
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf('}', start))).not.toMatch(/--[a-z]/);
  });
});
