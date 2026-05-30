#!/usr/bin/env node
/**
 * errors.mjs — read back the client-error sink (newsClientErrors → DynamoDB).
 *
 * Passive monitoring counterpart to the active checks in BUG_PLAYBOOK.md: the
 * scripts there detect the SIX bug classes we already know. This surfaces the
 * NOVEL ones — a contract only exists once a bug has shipped, so a thrown error
 * nobody anticipated lands here first.
 *
 * Reads the DynamoDB table via the AWS CLI (no SDK dependency — same creds the
 * deploys use), aggregates by fingerprint, sorts by count, and — if a matching
 * source map exists in dist/ — de-minifies the top stack frame so you see the
 * real file:line instead of `index-ABC123.js:1:48210`.
 *
 * Usage:
 *   node scripts/errors.mjs                 # last 7 days, sorted by count
 *   node scripts/errors.mjs --days 30
 *   node scripts/errors.mjs --raw           # skip source-map resolution
 *
 * Env:
 *   CLIENT_ERRORS_TABLE   DynamoDB table name (default: GlobalPerspectiveClientErrors)
 *   AWS_REGION            default: ap-northeast-1
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(ROOT, 'global-perspectives-starter/frontend/dist/assets');

const TABLE = process.env.CLIENT_ERRORS_TABLE || 'GlobalPerspectiveClientErrors';
const REGION = process.env.AWS_REGION || 'ap-northeast-1';

const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const days = (() => {
  const i = args.indexOf('--days');
  return i >= 0 ? Number(args[i + 1]) || 7 : 7;
})();

function cutoffDay(n) {
  const d = new Date(Date.now() - n * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function scanTable() {
  let out;
  try {
    out = execFileSync('aws', [
      'dynamodb', 'scan',
      '--table-name', TABLE,
      '--region', REGION,
      '--output', 'json',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    console.error(`\n  Could not scan ${TABLE} in ${REGION}.`);
    console.error('  Is the table deployed and are AWS creds configured?');
    console.error(`  (${String(err.message || err).split('\n')[0]})\n`);
    process.exit(1);
  }
  const { Items = [] } = JSON.parse(out);
  // Un-marshal the DynamoDB attribute-value wire format.
  return Items.map(it => {
    const o = {};
    for (const [k, v] of Object.entries(it)) {
      o[k] = v.S ?? (v.N != null ? Number(v.N) : v.BOOL ?? null);
    }
    return o;
  });
}

// ── Best-effort source-map resolution of the first stack frame ──────────────
let SourceMapConsumer = null;
async function loadSourceMapLib() {
  if (RAW) return null;
  // source-map is a script-only devDependency of the frontend, not the repo
  // root — import it from there.
  const libPath = path.join(ROOT, 'global-perspectives-starter/frontend/node_modules/source-map/source-map.js');
  try {
    const mod = await import(pathToFileURL(libPath).href);
    return mod.SourceMapConsumer;
  } catch {
    return null; // lib not installed → fall back to raw frames
  }
}

const _consumers = new Map();
async function resolveFrame(stack) {
  if (!SourceMapConsumer || !stack) return null;
  // Match e.g.  at x (https://host/assets/index-ABC.js:1:48210)
  const m = stack.match(/([\w.-]+\.js):(\d+):(\d+)/);
  if (!m) return null;
  const [, file, line, col] = m;
  const mapPath = path.join(DIST_ASSETS, `${file}.map`);
  if (!fs.existsSync(mapPath)) return null;
  try {
    if (!_consumers.has(mapPath)) {
      const json = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      _consumers.set(mapPath, await new SourceMapConsumer(json));
    }
    const consumer = _consumers.get(mapPath);
    const pos = consumer.originalPositionFor({ line: Number(line), column: Number(col) });
    if (!pos.source) return null;
    return `${pos.source.replace(/^.*\/src\//, 'src/')}:${pos.line}:${pos.column}`;
  } catch {
    return null;
  }
}

async function main() {
  SourceMapConsumer = await loadSourceMapLib();
  const cutoff = cutoffDay(days);
  const rows = scanTable().filter(r => (r.day || '') >= cutoff);

  if (rows.length === 0) {
    console.log(`\n  No client errors in the last ${days} day(s). Clean. ✓\n`);
    return;
  }

  // Fold per-day rows into per-fingerprint groups (same bug across days).
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r.hashId) || {
      hashId: r.hashId, count: 0, message: r.message, kind: r.kind,
      firstSeen: r.firstSeen, lastSeen: r.lastSeen,
      sampleStack: r.sampleStack, sampleUrl: r.sampleUrl, days: new Set(),
    };
    g.count += r.count || 0;
    g.days.add(r.day);
    if ((r.firstSeen || '') < (g.firstSeen || '')) g.firstSeen = r.firstSeen;
    if ((r.lastSeen || '') > (g.lastSeen || '')) g.lastSeen = r.lastSeen;
    groups.set(r.hashId, g);
  }

  const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, g) => s + g.count, 0);

  console.log(`\n  CLIENT ERRORS — last ${days} day(s) · ${total} event(s) · ${sorted.length} distinct\n`);
  if (!SourceMapConsumer && !RAW) {
    console.log('  (source-map lib not found — showing raw frames. `npm i -D source-map` in frontend to de-minify.)\n');
  }

  let rank = 1;
  for (const g of sorted) {
    const resolved = await resolveFrame(g.sampleStack);
    console.log(`  ${rank}. [${g.count}×] ${g.kind}: ${g.message}`);
    if (resolved) console.log(`     ↳ ${resolved}`);
    if (g.sampleUrl) console.log(`     on ${g.sampleUrl}`);
    console.log(`     first ${g.firstSeen} · last ${g.lastSeen} · ${g.days.size} day(s)\n`);
    rank += 1;
  }

  for (const c of _consumers.values()) c.destroy?.();
}

main();
