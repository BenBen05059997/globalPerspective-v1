#!/usr/bin/env node
// backend/pipeline/cli/threads.mjs — inspect and repair story-thread joins (operator tool).
//
//   node backend/pipeline/cli/threads.mjs list-joins --since 2026-10-12 [--all]
//   node backend/pipeline/cli/threads.mjs merge <fromThreadId> <intoThreadId> [--days 90] [--apply]
//   node backend/pipeline/cli/threads.mjs split <threadId> <topicId...> [--days 90] [--apply]
//
// list-joins is read-only: for every archived topic since <date> that joined an existing thread it
// prints the score and keyword-only score against the entry it joined, both titles, and the route
// the current rule (NewsProjectInvokeAgentLambda/src/threading.js) gives it.
// merge / split READ live state, then PRINT every DynamoDB / S3 change; they write only with --apply
// (prod data: run --apply only with the operator's yes). Writes are conditional on the value read,
// so a row the pipeline changed in between is skipped, not overwritten.
// Uses the AWS CLI (no npm deps), like backend/distribution/cli/*.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const threading = require('../NewsProjectInvokeAgentLambda/src/threading.js');

const REGION = 'ap-northeast-1';
const CACHE_TABLE = 'NewsCache';
const SUMMARY_TABLE = 'SummarizeAndPredict';
const PRED_TABLE = 'GlobalPerspectivePredictionLog';
const BUCKET = 'globalperspective-world-280362093938';
const STORY_MAP_KEY = 'threads/story-map.json';
const SITUATION_STATE_PREFIX = 'situations/state/';

// Marshal original cache lists for compare-and-swap. Group all index edits on one row in a
// single update: checking only a threadId can hit a different topic after a concurrent reorder.
function marshal(v) {
  if (v === null) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  return { M: Object.fromEntries(Object.entries(v).filter(([,x]) => x !== undefined).map(([k,x]) => [k,marshal(x)])) };
}
function consolidateCacheChanges(changes, snapshot) {
  const grouped = new Map();
  const other = [];
  for (const c of changes) {
    if (c.op.table !== CACHE_TABLE) { other.push(c); continue; }
    const id = c.op.key.id.S;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(c);
  }
  return [...grouped.entries()].map(([id, edits]) => {
    const row = snapshot.cache.find(c => c.id === id);
    const items = row.items.map(it => ({ ...it }));
    for (const c of edits) items[Number(/\[(\d+)\]/.exec(c.op.update)[1])].threadId = c.op.values[':to'].S;
    return { desc: edits.map(c => c.desc).join(' ; '), op: { kind: 'ddb-update', table: CACHE_TABLE, key: { id: { S: id } }, update: `SET ${row.list} = :next`, cond: `${row.list} = :original`, values: { ':next': marshal(items), ':original': marshal(row.items) } } };
  }).concat(other);
}

// ── pure: planning (exported for tests) ──────────────────────────────────────

const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Lookback for an entry, as the agent builds it: same-day earlier generations, then the 7 prior
// days, newest first.
function lookbackFor(days, day, generationId) {
  const out = [];
  for (const e of (days[day] || []).slice().reverse()) if (String(e.generationId || '') < String(generationId || '')) out.push(e);
  for (let i = 1; i <= 7; i++) for (const e of (days[addDays(day, -i)] || []).slice().reverse()) out.push(e);
  return out;
}

// days: { 'YYYY-MM-DD': archive entries[] }. One row per archived topic since `since` that joined a
// thread already in its lookback under a different title (a re-run of the same title is not a join),
// or every row with `all`.
function listJoins(days, since, { all = false } = {}) {
  const rows = [];
  const norm = threading.normalizeTitle;
  for (const day of Object.keys(days).filter((d) => d >= since).sort()) {
    for (const e of days[day]) {
      const look = lookbackFor(days, day, e.generationId);
      const sameThread = look.filter((p) => p.threadId && p.threadId === e.threadId && norm(p.title) !== norm(e.title));
      if (!sameThread.length && !all) continue;
      let joined = null;
      for (const p of sameThread) { const s = threading.joinScore(e, p); if (!joined || s.score > joined.score) joined = { ...s, entry: p }; }
      const now = threading.joinRecord(e, look);
      rows.push({
        day, threadId: e.threadId, topicId: e.topicId, title: e.title,
        joinedTitle: joined ? joined.entry.title : null,
        score: joined ? joined.score : now.score, kwScore: joined ? joined.kwScore : now.kwScore,
        ruleNow: now.via, ruleAgrees: now.threadId === e.threadId,
      });
    }
  }
  return rows;
}

