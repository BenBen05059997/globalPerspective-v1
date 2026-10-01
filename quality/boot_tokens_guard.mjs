// boot_tokens_guard — the boot loader may use ONLY the site's existing colour tokens. Its CSS
// (and the inline copy in index.html, which cannot read tokens.css before the CSS has loaded)
// hard-codes fallbacks; this fails if any fallback drifts from tokens.css, or if a literal colour
// appears that is not a token fallback. Run by quality/verify_pages.sh and by a vitest test.
import fs from 'node:fs';
import path from 'node:path';

const norm = (v) => String(v).toLowerCase().replace(/\s+/g, '');

export function checkBootTokens(repoRoot) {
  const fe = path.join(repoRoot, 'global-perspectives-starter/frontend');
  const tokens = fs.readFileSync(path.join(fe, 'src/shared/styles/tokens.css'), 'utf8');
  const css = fs.readFileSync(path.join(fe, 'src/shared/ui/boot/BootLoader.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const errors = [];

  const tok = {};
  for (const m of tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) if (!(m[1] in tok)) tok[m[1]] = m[2].replace(/\/\*.*$/, '').trim();

  let checked = 0;
  for (const m of css.matchAll(/var\((--[a-z0-9-]+)\s*,\s*((?:[^()]|\([^)]*\))+)\)/gi)) {
    const [, name, fallback] = m;
    if (!(name in tok)) continue;                 // a boot-local var or a font stack: not a token colour
    if (/var\(/.test(tok[name]) || /var\(/.test(fallback)) continue;
    if (!/^(#|rgba?\()/i.test(fallback.trim())) continue; // colours only (font stacks / lengths are not tokens here)
    checked += 1;
    if (norm(tok[name]) !== norm(fallback)) errors.push(`${name}: BootLoader.css fallback "${fallback.trim()}" != tokens.css "${tok[name]}"`);
  }
  if (checked < 8) errors.push(`only ${checked} token fallbacks checked (expected the boot colours) — did the CSS change shape?`);

  // No literal colour outside a token fallback (the sweep's accent-alpha wedge is the one allowed rgba).
  const stripped = css.replace(/var\((--[a-z0-9-]+)\s*,\s*(?:[^()]|\([^)]*\))+\)/gi, 'var($1)');
  for (const m of stripped.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)) {
    if (norm(m[0]) === 'rgba(95,212,255,0.28)') continue; // --c-accent at 28%, the fallback for color-mix()
    errors.push(`literal colour ${m[0]} in BootLoader.css — use a token`);
  }
  // One dark tone everywhere (2026-10-01): no light variant may come back, and the pre-JS copy must not build one.
  if (/gp-boot--light/.test(css)) errors.push('BootLoader.css has a gp-boot--light variant — the boot screen is dark on every page');
  const html = fs.readFileSync(path.join(fe, 'index.html'), 'utf8');
  if (/gp-boot--light/.test(html)) errors.push('index.html builds a gp-boot--light boot node — the pre-JS boot is dark on every path');
  // The fallbacks must name the role tokens (--bg, --accent, ...), not the retired --c-* console names.
  if (/var\(--c-/.test(css)) errors.push('BootLoader.css reads a --c-* alias — use the role token names (--bg, --accent, --text-head, ...)');
  if (/prefers-color-scheme/.test(css)) errors.push('BootLoader.css must not add prefers-color-scheme handling (the site has no dark/light switch)');
  return { errors, checked };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const { errors, checked } = checkBootTokens(process.argv[2] || process.cwd());
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`boot tokens ok (${checked} fallbacks match tokens.css)`);
}
