#!/usr/bin/env node
// Turns the gap benchmark's T1 continuations ("this recovered article continues that story") into assignment inbox lines.
// Local files only: it never touches S3. The operator uploads the output as record/inbox/assignments/DAY.jsonl.
//
//   node backend/record/cli/benchmark-assignments.mjs --t1 'gap-benchmark/out/T1-s*.json' --inbox-dir ./inbox-articles \
//     [--merges merges.jsonl] [--at 2026-10-24T12:00:00.000Z] --out assignments.jsonl
//
// --t1 may be repeated or a comma list; a trailing `*` in the file name is expanded in that directory. --inbox-dir holds local copies of
// record/inbox/articles/DAY.jsonl (the recovered lines). --merges is JSONL of {from, into}: a T1 story merged away is placed on its survivor.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { inboxArticleFact } = require('../newsStoryRecord/src/facts.js');
const R = require('../newsStoryRecord/src/_shared/record.js');

const SUFFIX = ' (gap benchmark 2026-10-24)';
const ID_LEN = 12;

const readJsonl = (file) => fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

/** inbox-dir/*.jsonl -> Map(benchmark id -> article fact eventId). The id is the first 12 chars of rawId (= sha1 of the canonical url);
 *  the eventId comes from facts.js inboxArticleFact, the same function the record uses. A line the fact builder rejects is counted, not fatal. */
export function articleIndex(dir) {
  const index = new Map();
  let lines = 0;
  let rejected = 0;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    for (const line of readJsonl(path.join(dir, f))) {
      lines += 1;
      let fact;
      try { fact = inboxArticleFact(line, 'benchmark-assignments'); } catch { rejected += 1; continue; }
      const id = String(line.rawId || R.sha1(fact.payload.canonicalUrl)).slice(0, ID_LEN);
      index.set(id, fact.eventId);
    }
  }
  return { index, lines, rejected };
}

/** {from, into} lines -> a function giving the survivor of a story (chains followed, a cycle stops where it closes). */
export function survivorOf(merges) {
  const into = new Map(merges.filter((m) => m && m.from && m.into && m.from !== m.into).map((m) => [m.from, m.into]));
  return (threadId) => { const seen = new Set(); let at = threadId; while (into.has(at) && !seen.has(at)) { seen.add(at); at = into.get(at); } return at; };
}

/**
 * T1 results (arrays of {threadId, continues:[{id, why}]}) -> {lines, unmapped, conflicts}. One line per article: when two stories cite the
 * same article the first wins and the other is listed in `conflicts` (the operator decides; nothing is guessed).
 */
export function buildAssignments(t1, index, { survivor = (t) => t, at }) {
  const lines = [];
  const unmapped = [];
  const conflicts = [];
  const placed = new Map();
  let citations = 0;
  for (const story of t1) {
    for (const c of story.continues || []) {
      citations += 1;
      const entryId = index.get(String(c.id).slice(0, ID_LEN));
      if (!entryId) { unmapped.push({ id: c.id, threadId: story.threadId }); continue; }
      const threadId = survivor(story.threadId);
      const had = placed.get(entryId);
      if (had) { if (had !== threadId) conflicts.push({ id: c.id, kept: had, dropped: threadId }); continue; }
      placed.set(entryId, threadId);
      lines.push({ entryId, threadId, by: 'operator', at, reason: `${c.why}${SUFFIX}` });
    }
  }
  return { lines, unmapped, conflicts, citations };
}

function expand(pattern) {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  if (!base.includes('*')) return [pattern];
  const re = new RegExp(`^${base.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return fs.readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => path.join(dir, n));
}

export function main(argv = process.argv.slice(2)) {
  const { values: v } = parseArgs({ args: argv, options: { t1: { type: 'string', multiple: true }, 'inbox-dir': { type: 'string' }, merges: { type: 'string' }, out: { type: 'string' }, at: { type: 'string' } } });
  if (!v.t1 || !v['inbox-dir'] || !v.out) { console.error('usage: benchmark-assignments.mjs --t1 <T1-s*.json> --inbox-dir <dir> [--merges file] [--at ISO] --out file'); process.exit(2); }
  const at = v.at || new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) { console.error(`--at is not a date: ${at}`); process.exit(2); }
  const t1 = v.t1.flatMap((p) => p.split(',')).flatMap(expand).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const { index, lines: inboxLines, rejected } = articleIndex(v['inbox-dir']);
  const r = buildAssignments(t1, index, { survivor: survivorOf(v.merges ? readJsonl(v.merges) : []), at });
  fs.writeFileSync(v.out, r.lines.map((l) => JSON.stringify(l)).join('\n') + (r.lines.length ? '\n' : ''));
  console.log(`${t1.length} stories, ${r.citations} citations, ${inboxLines} inbox lines (${rejected} rejected), ${index.size} article ids`);
  console.log(`wrote ${r.lines.length} assignment lines to ${v.out}; unmapped ${r.unmapped.length}; conflicts ${r.conflicts.length}`);
  for (const u of r.unmapped) console.log(`  unmapped ${u.id} (${u.threadId})`);
  for (const c of r.conflicts) console.log(`  conflict ${c.id}: kept ${c.kept}, dropped ${c.dropped}`);
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