// A snapshot of every live record that names threads:
//   cache:      [{ id, list: 'entries'|'topics', items: [] }]   NewsCache archive#/today-archive/latest
//   topicRows:  [{ PK, SK, threadId }]                          SummarizeAndPredict TOPIC# rows
//   predRows:   [{ PK, SK, threadId }]                          GlobalPerspectivePredictionLog rows
//   pointers:   { threadId: item }                              THREAD#<id>/TOPICS
//   storyMap:   { pairs: { storyId: { threadId, topic_id } } } | null
//   situations: [{ key, state }]                                S3 situations/state/*.json
// A change is { desc, op } with op { kind: 'ddb-update', table, key, update, cond?, values } or
// { kind: 's3-put', key, body }.
function retag(snapshot, pick, to) {
  const changes = [];
  for (const c of snapshot.cache) {
    c.items.forEach((it, i) => {
      if (!pick(it.threadId, it.topicId || it.id)) return;
      changes.push({
        desc: `NewsCache ${c.id} ${c.list}[${i}].threadId ${it.threadId} -> ${to}  "${String(it.title || '').slice(0, 70)}"`,
        op: { kind: 'ddb-update', table: CACHE_TABLE, key: { id: { S: c.id } }, update: `SET ${c.list}[${i}].threadId = :to`, cond: `${c.list} = :original`, values: { ':to': { S: to }, ':original': marshal(c.items) } },
      });
    });
  }
  for (const [table, rows] of [[SUMMARY_TABLE, snapshot.topicRows], [PRED_TABLE, snapshot.predRows]]) {
    for (const r of rows) {
      const topicId = String(r.PK).replace(/^(TOPIC|PRED)#/, '');
      if (!pick(r.threadId, topicId)) continue;
      changes.push({
        desc: `${table} ${r.PK} / ${r.SK} threadId ${r.threadId} -> ${to}`,
        op: { kind: 'ddb-update', table, key: { PK: { S: r.PK }, SK: { S: r.SK } }, update: 'SET threadId = :to', cond: 'threadId = :from', values: { ':to': { S: to }, ':from': { S: r.threadId } } },
      });
    }
  }
  const pairs = snapshot.storyMap && snapshot.storyMap.pairs;
  if (pairs) {
    const moved = Object.entries(pairs).filter(([, p]) => pick(p.threadId, p.topic_id));
    if (moved.length) {
      const next = { ...snapshot.storyMap, pairs: { ...pairs } };
      for (const [sid, p] of moved) next.pairs[sid] = { ...p, threadId: to };
      changes.push({ desc: `S3 ${STORY_MAP_KEY} pairs ${moved.map(([sid]) => sid).join(', ')} threadId -> ${to}`, op: { kind: 's3-put', key: STORY_MAP_KEY, body: next } });
    }
  }
  return consolidateCacheChanges(changes, snapshot);
}

function planMerge(snapshot, from, into) {
  if (!from || !into || from === into) throw new Error('merge needs two different thread ids');
  if (snapshot.pointers[from]?.mergedInto || snapshot.pointers[into]?.mergedInto) throw new Error('resolve mergedInto aliases before merging');
  const changes = retag(snapshot, (tid) => tid === from, into);
  for (const s of snapshot.situations) {
    if (s.state.threadId !== from) continue;
    changes.push({ desc: `S3 ${SITUATION_STATE_PREFIX}${s.key} threadId ${from} -> ${into} (the tracker re-keys it next sweep, old id kept in aliases)`, op: { kind: 's3-put', key: `${SITUATION_STATE_PREFIX}${s.key}`, body: { ...s.state, threadId: into } } });
  }
  const fromPtr = snapshot.pointers[from];
  const ids = fromPtr && Array.isArray(fromPtr.topicIds) ? fromPtr.topicIds : [];
  if (ids.length) {
    changes.push({ desc: `SummarizeAndPredict THREAD#${into} / TOPICS ADD topicIds ${ids.length} from ${from}`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${into}` }, SK: { S: 'TOPICS' } }, update: 'SET threadId = :th ADD topicIds :ids', cond: 'attribute_not_exists(mergedInto)', values: { ':th': { S: into }, ':ids': { SS: ids } } } });
  }
  // The old pointer stays as an alias (old /weekly/thread/<from> links can resolve it).
  changes.push({ desc: `SummarizeAndPredict THREAD#${from} / TOPICS SET mergedInto = ${into}`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${from}` }, SK: { S: 'TOPICS' } }, update: 'SET threadId = :th, mergedInto = :into', cond: 'attribute_not_exists(mergedInto)', values: { ':th': { S: from }, ':into': { S: into } } } });
  return changes;
}

function repairSourcePointer(snapshot, source, moving) {
  const ptr = snapshot.pointers[source];
  if (!ptr?.topicId || !moving.has(ptr.topicId)) return [];
  const remaining = snapshot.cache.flatMap(c => c.items).filter(it => it.threadId === source && !moving.has(it.topicId || it.id))
    .sort((a,b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')))[0];
  if (!remaining) throw new Error('source pointer would become empty; use merge for a whole thread');
  return [{ desc: `SummarizeAndPredict THREAD#${source} / TOPICS replace moved current topic pointer`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${source}` }, SK: { S: 'TOPICS' } }, update: 'SET topicId = :nextTopic, title = :nextTitle', cond: 'topicId = :oldTopic', values: { ':nextTopic': { S: remaining.topicId || remaining.id }, ':nextTitle': { S: remaining.title || '' }, ':oldTopic': { S: ptr.topicId } } } }];
}

// The moved topics found a new thread, named (like any thread) from the founding title: the first
// moved topic's earliest archived title.
function planSplit(snapshot, threadId, topicIds) {
  if (!threadId || !topicIds.length) throw new Error('split needs a thread id and at least one topic id');
  const moving = new Set(topicIds);
  if (moving.size !== topicIds.length) throw new Error('duplicate topic ids');
  const present = new Set(snapshot.cache.flatMap(c => c.items).filter(it => it.threadId === threadId).map(it => it.topicId || it.id));
  if (topicIds.some(id => !present.has(id))) throw new Error('none of the topic ids or some topic ids are absent from the source thread');
  const founding = snapshot.cache.flatMap((c) => c.items).filter((it) => it.threadId === threadId && moving.has(it.topicId || it.id))
    .sort((a, b) => String(a.archivedAt || '').localeCompare(String(b.archivedAt || '')))[0];
  if (!founding) throw new Error(`none of the topic ids is on ${threadId}`);
  const newId = threading.generateThreadId(founding);
  if (newId === threadId) throw new Error(`${founding.title} is the thread's founding title; split the other topics out instead`);
  if (snapshot.cache.some(c => c.items.some(it => it.threadId === newId))) throw new Error('split destination already exists; inspect and merge explicitly');
  const changes = retag(snapshot, (tid, topicId) => tid === threadId && moving.has(topicId), newId);
  changes.push({ desc: `SummarizeAndPredict THREAD#${threadId} / TOPICS DELETE topicIds ${topicIds.join(', ')}`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${threadId}` }, SK: { S: 'TOPICS' } }, update: 'DELETE topicIds :ids', cond: 'attribute_not_exists(mergedInto)', values: { ':ids': { SS: topicIds } } } });
  changes.push({ desc: `SummarizeAndPredict THREAD#${newId} / TOPICS SET topicId ${founding.topicId || founding.id}, ADD topicIds ${topicIds.join(', ')}`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${newId}` }, SK: { S: 'TOPICS' } }, update: 'SET threadId = :th, topicId = :t, title = :ti ADD topicIds :ids', cond: 'attribute_not_exists(PK)', values: { ':th': { S: newId }, ':t': { S: founding.topicId || founding.id }, ':ti': { S: founding.title || '' }, ':ids': { SS: topicIds } } } });
  changes.push(...repairSourcePointer(snapshot, threadId, moving));
  return { newId, changes };
}

// Move only named members into an existing clean thread; avoids merging an unrelated arc.
function planMove(snapshot, from, into, topicIds) {
  if (!from || !into || from === into || !topicIds.length || new Set(topicIds).size !== topicIds.length) throw new Error('move needs different threads and unique topic ids');
  const present = new Set(snapshot.cache.flatMap(c => c.items).filter(it => it.threadId === from).map(it => it.topicId || it.id));
  if (topicIds.some(id => !present.has(id))) throw new Error('move topic ids absent from source');
  if (snapshot.pointers[from]?.mergedInto || snapshot.pointers[into]?.mergedInto) throw new Error('resolve mergedInto aliases first');
  const moving = new Set(topicIds);
  const changes = retag(snapshot, (tid,id) => tid === from && moving.has(id), into);
  changes.push({ desc: `SummarizeAndPredict THREAD#${into} / TOPICS ADD ${topicIds.length} selected members`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${into}` }, SK: { S: 'TOPICS' } }, update: 'ADD topicIds :ids', cond: 'attribute_exists(PK) AND attribute_not_exists(mergedInto)', values: { ':ids': { SS: topicIds } } } });
  changes.push({ desc: `SummarizeAndPredict THREAD#${from} / TOPICS remove ${topicIds.length} selected members`, op: { kind: 'ddb-update', table: SUMMARY_TABLE, key: { PK: { S: `THREAD#${from}` }, SK: { S: 'TOPICS' } }, update: 'DELETE topicIds :ids', cond: 'attribute_not_exists(mergedInto)', values: { ':ids': { SS: topicIds } } } });
  changes.push(...repairSourcePointer(snapshot, from, moving));
  return changes;
}

// ── I/O (AWS CLI) ────────────────────────────────────────────────────────────

function aws(args) {
  const out = execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return out.trim() ? JSON.parse(out) : null;
}

function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('SS' in av) return av.SS;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) { const o = {}; for (const k of Object.keys(av.M)) o[k] = unmarshal(av.M[k]); return o; }
  return null;
}
const item = (raw) => (raw ? unmarshal({ M: raw }) : null);

function getItem(table, key, projection) {
  const args = ['dynamodb', 'get-item', '--table-name', table, '--key', JSON.stringify(key)];
  if (projection) args.push('--projection-expression', projection);
  return item((aws(args) || {}).Item);
}

function scanAll(table, filter, values, projection) {
  const out = [];
  let token = null;
  do {
    const args = ['dynamodb', 'scan', '--page-size', '100', '--max-items', '100', '--table-name', table, '--filter-expression', filter, '--expression-attribute-values', JSON.stringify(values), '--projection-expression', projection];
    if (token) args.push('--starting-token', token);
    const page = aws(args);
    out.push(...(page.Items || []).map(item));
    token = page.NextToken || null;
  } while (token);
  return out;
}

function queryPk(table, pk, projection) {
  const page = aws(['dynamodb', 'query', '--page-size', '100', '--table-name', table, '--key-condition-expression', 'PK = :p', '--expression-attribute-values', JSON.stringify({ ':p': { S: pk } }), '--projection-expression', projection]);
  return (page.Items || []).map(item);
}

const objectEtags = new Map();
function s3Json(key) {
  const dir = mkdtempSync(join(tmpdir(), 'threads-read-'));
  const file = join(dir, 'body.json');
  try {
    const metadata = aws(['s3api', 'get-object', '--bucket', BUCKET, '--key', key, file]);
    objectEtags.set(key, metadata.ETag);
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (/NoSuchKey|Not Found|404/.test(String(e.stderr || e.message))) return null;
    throw e; // permission/transport failures must not silently omit affected stores
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function readArchiveDays(fromDay, toDay) {
  const days = {};
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) {
    const it = getItem(CACHE_TABLE, { id: { S: `archive#${d}` } }, 'entries');
    if (it && Array.isArray(it.entries)) days[d] = it.entries;
  }
  return days;
}

function readCache(daysBack) {
  const today = new Date().toISOString().slice(0, 10);
  const days = readArchiveDays(addDays(today, -daysBack), today);
  const cache = Object.entries(days).map(([d, items]) => ({ id: `archive#${d}`, list: 'entries', items }));
  const todayArchive = getItem(CACHE_TABLE, { id: { S: 'today-archive' } }, 'entries');
  if (todayArchive && Array.isArray(todayArchive.entries)) cache.push({ id: 'today-archive', list: 'entries', items: todayArchive.entries });
  const latest = getItem(CACHE_TABLE, { id: { S: 'latest' } }, 'topics');
  if (latest && Array.isArray(latest.topics)) cache.push({ id: 'latest', list: 'topics', items: latest.topics });
  return cache;
}

function readSituations() {
  const keys = [];
  let token = null;
  do {
    const args = ['s3api', 'list-objects-v2', '--page-size', '100', '--max-items', '100', '--bucket', BUCKET, '--prefix', SITUATION_STATE_PREFIX];
    if (token) args.push('--starting-token', token);
    const page = aws(args) || {};
    for (const o of page.Contents || []) if (o.Key.endsWith('.json')) keys.push(o.Key.slice(SITUATION_STATE_PREFIX.length));
    token = page.NextToken || null;
  } while (token);
  return keys.map((key) => ({ key, state: s3Json(`${SITUATION_STATE_PREFIX}${key}`) })).filter((s) => s.state);
}

function snapshotForMerge(from, daysBack, snapshotTarget) {
  const byThread = (table, prefix) => scanAll(table, 'threadId = :f' + (prefix ? ' AND begins_with(PK, :p)' : ''), { ':f': { S: from }, ...(prefix ? { ':p': { S: prefix } } : {}) }, 'PK, SK, threadId');
  return {
    cache: readCache(daysBack),
    topicRows: byThread(SUMMARY_TABLE, 'TOPIC#'),
    predRows: byThread(PRED_TABLE, null),
    pointers: Object.fromEntries([from, snapshotTarget].filter(Boolean).map(id => [id, getItem(SUMMARY_TABLE, { PK: { S: `THREAD#${id}` }, SK: { S: 'TOPICS' } })])),
    storyMap: s3Json(STORY_MAP_KEY),
    situations: readSituations(),
  };
}

function snapshotForSplit(topicIds, daysBack, sourceThread) {
  return {
    cache: readCache(daysBack),
    topicRows: topicIds.flatMap((id) => queryPk(SUMMARY_TABLE, `TOPIC#${id}`, 'PK, SK, threadId')),
    predRows: topicIds.flatMap((id) => queryPk(PRED_TABLE, `PRED#${id}`, 'PK, SK, threadId')),
    pointers: sourceThread ? { [sourceThread]: getItem(SUMMARY_TABLE, { PK: { S: `THREAD#${sourceThread}` }, SK: { S: 'TOPICS' } }) } : {},
    storyMap: s3Json(STORY_MAP_KEY),
    situations: [],
  };
}

function runChange({ op }) {
  if (op.kind === 'ddb-update') {
    const dir = mkdtempSync(join(tmpdir(), 'threads-values-'));
    const file = join(dir, 'values.json');
    writeFileSync(file, JSON.stringify(op.values));
    const args = ['dynamodb', 'update-item', '--table-name', op.table, '--key', JSON.stringify(op.key), '--update-expression', op.update, '--expression-attribute-values', `file://${file}`];
    if (op.cond) args.push('--condition-expression', op.cond);
    try { aws(args); } finally { rmSync(dir, { recursive: true, force: true }); }
  } else if (op.kind === 's3-put') {
    const file = join(mkdtempSync(join(tmpdir(), 'threads-')), 'body.json');
    writeFileSync(file, JSON.stringify(op.body));
    const etag = objectEtags.get(op.key);
    if (!etag) throw new Error(`No read ETag for ${op.key}; refusing write`);
    try { aws(['s3api', 'put-object', '--bucket', BUCKET, '--key', op.key, '--body', file, '--content-type', 'application/json', '--if-match', etag]); }
    finally { rmSync(join(file, '..'), { recursive: true, force: true }); }
  }
}

function report(changes, apply) {
  for (const c of changes) console.log(`  ${apply ? 'APPLY' : 'WOULD'} ${c.desc}`);
  console.log(`${changes.length} change(s).${apply ? '' : ' Nothing written; re-run with --apply (operator yes) to write.'}`);
  if (!apply) return;
  let ok = 0;
  for (const c of changes) {
    try { runChange(c); ok++; } catch (e) { throw new Error(`Stopped after ${ok}/${changes.length} changes: ${c.desc}: ${String(e.stderr || e.message).trim()}. Partial application; inspect before retry.`); }
  }
  console.log(`${ok}/${changes.length} applied.`);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--since', '--days', '--snapshot'].includes(rest[i - 1])));
  const apply = rest.includes('--apply');
  const snapshotFile = flag('--snapshot');
  if (snapshotFile && apply) throw new Error('--snapshot is print-only; --apply requires a fresh live snapshot');
  const offline = snapshotFile ? JSON.parse(readFileSync(snapshotFile, 'utf8')) : null;
  const daysBack = Number(flag('--days')) || 90;
  if (cmd === 'list-joins') {
    const since = flag('--since');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since || '')) throw new Error('list-joins needs --since YYYY-MM-DD');
    const days = readArchiveDays(addDays(since, -7), new Date().toISOString().slice(0, 10));
    const rows = listJoins(days, since, { all: rest.includes('--all') });
    for (const r of rows) {
      console.log(`${r.day}  score ${r.score.toFixed(2)}  kw ${r.kwScore.toFixed(2)}  rule now: ${r.ruleNow}${r.ruleAgrees ? '' : ' (DIFFERS)'}  ${r.threadId}`);
      console.log(`    topic : ${r.title}`);
      if (r.joinedTitle) console.log(`    joined: ${r.joinedTitle}`);
    }
    console.log(`${rows.length} row(s); ${rows.filter((r) => !r.ruleAgrees).length} the current rule would assign differently.`);
  } else if (cmd === 'merge') {
    const [from, into] = positional;
    report(planMerge(offline || snapshotForMerge(from, daysBack, into), from, into), apply);
    console.log(`Left as is: derived rows under THREAD#${from} (THREAD_ANALYSIS, THREAD_HISTORY#, DRIFT#, WEB); the daily jobs rebuild ${into}.`);
  } else if (cmd === 'move') {
    const [from, into, ...topicIds] = positional;
    const snap = offline || snapshotForSplit(topicIds, daysBack, from);
    if (!offline) {
      for (const id of [from, into]) snap.pointers[id] = getItem(SUMMARY_TABLE, { PK: { S: `THREAD#${id}` }, SK: { S: 'TOPICS' } });
      if (!snap.pointers[into]) throw new Error('move destination pointer does not exist');
    }
    report(planMove(snap, from, into, topicIds), apply);
    console.log('Situations and derived analyses require coordinator reconciliation.');
  } else if (cmd === 'split') {
    const [threadId, ...topicIds] = positional;
    const { newId, changes } = planSplit(offline || snapshotForSplit(topicIds, daysBack, threadId), threadId, topicIds);
    if (!offline && getItem(SUMMARY_TABLE, { PK: { S: `THREAD#${newId}` }, SK: { S: 'TOPICS' } })) throw new Error('split destination pointer already exists');
    console.log(`New thread: ${newId}`);
    report(changes, apply);
    console.log('Situations keep their latched threadId until the next story-map match.');
  } else {
    console.error('usage: threads.mjs list-joins --since YYYY-MM-DD [--all] | merge <from> <into> [--days N] [--apply] | split <threadId> <topicId...> [--days N] [--apply]');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}

export { listJoins, planMerge, planSplit, planMove, lookbackFor };
