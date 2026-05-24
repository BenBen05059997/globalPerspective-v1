#!/usr/bin/env node
'use strict';

/**
 * dashboard.js — single-page health view for the Economic Disruption layer.
 *
 * Aggregates from the artifacts already produced by the loop:
 *   - quality/verify/latest.md       (most recent L1 schema scan)
 *   - quality/verify/_state.json     (per-check pass/fail counts)
 *   - quality/calibration/latest.md  (drift snapshot + history)
 *   - quality/calibration/_history.json (timeline)
 *   - quality/reviews/*.md           (human spot-checks)
 *   - git log on the producer + judge Lambdas (deploy timeline)
 *
 * Output: quality/dashboard.md  (single Markdown table-of-everything).
 * Cheap to regenerate. Re-run after every verifier iteration.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERIFY = path.join(ROOT, 'quality', 'verify');
const CALIB = path.join(ROOT, 'quality', 'calibration');
const REVIEWS = path.join(ROOT, 'quality', 'reviews');
const OUT = path.join(ROOT, 'quality', 'dashboard.md');

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function safeJson(p) { const s = safeRead(p); if (!s) return null; try { return JSON.parse(s); } catch { return null; } }
function gitLastTouched(rel) {
  try {
    return execSync(`git log -1 --format='%ad (%h: %s)' --date=short -- ${rel}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch { return '(no git history)'; }
}

function buildVerifyBlock() {
  const lines = ['## Verifier — latest iteration', ''];
  const state = safeJson(path.join(VERIFY, '_state.json'));
  const latest = safeRead(path.join(VERIFY, 'latest.md'));
  if (!state || !latest) {
    lines.push('_No verifier run found yet. Run `node quality/verify_ddb.js --window=21d`._', '');
    return lines;
  }
  const totalChecks = state.checks.length;
  const failed = state.checks.filter(c => c.fails > 0);
  const required = state.checks; // all required; we don't track required-vs-info in state yet
  lines.push(`- **Last run:** ${state.ts}`);
  lines.push(`- **Checks:** ${totalChecks - failed.length}/${totalChecks} green`);
  if (failed.length) {
    lines.push(`- **Failing:** ${failed.map(c => `${c.id} (${c.fails})`).join(', ')}`);
  }
  // Extract the went-green/went-red diff lines from latest.md
  const diffLines = (latest.match(/^- (✅|❌|🟡).+$/gm) || []).slice(0, 6);
  if (diffLines.length) {
    lines.push('', '**Diff vs prior iteration:**', '');
    diffLines.forEach(l => lines.push(l));
  }
  lines.push('');
  return lines;
}

function buildCalibrationBlock() {
  const lines = ['## Calibration — last 7 snapshots', ''];
  const hist = safeJson(path.join(CALIB, '_history.json'));
  if (!hist || hist.length === 0) {
    lines.push('_No calibration history yet. Run `node quality/calibration_report.js`._', '');
    return lines;
  }
  lines.push('| Date | Live | Tomb | %severe | %mod | %minor | conf_high | mean_inst | flags/rec |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of hist.slice(-7)) {
    lines.push(`| ${s.ts.slice(0, 10)} | ${s.n_live} | ${s.n_tomb} | ${s.severe_pct.toFixed(1)} | ${s.moderate_pct.toFixed(1)} | ${s.minor_pct.toFixed(1)} | ${s.high_conf_pct.toFixed(1)} | ${s.mean_instruments.toFixed(2)} | ${s.mean_flags.toFixed(2)} |`);
  }
  lines.push('');
  return lines;
}

function buildMarketsBlock() {
  const lines = ['## Markets data layer', ''];
  // Run verify_market.sh and capture the summary line + any failures.
  let out = '';
  try {
    out = execSync('bash quality/verify_market.sh 2>&1 | tail -20', { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    out = (e.stdout || '').toString() + '\n' + (e.stderr || '').toString();
  }
  const summary = (out.match(/Summary: .*pass.*fail/) || ['(no summary)'])[0]
    .replace(/\x1b\[[0-9;]*m/g, '');
  lines.push(`- ${summary}`);
  const fails = out
    .split('\n')
    .filter(l => l.startsWith('  - '))
    .map(l => l.replace(/\x1b\[[0-9;]*m/g, '').trim());
  if (fails.length) {
    lines.push('', '**Open issues:**');
    fails.forEach(f => lines.push(f));
  }
  lines.push('');
  return lines;
}

function buildPhaseStatus() {
  const lines = ['## Phase status', ''];
  const hist = safeJson(path.join(CALIB, '_history.json')) || [];
  const liveDays = hist.length > 0
    ? Math.max(0, hist[hist.length - 1].n_live)
    : 0;

  lines.push('| Phase | What | Status |');
  lines.push('|---|---|---|');
  lines.push('| A | Self-consistency checks (validator + qualityFlags) | ✅ shipped 2026-05-19 |');
  lines.push('| B | LLM-as-judge (Gemini 2.5 Flash, 5-axis) | 🟡 deployed; awaiting next cron post-thinking-disable |');
  lines.push('| C | Human spot-check (weekly rubric) | ✅ shipped 2026-05-20 |');
  lines.push(`| D | Direction-call backtest | ⏳ blocked — need 30+ days of ECON records (currently ${liveDays} live in window) |`);
  lines.push('| E | Judge calibration tracker | ⏳ blocked on Phase D + ~4 weeks of human reviews |');
  lines.push('');
  return lines;
}

function buildHumanReviews() {
  const lines = ['## Human spot-check reviews', ''];
  if (!fs.existsSync(REVIEWS)) {
    lines.push('_No reviews directory found._', '');
    return lines;
  }
  const files = fs.readdirSync(REVIEWS)
    .filter(f => /^\d{4}-\d{2}\.md$/.test(f))
    .sort()
    .slice(-4);
  if (files.length === 0) {
    lines.push('_No weekly review files yet (`quality/reviews/YYYY-WW.md`)._', '');
    return lines;
  }
  for (const f of files) {
    const week = f.replace('.md', '');
    const body = safeRead(path.join(REVIEWS, f)) || '';
    const graded = (body.match(/Overall grade:\*\*\s*`?\[?[A-F]\]?/g) || []).length;
    const total = (body.match(/^#{1,3}\s/gm) || []).length;
    lines.push(`- **${week}** — ${graded > 0 ? `${graded} graded` : 'unreviewed template'}`);
  }
  lines.push('');
  return lines;
}

function buildLambdaTimeline() {
  const lines = ['## Lambda deploy history (last commit per file)', ''];
  const files = [
    'amplify/backend/function/newsEconomicImpact/src/index.js',
    'amplify/backend/function/newsEconomicQuality/src/index.js',
    'quality/verify_ddb.js',
    'quality/calibration_report.js',
    'quality/verify_pages.sh',
    'quality/verify_lambdas.sh',
    'global-perspectives-starter/frontend/src/components/atoms/MechanismCard.jsx',
    'global-perspectives-starter/frontend/src/components/atoms/QualityFlag.jsx',
  ];
  lines.push('| File | Last touched |');
  lines.push('|---|---|');
  for (const f of files) {
    lines.push(`| \`${f.split('/').slice(-3).join('/')}\` | ${gitLastTouched(f)} |`);
  }
  lines.push('');
  return lines;
}

function buildHowTo() {
  return [
    '## How to use this stack',
    '',
    '```bash',
    'bash quality/verify_all.sh --fast      # pre-commit (~6s, no AWS)',
    'bash quality/verify_all.sh             # pre-deploy (~30s, with AWS)',
    'bash quality/verify_all.sh --with-e2e  # full + browser E2E',
    'node quality/dashboard.js              # regenerate this file',
    'node quality/calibration_report.js     # update calibration + drift',
    '```',
    '',
    '**Daily remote routine:** `trig_01MuDETdraFku7yxBLEs4ZZK` fires 09:00 UTC.',
    '**CI:** `.github/workflows/verify.yml` runs on every push/PR.',
    '**Pre-push hook:** install once with `bash scripts/install_hooks.sh`.',
    '',
  ];
}

function main() {
  const header = [
    '# Economic Disruption — Health Dashboard',
    '',
    `_Auto-generated at ${new Date().toISOString()}. Regenerate with \`node quality/dashboard.js\`._`,
    '',
  ];
  const body = [
    ...header,
    ...buildVerifyBlock(),
    ...buildMarketsBlock(),
    ...buildPhaseStatus(),
    ...buildCalibrationBlock(),
    ...buildHumanReviews(),
    ...buildLambdaTimeline(),
    ...buildHowTo(),
  ];
  fs.writeFileSync(OUT, body.join('\n'));
  console.log(`Dashboard: ${OUT}`);
}

main();
