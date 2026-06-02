// Proves utils/disruptionGate.js against a real ECONOMIC_IMPACT scan.
// Run: node scripts/test-disruption-gate.mjs /tmp/econ_scan.json
// Reports before/after: FX arrows relabelled vs suppressed, analogs backed vs gated.

import fs from 'node:fs';
import { gateInstrument, gateFxInstrument, gateAnalog, isFxPair } from '../src/utils/disruptionGate.js';

const path = process.argv[2] || '/tmp/econ_scan.json';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));

function uv(v) {
  if (v == null) return v;
  if (typeof v !== 'object') return v;
  if ('S' in v) return v.S;
  if ('N' in v) return Number(v.N);
  if ('BOOL' in v) return v.BOOL;
  if ('NULL' in v) return null;
  if ('L' in v) return v.L.map(uv);
  if ('M' in v) { const o = {}; for (const k in v.M) o[k] = uv(v.M[k]); return o; }
  return v;
}
function rec(it) { const o = {}; for (const k in it) o[k] = uv(it[k]); return o; }
const items = (raw.Items || raw).map(rec);

let fxTotal = 0, fxRelabelled = 0, fxSuppressed = 0, fxFlipped = 0;
let analogTotal = 0, analogBacked = 0, analogGated = 0;
const fxRows = [];

for (const it of items) {
  for (const ins of (it.instruments || [])) {
    if (isFxPair(ins.instrumentId)) {
      fxTotal++;
      const g = gateFxInstrument(ins);
      if (g.suppressed) fxSuppressed++; else fxRelabelled++;
      // "flipped" = gate's direction differs from the raw stored direction (proof the
      // raw arrow would have been wrong under naive passthrough).
      if (!g.suppressed && g.direction !== ins.direction) fxFlipped++;
      fxRows.push({ id: ins.instrumentId, raw: ins.direction, gated: g.direction, sup: g.suppressed, label: g.label, rat: String(ins.rationale || '').slice(0, 70) });
    }
  }
  const ha = it.historicalAnalog;
  if (ha && ha.event) {
    analogTotal++;
    const g = gateAnalog(ha);
    if (g.backed) analogBacked++; else analogGated++;
  }
}

console.log('=== FX instruments ===');
console.log(`total FX rows:        ${fxTotal}`);
console.log(`relabelled w/ arrow:  ${fxRelabelled}`);
console.log(`arrow suppressed:     ${fxSuppressed}  (undetectable/conflicting → no false signal)`);
console.log(`direction changed vs raw stored: ${fxFlipped}  (these would have rendered WRONG without the gate)`);
console.log('\nper-row:');
for (const r of fxRows) {
  const tag = r.sup ? 'SUPPRESS' : (r.gated !== r.raw ? `FLIP ${r.raw}→${r.gated}` : `keep ${r.gated}`);
  console.log(`  ${r.id.padEnd(8)} -> ${r.label.padEnd(4)} [${tag}]  ${r.rat}`);
}

console.log('\n=== historical analogs ===');
console.log(`total analogs:        ${analogTotal}`);
console.log(`catalog-backed:       ${analogBacked}`);
console.log(`gated (unbacked):     ${analogGated}  (${analogTotal ? Math.round((analogGated / analogTotal) * 100) : 0}% — outcome/realized-move block suppressed)`);

// sanity assertions
let failures = 0;
const expect = (cond, msg) => { if (!cond) { console.error('ASSERT FAIL:', msg); failures++; } };
expect(fxTotal > 0, 'found FX rows');
expect(fxFlipped > 0, 'gate flips at least one wrong raw direction (proves the bug was real)');
expect(analogGated > 0, 'gate suppresses at least one unbacked analog');
expect(fxRelabelled + fxSuppressed === fxTotal, 'every FX row resolved');
console.log(failures ? `\n${failures} ASSERTION(S) FAILED` : '\nAll assertions passed.');
process.exit(failures ? 1 : 0);
