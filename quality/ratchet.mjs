// ratchet — the shared engine behind the frontend style ratchets (quality/check_*.mjs).
//
// A check supplies `count(text, file)` -> { kind: n } for one source file. The engine walks
// frontend src/**/*.{css,jsx,js} (tests excluded), keeps a per-file, per-kind baseline in
// quality/<name>_baseline.json, and fails when any file's count of any kind RISES, or when a
// file not in the baseline has any. Counts may only fall.
//
//   node quality/check_X.mjs            check against the baseline (exit 1 on a rise)
//   node quality/check_X.mjs --report   per-feature summary (features/<name>, shared/<dir>, app)
//   node quality/check_X.mjs --lower    rewrite the baseline only if nothing rose (record the falls)
//   node quality/check_X.mjs --write    rewrite the baseline to today's counts (resets; use sparingly)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'global-perspectives-starter/frontend/src';
const EXT = new Set(['.css', '.jsx', '.js']);

export const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out);
    } else if (EXT.has(path.extname(e.name)) && !/\.test\.[a-z]+$/.test(e.name)) {
      out.push(p);
    }
  }
}

// { 'features/map/X.css': { kind: n } } for every file with a non-zero count. `file` is relative to src.
export function measure(root, count, skip = () => false) {
  const src = path.join(root, SRC);
  const files = [];
  walk(src, files);
  const out = {};
  for (const f of files.sort()) {
    const rel = path.relative(src, f).split(path.sep).join('/');
    if (skip(rel)) continue;
    const kinds = Object.fromEntries(Object.entries(count(fs.readFileSync(f, 'utf8'), rel)).filter(([, n]) => n > 0));
    if (Object.keys(kinds).length) out[rel] = kinds;
  }
  return out;
}

export function compare(current, baseline) {
  const rose = [];
  const fell = [];
  for (const [f, kinds] of Object.entries(current)) {
    for (const [k, n] of Object.entries(kinds)) {
      const b = baseline[f]?.[k] ?? 0;
      if (n > b) rose.push(`${f}: ${k} ${b} -> ${n}`);
      else if (n < b) fell.push(`${f}: ${k} ${b} -> ${n}`);
    }
  }
  for (const [f, kinds] of Object.entries(baseline)) {
    for (const [k, b] of Object.entries(kinds)) if (!current[f]?.[k] && b > 0) fell.push(`${f}: ${k} ${b} -> 0`);
  }
  return { rose, fell };
}

export function totals(counts) {
  const t = {};
  for (const kinds of Object.values(counts)) for (const [k, n] of Object.entries(kinds)) t[k] = (t[k] || 0) + n;
  return t;
}

const fmt = (t) => Object.entries(t).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
const group = (rel) => {
  const [a, b] = rel.split('/');
  return a === 'features' || a === 'shared' ? `${a}/${b}` : a;
};

export function report(counts) {
  const kinds = Object.keys(totals(counts));
  const rows = {};
  for (const [f, k] of Object.entries(counts)) {
    const g = (rows[group(f)] ||= { files: 0 });
    g.files += 1;
    for (const [kind, n] of Object.entries(k)) g[kind] = (g[kind] || 0) + n;
  }
  const sum = (r) => kinds.reduce((a, k) => a + (r[k] || 0), 0);
  const lines = Object.entries(rows).sort(([, a], [, b]) => sum(b) - sum(a));
  const w = Math.max(5, ...lines.map(([g]) => g.length));
  const out = [[`${'group'.padEnd(w)}  files`, ...kinds.map((k) => k.padStart(Math.max(k.length, 5)))].join('  ')];
  for (const [g, r] of lines) out.push([`${g.padEnd(w)}  ${String(r.files).padStart(5)}`, ...kinds.map((k) => String(r[k] || 0).padStart(Math.max(k.length, 5)))].join('  '));
  return out.join('\n');
}

// CLI entry for a check: `name` is the baseline stem, `advice` the fix shown on a rise.
export function run({ name, title, count, skip, note, advice }) {
  const baselinePath = path.join(repoRoot, `quality/${name}_baseline.json`);
  const current = measure(repoRoot, count, skip);
  const args = process.argv.slice(2);
  const write = () => {
    const files = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(baselinePath, JSON.stringify({ note, totals: totals(files), files }, null, 2) + '\n');
    console.log(`${title}: baseline written (${fmt(totals(files))}) in ${Object.keys(files).length} files`);
  };
  if (args.includes('--report')) { console.log(`${title} by feature\n${report(current)}`); return 0; }
  if (args.includes('--write')) { write(); return 0; }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files;
  const { rose, fell } = compare(current, baseline);
  if (rose.length) {
    console.error(`${title} went UP (${advice}):`);
    for (const r of rose) console.error(`  ${r}`);
    return 1;
  }
  if (args.includes('--lower')) { write(); return 0; }
  console.log(`${title} ok (now ${fmt(totals(current))}; baseline ${fmt(totals(baseline))})`);
  if (fell.length) console.log(`  ${fell.length} count(s) fell below the baseline — run with --lower to ratchet it down:\n  ${fell.slice(0, 8).join('\n  ')}${fell.length > 8 ? '\n  ...' : ''}`);
  return 0;
}

export const isMain = (metaUrl) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
