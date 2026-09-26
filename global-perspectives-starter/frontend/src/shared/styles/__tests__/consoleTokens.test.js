// Console theme tokens (DS1, 2026-09-26) — asserts the scoped `.gp-console` block in
// tokens.css defines the required design tokens, without touching the rest of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const tokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../tokens.css',
);
const css = readFileSync(tokensPath, 'utf8');

// Isolate the `.gp-console { ... }` rule body so assertions can't accidentally pass
// against some other selector's token of the same name.
function ruleBodyFor(selector) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `expected to find "${selector} {" in tokens.css`).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('tokens.css — .gp-console scoped theme', () => {
  const consoleBlock = ruleBodyFor('.gp-console');

  it('defines the required surface/accent/status tokens', () => {
    expect(consoleBlock).toMatch(/--c-bg:\s*#070d15/);
    expect(consoleBlock).toMatch(/--c-accent:\s*#5fd4ff/);
    expect(consoleBlock).toMatch(/--c-warn:\s*#ffb347/);
  });

  it('defines all four crisis hues, matching SituationHome.css exactly', () => {
    expect(consoleBlock).toMatch(/--c-hue-conflict:\s*#ee7754/);
    expect(consoleBlock).toMatch(/--c-hue-political:\s*#9b8cf8/);
    expect(consoleBlock).toMatch(/--c-hue-economic:\s*#38b6e0/);
    expect(consoleBlock).toMatch(/--c-hue-humanitarian:\s*#d89e28/);
  });

  it('defines a 44px minimum tap target', () => {
    expect(consoleBlock).toMatch(/--c-tap-min:\s*44px/);
  });

  it('has a reduced-motion rule that collapses the console motion durations', () => {
    const mqStart = css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.gp-console {'));
    expect(mqStart).toBeGreaterThan(-1);
    const mqEnd = css.indexOf('}\n}', mqStart); // inner rule close then outer media close
    const mqBlock = css.slice(mqStart, mqEnd + 3);
    expect(mqBlock).toMatch(/\.gp-console\s*{/);
    expect(mqBlock).toMatch(/--c-motion-pulse:\s*0s/);
    expect(mqBlock).toMatch(/--c-motion-sweep:\s*0s/);
  });
});
