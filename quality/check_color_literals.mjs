// check_color_literals — ratchet on hard-coded colour literals in the frontend source.
//
// The site has ONE token set (shared/styles/tokens.css). A hard-coded colour in a component is a
// second palette, so the count of literals per file may only go DOWN: this fails when a file's
// count rises above quality/color_literals_baseline.json, or when a file that is not in the
// baseline introduces any. When counts fall it prints a hint to lower the baseline.
//
// Counted in frontend src/**/*.{css,jsx,js}: #rgb #rgba #rrggbb #rrggbbaa, rgb()/rgba()/hsl()/hsla().
// Excluded: tests (__tests__, *.test.*), and the token files themselves (tokens.css, tokens.js),
// which are where colour values are SUPPOSED to live.
//
//   node quality/check_color_literals.mjs            check against the baseline (exit 1 on a rise)
//   node quality/check_color_literals.mjs --write    rewrite the baseline to today's counts
//   node quality/check_color_literals.mjs --lower    rewrite only if nothing rose (record the falls)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])/gi;
const FUNC = /\b(?:rgba?|hsla?)\(/gi;
const EXT = new Set(['.css', '.jsx', '.js']);
const SKIP_FILES = new Set(['tokens.css', 'tokens.js']);

export function countLiterals(text) {
  return (text.match(HEX) || []).length + (text.match(FUNC) || []).length;
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (EXT.has(path.extname(e.name)) && !/\.test\.[a-z]+$/.test(e.name) && !SKIP_FILES.has(e.name)) {
      out.push(p);
    }
  }
}

export function measure(repoRoot) {
  const src = path.join(repoRoot, 'global-perspectives-starter/frontend/src');
  const files = [];
  walk(src, files);
  const counts = {};
  for (const f of files.sort()) {
    const n = countLiterals(fs.readFileSync(f, 'utf8'));
    if (n > 0) counts[path.relative(src, f).split(path.sep).join('/')] = n;
  }
  return counts;
}

export function compare(current, baseline) {
  const rose = [];
  const fell = [];
  for (const [f, n] of Object.entries(current)) {
    const b = baseline[f];
    if (b === undefined) rose.push(`${f}: ${n} colour literal(s) in a file that had none (new file or new literals)`);
    else if (n > b) rose.push(`${f}: ${b} -> ${n}`);
    else if (n < b) fell.push(`${f}: ${b} -> ${n}`);
  }
  for (const [f, b] of Object.entries(baseline)) if (!(f in current)) fell.push(`${f}: ${b} -> 0`);
  return { rose, fell };
}

const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const baselinePath = path.join(repoRoot, 'quality/color_literals_baseline.json');
  const current = measure(repoRoot);
  const write = () => {
    const files = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(baselinePath, JSON.stringify({
      note: 'Per-file count of hard-coded colour literals in frontend src (see quality/check_color_literals.mjs). Counts may only fall; lower them with --lower after removing literals.',
      total: total(files),
      files,
    }, null, 2) + '\n');
    console.log(`baseline written: ${total(files)} literals in ${Object.keys(files).length} files`);
  };
  if (process.argv.includes('--write')) { write(); process.exit(0); }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files;
  const { rose, fell } = compare(current, baseline);
  if (rose.length) {
    console.error('colour literals went UP (use a token from shared/styles/tokens.css instead):');
    for (const r of rose) console.error(`  ${r}`);
    process.exit(1);
  }
  if (process.argv.includes('--lower')) { write(); process.exit(0); }
  console.log(`colour literals ok (${total(current)} now, baseline ${total(baseline)})`);
  if (fell.length) console.log(`  ${fell.length} file(s) fell below the baseline — run \`node quality/check_color_literals.mjs --lower\` to ratchet it down:\n  ${fell.slice(0, 8).join('\n  ')}${fell.length > 8 ? '\n  ...' : ''}`);
}
