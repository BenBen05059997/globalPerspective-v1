#!/usr/bin/env node
// move-module.mjs — relocate a single src/ module and rewrite every `@/` specifier
// that pointed at it, repo-wide. Workhorse for the frontend feature-folder
// restructure (P2-P11 of FRONTEND_RESTRUCTURE_EXECUTION_PLAN.md).
//
// Usage (run from global-perspectives-starter/frontend/):
//   node scripts/move-module.mjs <old-path> <new-path>
//
// <old-path> and <new-path> are relative to src/, e.g.:
//   node scripts/move-module.mjs components/Home.jsx features/home/Home.jsx
//
// What it does:
//   1. `git mv` the file from src/<old-path> to src/<new-path>.
//   2. Rewrites every `@/<old-path-without-ext>` specifier occurrence across
//      src/** (import/export-from, vi.mock('@/…') strings, dynamic
//      import('@/…') strings, CSS/JSON imports) to `@/<new-path-without-ext>`.
//   3. Prints a grep of remaining references to the old path in the live
//      surface (docs, scripts, hooks, skills) so the caller can fix them in
//      the same commit — this script does not edit those files itself.
//
// Note: this script does NOT touch N files' own outgoing imports (they're
// meant to stay relative) — it only rewrites `@/…` specifiers, which N files
// don't use internally by construction.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function fail(msg) {
  console.error(`move-module: ${msg}`);
  process.exit(1);
}

const [oldPathArg, newPathArg] = process.argv.slice(2);
if (!oldPathArg || !newPathArg) {
  fail('usage: node scripts/move-module.mjs <old-path> <new-path>  (paths relative to src/)');
}

const FRONTEND_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..', '..');
const SRC = path.join(FRONTEND_ROOT, 'src');

const oldRel = path.posix.normalize(oldPathArg.split(path.sep).join('/'));
const newRel = path.posix.normalize(newPathArg.split(path.sep).join('/'));

const oldAbs = path.join(SRC, oldRel);
const newAbs = path.join(SRC, newRel);

if (!fs.existsSync(oldAbs)) fail(`old path does not exist: src/${oldRel}`);
if (fs.existsSync(newAbs)) fail(`new path already exists: src/${newRel}`);

const stripExt = p => p.replace(/\.(jsx?|css|json)$/, '');
const oldSpecifier = '@/' + stripExt(oldRel);
const newSpecifier = '@/' + stripExt(newRel);
// CSS/JSON specifiers keep their extension in this codebase's import style
// (`@/features/x/Foo.css`), while JS/JSX specifiers drop it. Handle both: a
// specifier match is either the exact extensionless form, or (for css/json)
// the exact path with extension.
const oldSpecifierExt = '@/' + oldRel;
const newSpecifierExt = '@/' + newRel;

// 1. git mv
fs.mkdirSync(path.dirname(newAbs), { recursive: true });
execFileSync('git', ['mv', oldAbs, newAbs], { stdio: 'inherit' });

// 2. rewrite @/<old> specifiers repo-wide across src/**
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let filesChanged = 0;
let specifiersChanged = 0;

for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, 'utf8');
  let changed = raw;
  let fileHits = 0;

  // Extension-bearing form first (css/json), so it isn't shadowed by the
  // extensionless replace running first and leaving a dangling extension.
  const extRe = new RegExp(oldSpecifierExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  changed = changed.replace(extRe, () => { fileHits++; return newSpecifierExt; });

  // Extensionless form (js/jsx imports, vi.mock strings, dynamic import
  // strings) — must not also match inside a longer path that merely starts
  // with the same prefix, so require a boundary: end-of-string-in-quotes or
  // a non-identifier char (/, ', ") right after.
  const extensionlessRe = new RegExp(
    oldSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + String.raw`(?=['"])`,
    'g'
  );
  changed = changed.replace(extensionlessRe, () => { fileHits++; return newSpecifier; });

  if (fileHits > 0) {
    fs.writeFileSync(file, changed);
    filesChanged += 1;
    specifiersChanged += fileHits;
  }
}

console.log(`git mv src/${oldRel} -> src/${newRel}`);
console.log(`Rewrote ${specifiersChanged} specifier occurrence(s) across ${filesChanged} file(s) under src/.`);

// 3. grep the live surface for remaining references to the old path (this
// script does not edit these — it only surfaces them for the caller).
const LIVE_DOC_GLOBS = [
  'project-docs/**/_active/**',
  'project-docs/**/*.md',
  'quality/**',
  'scripts/**',
  '.githooks/**',
  '.claude/skills/**',
  'agent-kit/**',
];

function isStaleDocExempt(relPath) {
  // Historical docs are deliberately left stale (design's R4) — anything
  // under a _shipped/_legacy/_reference segment is out of scope.
  return /(^|\/)(_shipped|_legacy|_reference)(\/|$)/.test(relPath);
}

function ripgrepOrGrep(term, root) {
  try {
    const out = execFileSync(
      'grep',
      ['-rn', '--include=*.md', '--include=*.mjs', '--include=*.js', '--include=*.sh',
       term, root],
      { encoding: 'utf8' }
    );
    return out;
  } catch (e) {
    // grep exits 1 with no output when there are no matches — not an error.
    if (e.status === 1) return '';
    throw e;
  }
}

console.log('\nRemaining references to the old path (live docs/scripts/hooks/skills only):');
const searchRoots = ['project-docs', 'quality', 'scripts', '.githooks', '.claude/skills', 'agent-kit']
  .map(d => path.join(REPO_ROOT, d))
  .filter(d => fs.existsSync(d));

let anyHit = false;
for (const root of searchRoots) {
  const out = ripgrepOrGrep(oldRel, root);
  if (!out) continue;
  for (const line of out.split('\n')) {
    if (!line) continue;
    const relLine = path.relative(REPO_ROOT, line.split(':')[0]);
    if (isStaleDocExempt(relLine)) continue;
    console.log(`  ${line}`);
    anyHit = true;
  }
}
if (!anyHit) console.log('  (none)');

void LIVE_DOC_GLOBS; // documents the intended scope above; grep loop implements it directly
