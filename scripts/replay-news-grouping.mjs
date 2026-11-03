#!/usr/bin/env node
// Replay the news-situation grouping (backend/shared/src/situations-core.js planNewsGrouping) over saved
// world snapshots. Offline: reads local files only, never touches S3 or AWS.
//
//   node scripts/replay-news-grouping.mjs --dir <folder> [--hours 24] [--out merges.md]
//
// <folder> holds a local copy of the tracker's own output (copy it down first, read-only), e.g.
//   aws s3 sync s3://<world-bucket>/world/2026/11/02/ <folder>/world/2026/11/02/
//   aws s3 sync s3://<world-bucket>/situations/state/   <folder>/state/
//   aws s3 sync s3://<world-bucket>/situations/archive/ <folder>/archive/
// Each world/YYYY/MM/DD/HH/HHMM.json snapshot is one sweep. Snapshots carry situation summaries, not the
// raw stories, so each open news situation is replayed as one story whose title is its title, countries
// its iso3_affected and thread its threadId. Article URLs come from the situation's state/archive file
// (evidence.headlines): that is the LAST sweep's list, so a URL may count a few sweeps earlier than it
// really appeared (a merge can show up earlier than it would live, never later). Each situation then
// lives in the replay as the tracker would hold it (3 missed sweeps, then gone).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../backend/shared/src/situations-core.js');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.dir) { console.error('usage: replay-news-grouping.mjs --dir <folder> [--hours 24] [--out file.md]'); process.exit(2); }
const HOURS = Number(args.hours) || 24;
const stateKey = (id) => id.replace(/[^A-Za-z0-9._-]/g, '_');
const SEV = { high: 5, elevated: 4, moderate: 3, low: 2 };
const TTL = 9999999999;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const detail = (id) => {
  for (const d of ['state', 'archive']) {
    const f = path.join(args.dir, d, `${stateKey(id)}.json`);
    if (fs.existsSync(f)) return readJson(f);
  }
  return null;
};

const snaps = walk(path.join(args.dir, 'world')).filter((f) => /\/\d{4}\.json$/.test(f)).map((f) => readJson(f)).filter((w) => w.generated_at)
  .sort((a, b) => a.generated_at.localeCompare(b.generated_at));
if (!snaps.length) { console.error('no world snapshots found under <dir>/world'); process.exit(1); }
const lastAt = new Date(snaps[snaps.length - 1].generated_at).getTime();
const sweeps = snaps.filter((w) => lastAt - new Date(w.generated_at).getTime() <= HOURS * 3600e3);

const tokyo = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' JST';
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const detailCache = new Map();
const detailOf = (id) => { if (!detailCache.has(id)) detailCache.set(id, detail(id)); return detailCache.get(id); };

let prior = {}; const missed = {};
const rows = new Map(); // `${survivor}|${absorbed}` -> first row
let ungroupedLast = 0; let groupedLast = 0;
for (const w of sweeps) {
  const open = w.situations.filter((s) => s.source === 'news' && s.state !== 'closed');
  const groups = open.map((s) => {
    const d = detailOf(s.id) || {};
    const ev = d.evidence || {};
    const outlets = Number((/(\d+)\s+outlets?/.exec(s.what_changed || '') || [])[1]) || Number(ev.outlets) || 1;
    const st = {
      storyId: d.storyId || s.id.replace(/^news#/, ''), title: d.title || s.verb_label, axis: s.axis,
      max_severity: SEV[s.tier] || 3, outlets, velocity: 1, spread_new_iso3: [], centroid: s.centroid, iso3: s.iso3_affected || [],
      headlines: ev.headlines || [],
    };
    return { id: s.id, threadId: s.threadId || null, stories: [st], aliases: [], prev: prior[s.id] || null, opened: s.opened_at };
  });
  const plan = core.planNewsGrouping(groups, prior);
  for (const m of plan.merges) {
    const key = `${m.survivor.id}|${m.absorbed.id}`;
    if (!rows.has(key)) rows.set(key, { at: w.generated_at, ...m });
  }
  const next = {};
  for (const id of plan.absorbed) delete prior[id];
  for (const g of plan.groups) {
    // the replayed situation keeps the real opened_at of the oldest member so "oldest survives" is honest
    const item = core.buildStorySituation(g.prev, core.mergeStories(g.stories), w.generated_at, TTL, { situationId: g.id, threadId: g.threadId, aliases: g.aliases, grouping: g.grouping }).item;
    const opened = [g.prev && g.prev.opened_at, ...g.groupIds.map((gid) => groups.find((x) => x.id === gid).opened)].filter(Boolean).sort()[0];
    next[g.id] = { ...item, opened_at: opened || item.opened_at };
    missed[g.id] = 0;
  }
  for (const [id, st] of Object.entries(prior)) {
    if (next[id] || plan.absorbed.includes(id)) continue;
    missed[id] = (missed[id] || 0) + 1;
    if (missed[id] < 3) next[id] = st;
  }
  prior = next;
  ungroupedLast = open.length; groupedLast = plan.groups.length;
}

const first = sweeps[0].generated_at; const last = sweeps[sweeps.length - 1].generated_at;
const list = [...rows.values()];
const out = [];
out.push(`# News grouping replay`);
out.push('');
out.push(`Replayed ${sweeps.length} sweeps, ${tokyo(first)} to ${tokyo(last)} (${((new Date(last) - new Date(first)) / 3600e3).toFixed(1)} h; ${snaps.length} snapshots were available, window ${HOURS} h).`);
out.push(`Open news situations in the last sweep: ${ungroupedLast} as published, ${groupedLast} with grouping. ${list.length} distinct merge(s) fired.`);
out.push('');
out.push('Limits: snapshots hold situation summaries, not raw stories; each situation is replayed as one story; article URLs come from the final state/archive file (so a URL rule can fire a few sweeps earlier than live).');
out.push('');
out.push('| Time (Tokyo) | Surviving id | Surviving title | Absorbed id | Absorbed title | Rule | Evidence |');
out.push('|---|---|---|---|---|---|---|');
for (const r of list) {
  const ev = r.rule === 'url' ? r.url : r.rule === 'title+country' ? `"${r.title}" in ${r.countries.join(', ')}` : `member story ${r.storyId}`;
  out.push(`| ${tokyo(r.at)} | ${cell(r.survivor.id)} | ${cell(r.survivor.title)} | ${cell(r.absorbed.id)} | ${cell(r.absorbed.title)} | ${r.rule} | ${cell(ev)} |`);
}
if (!list.length) out.push('| (no merges) | | | | | | |');
const text = out.join('\n') + '\n';
if (args.out) fs.writeFileSync(args.out, text);
process.stdout.write(text);
