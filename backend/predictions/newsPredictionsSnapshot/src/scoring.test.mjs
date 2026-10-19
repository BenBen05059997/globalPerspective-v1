// Run: node scoring.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { brier, skillOf, clusterBootstrap, reliability, computeScoring } = require('./scoring.js');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// six questions, hand-computed: p = 90,80,70,30,20,10 ; outcomes 1,1,0,0,0,1
const six = [[90, 1], [80, 1], [70, 0], [30, 0], [20, 0], [10, 1]].map(([p, y], i) => ({ p, y, cluster: `c${i}` }));
// (0.1)^2 + (0.2)^2 + (0.7)^2 + (0.3)^2 + (0.2)^2 + (0.9)^2 = .01+.04+.49+.09+.04+.81 = 1.48 / 6
ok('brier by hand', near(brier(six), 1.48 / 6));
const s = skillOf(six);
ok('base rate 0.5, reference 0.25', near(s.baseRate, 0.5) && near(s.brierRef, 0.25));
ok('skill = 1 - brier/ref', near(s.skill, 1 - (1.48 / 6) / 0.25));

const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const perfect = (n) => mk(n, (i) => ({ p: i % 2 ? 90 : 10, y: i % 2 ? 1 : 0, cluster: `c${i}` }));
ok('null at 149', computeScoring(perfect(149)) === null);
const at150 = computeScoring(perfect(150), { voidCount: 30 });
ok('present at 150 with n, brier, skill, ci', at150 && at150.n === 150 && at150.brier === 0.01 && at150.skill > 0.9 && at150.ci && at150.ci.lo <= at150.ci.hi);
ok('void rate = void / (resolved + void)', at150.voidRate === 0.167);
ok('bootstrap is deterministic', JSON.stringify(clusterBootstrap(perfect(150))) === JSON.stringify(clusterBootstrap(perfect(150))));

// all-yes and all-no base rates do not divide by zero
const allYes = mk(150, (i) => ({ p: 60, y: 1, cluster: `c${i}` }));
const allNo = mk(150, (i) => ({ p: 40, y: 0, cluster: `c${i}` }));
ok('degenerate base rate gives null skill, no throw', computeScoring(allYes).skill === null && computeScoring(allNo).skill === null);

// a coin-flip forecaster has skill near 0 and an interval that includes 0
let seed = 7; const r = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const coin = mk(200, (i) => ({ p: 50, y: r() < 0.5 ? 1 : 0, cluster: `c${i % 60}` }));
const cs = computeScoring(coin);
ok('coin flip: interval includes 0', cs.ci.lo <= 0 && cs.ci.hi >= 0);

// reliability: a bin below 20 is omitted
const rel = reliability([...mk(25, () => ({ p: 65, y: 1, cluster: 'a' })), ...mk(5, () => ({ p: 15, y: 0, cluster: 'b' }))]);
ok('bin with n<20 omitted, n>=20 kept', rel.length === 1 && rel[0].bin === '60-70%' && rel[0].n === 25);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
