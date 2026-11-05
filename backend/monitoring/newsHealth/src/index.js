'use strict';

// newsHealth: hourly pipeline health and cost view. No model, no alerts (the operator removed pipeline alarms 2026-11-02).
// Writes two files in the world bucket:
//   record/views/health.json  PUBLIC  the pipeline panel only (14 UTC days x stages), served by the Worker like every view
//   monitoring/ops.json       PRIVATE the money and readers panels; only newsReadApi action `ops` serves it, to the operator
// Design: project-docs/architecture/ARCHITECTURE_OPS.md. Local preview: `node index.js --dry` (reads live data, writes nothing).
const { KEYS, CONFIG, HEAL } = require('./config');
const { lastDays } = require('./days');
const { buildHealth } = require('./health');
const { buildOps, awsPullDue } = require('./ops');
const { pullReaders, readersPullDue } = require('./readers');
const { pullQuality, qualityPullDue } = require('./quality');
const { makeAws } = require('./aws');
const { heal, effectiveMode, healSummary } = require('./heal');

const errText = (e) => String((e && e.message) || e).slice(0, 200);
const prices = require('./prices.json');

/** One word per check for the run log: ok, not_available or error (a check with parts shows the worst). */
function qualityLog(q) {
  if (!q) return null;
  const rank = { ok: 0, not_available: 1, error: 2 };
  const worst = (c) => [c.status, ...Object.values(c).filter((v) => v && typeof v === 'object' && v.status).map((v) => v.status)].filter(Boolean).sort((a, b) => rank[b] - rank[a])[0] || 'ok';
  return Object.fromEntries(Object.entries(q.checks || {}).map(([id, c]) => [id, worst(c)]));
}

/** The earlier file, or null when there is none. A file that exists but cannot be read stops that file's write: its history would be lost. */
async function readPrev(aws, key) {
  const r = await aws.readText(key);
  return r ? JSON.parse(r.text) : null;
}

/**
 * One run. `aws` is the port object (aws.js makeAws, or a fake in tests). Returns { health, ops, wrote }.
 * dry: nothing is written (self-healing only reports). healMode: the HEAL env ('on' | 'dry' | else off); healFlag: 'off' | 'dry' lowers it for this run. skipCost: no Cost Explorer call even when due. skipReaders: no Cloudflare or own-table pull. skipQuality: no quality checks.
 */
async function run({ aws, now = Date.now(), dry = false, skipCost = false, skipReaders = false, skipQuality = false, healFlag = null, healMode = HEAL.mode, log = console.log } = {}) {
  const days = lastDays(now, CONFIG.days);
  const problems = [];
  let prevHealth = null; let prevOps = null;
  let healthReadable = true; let opsReadable = true;
  try { prevHealth = await readPrev(aws, KEYS.health); } catch (e) { healthReadable = false; problems.push(`${KEYS.health} not written: earlier file unreadable (${errText(e)})`); }
  try { prevOps = await readPrev(aws, KEYS.ops); } catch (e) { opsReadable = false; problems.push(`${KEYS.ops} not written: earlier file unreadable (${errText(e)})`); }

  // Self-healing first, so the health rows below show what it just did. It never throws. A dry run (or the event flag) can only lower its mode.
  const healed = await heal({
    ports: { readText: (k) => aws.readText(k), putJson: (k, o, c) => aws.putJson(k, o, c), invoke: (f, p) => aws.invoke(f, p), staging: () => aws.staging() },
    now, mode: effectiveMode(healMode, dry ? 'dry' : healFlag),
  });

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

  health.now.heal = healSummary(healed);

  let cost = null;
  if (!skipCost && awsPullDue(prevOps, now)) {
    try { cost = { rows: await aws.costByService(days), error: null, pulledAt: new Date(now).toISOString() }; } catch (e) { cost = { rows: null, error: errText(e) }; }
  }
  // Readers: Cloudflare + own tables, once per UTC day (and hourly again while Cloudflare is not 'ok'; not_connected costs no call).
  // Quality: six checks, once per UTC day for the last closed day; a check that failed is read again hourly, alone. Runs beside the readers pull.
  const [readers, quality] = await Promise.all([
    !skipReaders && readersPullDue(prevOps, now) ? pullReaders({ aws, now, days }) : null,
    !skipQuality && qualityPullDue(prevOps, now) ? pullQuality({ aws, now, prev: prevOps && prevOps.quality }) : null,
  ]);
  const ops = buildOps({ usage, cost, readers, quality, raw, prices, prev: prevOps, now });

  const wrote = [];
  if (!dry) {
    if (healthReadable) { await aws.putJson(KEYS.health, health, 'no-cache'); wrote.push(KEYS.health); }
    if (opsReadable) { await aws.putJson(KEYS.ops, ops, 'no-cache'); wrote.push(KEYS.ops); }
  }
  log('newsHealth', JSON.stringify({ dry, wrote, heal: { mode: healed.mode, actions: healed.actions.map((a) => `${a.day} ${a.step}`), skipped: healed.skipped.length, errors: healed.errors }, usageError: usage.error, costError: cost ? cost.error : null, readers: ops.readers.cloudflare.status, quality: qualityLog(ops.quality), problems }));
  if (problems.length && !dry) throw new Error(problems.join('; '));
  return { health, ops, wrote, problems };
}

exports.handler = async (event = {}) => {
  const { health, ops, wrote } = await run({ aws: makeAws(), dry: Boolean(event.dry), healFlag: event.heal || null, skipCost: Boolean(event.skipCost), skipReaders: Boolean(event.skipReaders), skipQuality: Boolean(event.skipQuality) });
  return { wrote, asOf: health.asOf, usageError: ops.deepseek.error, costError: ops.aws.error, readers: ops.readers.cloudflare.status };
};

exports.run = run;

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.includes('--dry')) { console.error('Usage: node index.js --dry [--no-cost]   (a real run is the Lambda handler)'); process.exit(2); }
  run({ aws: makeAws(), dry: true, skipCost: args.includes('--no-cost'), log: console.error }).then(({ health, ops }) => {
    process.stdout.write(`${JSON.stringify({ health, ops }, null, 2)}\n`);
  }).catch((e) => { console.error(e); process.exit(1); });
}
