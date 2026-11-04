'use strict';

// newsHealth: hourly pipeline health and cost view. No model, no alerts (the operator removed pipeline alarms 2026-11-02).
// Writes two files in the world bucket:
//   record/views/health.json  PUBLIC  the pipeline panel only (14 UTC days x stages), served by the Worker like every view
//   monitoring/ops.json       PRIVATE the money panel; only newsReadApi action `ops` serves it, to the operator
// Design: project-docs/architecture/ARCHITECTURE_OPS.md. Local preview: `node index.js --dry` (reads live data, writes nothing).
const { KEYS, CONFIG } = require('./config');
const { lastDays } = require('./days');
const { buildHealth } = require('./health');
const { buildOps, awsPullDue } = require('./ops');
const { makeAws } = require('./aws');

const errText = (e) => String((e && e.message) || e).slice(0, 200);
const prices = require('./prices.json');

/** The earlier file, or null when there is none. A file that exists but cannot be read stops that file's write: its history would be lost. */
async function readPrev(aws, key) {
  const r = await aws.readText(key);
  return r ? JSON.parse(r.text) : null;
}

/**
 * One run. `aws` is the port object (aws.js makeAws, or a fake in tests). Returns { health, ops, wrote }.
 * dry: nothing is written. skipCost: no Cost Explorer call even when due.
 */
async function run({ aws, now = Date.now(), dry = false, skipCost = false, log = console.log } = {}) {
  const days = lastDays(now, CONFIG.days);
  const problems = [];
  let prevHealth = null; let prevOps = null;
  let healthReadable = true; let opsReadable = true;
  try { prevHealth = await readPrev(aws, KEYS.health); } catch (e) { healthReadable = false; problems.push(`${KEYS.health} not written: earlier file unreadable (${errText(e)})`); }
  try { prevOps = await readPrev(aws, KEYS.ops); } catch (e) { opsReadable = false; problems.push(`${KEYS.ops} not written: earlier file unreadable (${errText(e)})`); }

  const ports = {
    readText: (key) => aws.readText(key),
    resolverStatus: () => aws.resolverStatus(),
    lambdaErrors: () => aws.lambdaErrors(days),
    compareCounts: () => aws.compareCounts(days, now),
  };
  const [{ health, raw }, usage] = await Promise.all([
    buildHealth(ports, now, prevHealth),
    aws.usageRows(days, now).then((rows) => ({ rows, error: null }), (e) => ({ rows: null, error: errText(e) })),
  ]);

  let cost = null;
  if (!skipCost && awsPullDue(prevOps, now)) {
    try { cost = { rows: await aws.costByService(days), error: null, pulledAt: new Date(now).toISOString() }; } catch (e) { cost = { rows: null, error: errText(e) }; }
  }
  const ops = buildOps({ usage, cost, raw, prices, prev: prevOps, now });

  const wrote = [];
  if (!dry) {
    if (healthReadable) { await aws.putJson(KEYS.health, health, 'no-cache'); wrote.push(KEYS.health); }
    if (opsReadable) { await aws.putJson(KEYS.ops, ops, 'no-cache'); wrote.push(KEYS.ops); }
  }
  log('newsHealth', JSON.stringify({ dry, wrote, usageError: usage.error, costError: cost ? cost.error : null, problems }));
  if (problems.length && !dry) throw new Error(problems.join('; '));
  return { health, ops, wrote, problems };
}

exports.handler = async (event = {}) => {
  const { health, ops, wrote } = await run({ aws: makeAws(), dry: Boolean(event.dry), skipCost: Boolean(event.skipCost) });
  return { wrote, asOf: health.asOf, usageError: ops.deepseek.error, costError: ops.aws.error };
};

exports.run = run;

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.includes('--dry')) { console.error('Usage: node index.js --dry [--no-cost]   (a real run is the Lambda handler)'); process.exit(2); }
  run({ aws: makeAws(), dry: true, skipCost: args.includes('--no-cost'), log: console.error }).then(({ health, ops }) => {
    process.stdout.write(`${JSON.stringify({ health, ops }, null, 2)}\n`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
