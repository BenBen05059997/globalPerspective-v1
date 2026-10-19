// check_feature_cycles — fails on any feature<->feature import cycle or any shared/ -> features/ import.
//
// Walks frontend src/**/*.{js,jsx} (tests excluded: __tests__/ and *.test.*), resolves every
// static `import … from`, `export … from`, bare `import '…'` and dynamic `import('…')` specifier
// (`@/` alias and relative), maps each file to its unit (features/<name>, shared, app) and runs
// Tarjan SCC over the feature graph. No dependencies.
//
//   node quality/check_feature_cycles.mjs           exit 1 on a cycle or a shared -> features edge
//   node quality/check_feature_cycles.mjs --edges   also print every cross-feature edge
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'global-perspectives-starter/frontend/src');
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
    else if (/\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) files.push(p);
  }
})(SRC);

const unitOf = (abs) => {
  const [top, name] = path.relative(SRC, abs).split(path.sep);
  return top === 'features' ? `features/${name}` : top;
};

const edges = new Map(); // feature -> Map(feature -> ['file -> spec'])
const shared = [];
for (const f of files) {
  const from = unitOf(f);
  for (const [, spec] of fs.readFileSync(f, 'utf8').matchAll(SPEC)) {
    let target;
    if (spec.startsWith('@/')) target = path.join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) target = path.resolve(path.dirname(f), spec);
    else continue;
    const to = unitOf(target);
    const where = `${path.relative(SRC, f)} -> ${spec}`;
    if (from === 'shared' && to.startsWith('features/')) shared.push(where);
    if (from === to || !from.startsWith('features/') || !to.startsWith('features/')) continue;
    if (!edges.has(from)) edges.set(from, new Map());
    const m = edges.get(from);
    if (!m.has(to)) m.set(to, []);
    m.get(to).push(where);
  }
}

// Tarjan SCC
let idx = 0;
const index = new Map(), low = new Map(), stack = [], on = new Set(), sccs = [];
function strong(v) {
  index.set(v, idx); low.set(v, idx++); stack.push(v); on.add(v);
  for (const w of edges.get(v)?.keys() ?? []) {
    if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
  }
  if (low.get(v) === index.get(v)) {
    const c = [];
    let w;
    do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
    if (c.length > 1) sccs.push(c);
  }
}
for (const v of edges.keys()) if (!index.has(v)) strong(v);

if (process.argv.includes('--edges')) {
  for (const [a, m] of [...edges].sort()) for (const [b, list] of [...m].sort()) {
    console.log(`${a} -> ${b}`);
    for (const w of list) console.log(`    ${w}`);
  }
}

let bad = false;
for (const c of sccs) {
  bad = true;
  console.error(`feature cycle: ${c.sort().join(' <-> ')}`);
  for (const a of c) for (const b of c) for (const w of edges.get(a)?.get(b) ?? []) console.error(`    ${w}`);
}
for (const w of shared) { bad = true; console.error(`shared imports a feature: ${w}`); }
if (bad) process.exit(1);
console.log(`feature graph: ${edges.size} importing features, no cycles, no shared -> features imports`);
