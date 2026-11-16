// Claude comparison for the briefs-and-analysis jobs (2026-11-16): tally the saved runs and judge answers into the numbers of the report.
// Reads only OUT (the saved files). Usage: OUT=<dir> node claude_briefs_tally.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT;
const JOBS = ['daily', 'weekly', 'country', 'thread', 'systems'];
const rj = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const boldN = (s) => (String(s || '').match(/\*\*[^*]+\*\*/g) || []).length;
const out = {};
for (const job of JOBS) {
  const jd = path.join(OUT, job);
  if (!fs.existsSync(jd)) continue;
  const rows = [];
  for (const id of fs.readdirSync(jd).sort()) {
    const dir = path.join(jd, id);
    const row = { id, models: {}, judge: {} };
    for (const m of ['haiku', 'sonnet']) {
      const p = rj(path.join(dir, `${m}.json`)); const r = rj(path.join(dir, `${m}.raised.json`));
      if (!p) continue;
      const eff = p.finishReason === 'length' && r ? r : p;
      row.models[m] = {
        prodFinish: p.finishReason, prodMax: p.maxTokens || null, prodOut: p.usage?.completion_tokens, prodParseOk: p.checks.parseOk, prodFenced: p.checks.fenced,
        prodProse: p.finishReason === 'length' ? null : p.checks.proseAround,
        raisedOut: r?.usage?.completion_tokens ?? null, raisedFinish: r?.finishReason ?? null,
        effParseOk: eff.checks.parseOk, effIssues: eff.checks.issues, effIn: eff.usage?.prompt_tokens, effOut: eff.usage?.completion_tokens,
        costPerCall: eff.costUsd, latencyMs: eff.latencyMs, checks: eff.checks,
      };
    }
    const base = rj(path.join(dir, 'baseline_deepseek.json'));
    if (base && job === 'daily') row.base = { words: words(base.summary), bold: boldN(base.summary) };
    for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('judge_'))) {
      const j = rj(path.join(dir, f)); const pair = f.replace(/^judge_/, '').replace(/_(XY|YX)\.json$/, '');
      (row.judge[pair] = row.judge[pair] || []).push({ order: j.order, winner: j.winnerModel, unsupported: Object.fromEntries(Object.entries(j.unsupported).map(([k, v]) => [k, v.length])), broken: Object.fromEntries(Object.entries(j.broken).map(([k, v]) => [k, v.length])) });
    }
    rows.push(row);
  }
  out[job] = rows;
}
fs.writeFileSync(path.join(OUT, '_tally.json'), JSON.stringify(out, null, 1));

// compact printout
for (const [job, rows] of Object.entries(out)) {
  console.log(`\n== ${job}`);
  for (const r of rows) {
    const h = r.models.haiku; const s = r.models.sonnet;
    console.log(r.id.slice(0, 30).padEnd(30), 'H', h && `${h.prodFinish} out ${h.prodOut}${h.raisedOut ? '->' + h.raisedOut : ''} $${h.costPerCall?.toFixed(4)} ${h.latencyMs}ms issues:${h.effIssues.length}`, '| S', s && `${s.prodFinish} out ${s.prodOut}${s.raisedOut ? '->' + s.raisedOut : ''} $${s.costPerCall?.toFixed(4)} ${s.latencyMs}ms issues:${s.effIssues.length}`, r.base ? `| base words ${r.base.words} bold ${r.base.bold}` : '');
    for (const [pair, list] of Object.entries(r.judge)) console.log('   judge', pair, list.map((x) => `${x.order} -> ${x.winner} (unsupp ${JSON.stringify(x.unsupported)}, broken ${JSON.stringify(x.broken)})`).join(' ; '));
  }
}
const win = {};
for (const [job, rows] of Object.entries(out)) for (const r of rows) for (const [pair, list] of Object.entries(r.judge)) { const k = `${job} ${pair}`; win[k] = win[k] || {}; for (const x of list) win[k][x.winner] = (win[k][x.winner] || 0) + 1; }
console.log('\nJUDGE WINS (each pair judged in both orders)'); for (const [k, v] of Object.entries(win)) console.log(k.padEnd(28), JSON.stringify(v));
