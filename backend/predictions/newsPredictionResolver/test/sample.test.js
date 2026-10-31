'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const lib = require('../src/lib');
const { run } = require('../src/index');
const { fakeStore, predRow, fakeS3 } = require('./helpers');

const SEED = 'ab'.repeat(32);

function pool(n, clusters) {
  return Array.from({ length: n }, (_, i) => ({ qid: `q${i}`, clusterKey: `c${i % clusters}` }));
}

// independent implementation for the golden check
function golden(seed, p, K) {
  const h = (q) => crypto.createHash('sha256').update(seed + '|' + q).digest('hex');
  const best = {};
  for (const q of p) { const x = h(q.qid); if (!best[q.clusterKey] || x < best[q.clusterKey].h) best[q.clusterKey] = { qid: q.qid, h: x }; }
  return Object.values(best).sort((a, b) => (a.h < b.h ? -1 : 1)).slice(0, K).map((r) => r.qid);
}

test('golden: 600 questions over 90 stories match an independent implementation', () => {
  const p = pool(600, 90);
  assert.deepEqual(lib.draw(SEED, p, 22).picked.map((x) => x.qid), golden(SEED, p, 22));
});

test('one per story, K cap, never padded', () => {
  const r = lib.draw(SEED, pool(600, 90), 22);
  assert.equal(r.picked.length, 22);
  assert.equal(new Set(r.picked.map((x) => x.clusterKey)).size, 22);
  const few = lib.draw(SEED, pool(50, 5), 22);
  assert.equal(few.picked.length, 5);
  assert.equal(few.clusters, 5);
  assert.equal(few.eligible, 50);
});

test('deterministic; input order does not matter; a different seed differs', () => {
  const p = pool(300, 60);
  const a = lib.draw(SEED, p).picked.map((x) => x.qid);
  assert.deepEqual(a, lib.draw(SEED, [...p].reverse()).picked.map((x) => x.qid));
  assert.notDeepEqual(a, lib.draw('cd'.repeat(32), p).picked.map((x) => x.qid));
});

test('the commitment is sha256(seed)', () => {
  assert.equal(lib.commitOf(SEED), crypto.createHash('sha256').update(SEED).digest('hex'));
});

test('eligibility: question rows in the week, lead 7-90 days, no p is copied', () => {
  const rows = [
    predRow('a', '2026-10-06', 2, { lead: 30 }),
    predRow('b', '2026-10-06', 1, { lead: 5 }),   // too short
    predRow('c', '2026-10-06', 1, { lead: 120 }), // too long
    predRow('d', '2026-10-13', 1, { lead: 30 }),  // next week
  ];
  const el = lib.eligibleQuestions(rows, '2026-W41');
  assert.deepEqual(el.map((q) => q.qid), ['a-2026-10-06-0', 'a-2026-10-06-1']);
  assert.ok(el.every((q) => !('p' in q)));
  const edge = lib.eligibleQuestions([predRow('e', '2026-10-06', 1, { lead: 90 }), predRow('f', '2026-10-06', 1, { lead: 91 })], '2026-W41');
  assert.deepEqual(edge.map((q) => q.qid), ['e-2026-10-06-0']); // 0038: due 7-90 days
});

test('end to end: tick commits, then the Monday tick reveals and draws; SAMPLED rows carry no probability', async () => {
  const preds = [];
  for (let i = 0; i < 40; i++) preds.push(predRow(`t${i}`, `2026-10-0${5 + (i % 5)}`, 3));
  const store = fakeStore(preds);
  const mk = (iso) => ({ store, now: () => iso, llm: async () => ({}), draftModel: 'm' });
  await run({ action: 'tick' }, mk('2026-10-01T10:30:00.000Z'));
  const out = await run({ action: 'tick' }, mk('2026-10-12T10:30:00.000Z'));
  assert.equal(out.drawn.length, 1);
  assert.equal(out.drawn[0].picked, 22);
  const draw = await store.get('SAMPLE#2026-W41', 'DRAW');
  const reveal = await store.get('SEED#2026-W41', 'REVEAL');
  const commit = await store.get('SEED#2026-W41', 'COMMIT');
  assert.equal(lib.commitOf(reveal.seedHex), commit.commitHash);
  // anyone can recompute from the published pool
  const again = lib.draw(reveal.seedHex, draw.pool.map((x) => ({ qid: x.q, clusterKey: x.c })), draw.K);
  assert.deepEqual(again.picked, draw.picked);
  const sampled = [...store.rows.values()].filter((r) => r.SK === 'SAMPLED');
  assert.equal(sampled.length, 22);
  for (const s of sampled) assert.ok(!('p' in s) && !('probability' in s), 'SAMPLED must not carry p');
  // second draw attempt changes nothing (immutable)
  const n = store.rows.size;
  await run({ action: 'draw', weekId: '2026-W41' }, mk('2026-10-14T10:30:00.000Z'));
  assert.equal([...store.rows.values()].filter((r) => r.SK === 'SAMPLED').length, 22);
  assert.ok(store.rows.size >= n);
});

test('a missing seed secret is reported, and a new seed is never invented for a committed week', async () => {
  const store = fakeStore([predRow('t', '2026-10-06', 1)]);
  const mk = (iso) => ({ store, now: () => iso, llm: async () => ({}), draftModel: 'm' });
  await run({ action: 'tick' }, mk('2026-10-01T10:30:00.000Z'));
  store.rows.delete('SEED#2026-W41\u0000SECRET');
  const out = await run({ action: 'draw', weekId: '2026-W41' }, mk('2026-10-13T10:30:00.000Z'));
  assert.equal(out.drawn.length, 0);
  assert.match(out.errors[0], /secret missing/);
  assert.equal(await store.get('SAMPLE#2026-W41', 'DRAW'), null);
});

test('golden fixture shared with the frontend "Verify this draw" (byte-identical copy, guarded)', () => {
  const g = require('./fixtures/sampleRuleGolden.json');
  const r = lib.draw(g.seedHex, g.pool.map((x) => ({ qid: x.q, clusterKey: x.c })), g.K);
  assert.deepEqual(r.picked, g.picked);
  assert.equal(lib.commitOf(g.seedHex), g.commitHash);
  assert.equal(r.eligible, g.eligible);
  assert.equal(r.clusters, g.clusters);
});

test('new sampled questions keep the PRED threadId, with legacy null and unchanged clusterKey',async()=>{
 const modern=predRow('modern','2026-10-06',1);modern.threadId='thread-canonical';
 const legacy=predRow('legacy','2026-10-06',1);delete legacy.threadId;
 const store=fakeStore([modern,legacy]);
 const deps=iso=>({store,now:()=>iso,llm:async()=>({}),draftModel:'m'});
 await run({action:'tick'},deps('2026-10-01T10:30:00Z'));
 await run({action:'draw',weekId:'2026-W41'},deps('2026-10-12T10:30:00Z'));
 const sampled=[...store.rows.values()].filter(r=>r.SK==='SAMPLED');
 assert.equal(sampled.length,2);
 assert.equal(sampled.find(r=>r.pk===modern.PK).threadId,'thread-canonical');
 assert.equal(sampled.find(r=>r.pk===modern.PK).clusterKey,'thread-canonical');
 assert.equal(sampled.find(r=>r.pk===legacy.PK).threadId,null);
 assert.equal(sampled.find(r=>r.pk===legacy.PK).clusterKey,legacy.topicId);
 assert.ok(sampled.every(r=>!('p' in r)&&!('probability' in r)));
});

// ---- record/inbox/draws (decision 0043) ----
test('tick appends one commit line per new week to the draws inbox; the Monday draw appends the draw line with the revealed seed and the picks', async () => {
  const preds = [];
  for (let i = 0; i < 30; i++) preds.push(predRow(`t${i}`, `2026-10-0${5 + (i % 5)}`, 3));
  const store = fakeStore(preds);
  const s3 = fakeS3();
  const mk = (iso, extra = {}) => ({ store, inbox: s3.s3json, now: () => iso, llm: async () => ({}), draftModel: 'm', ...extra });
  await run({ action: 'tick' }, mk('2026-10-01T10:30:00.000Z'));
  const first = s3.lines('record/inbox/draws/2026-10-01.jsonl');
  const commit = await store.get('SEED#2026-W41', 'COMMIT');
  assert.deepEqual(first.map((l) => [l.type, l.weekId]), [['commit', '2026-W41'], ['commit', '2026-W42']]);
  assert.deepEqual(first[0], {
    schemaVersion: 1, type: 'commit', weekId: '2026-W41', weekStart: '2026-10-05', weekEnd: '2026-10-11', commitHash: commit.commitHash, rule: 'v1',
    committedAt: '2026-10-01T10:30:00.000Z', sourceKey: 'inbox:draws/2026-10-01#1',
  });
  await run({ action: 'tick' }, mk('2026-10-01T11:30:00.000Z')); // known weeks again: no new line
  assert.equal(s3.lines('record/inbox/draws/2026-10-01.jsonl').length, 2);
  await run({ action: 'tick' }, mk('2026-10-12T10:30:00.000Z'));
  const day = s3.lines('record/inbox/draws/2026-10-12.jsonl');
  const draw = day.find((l) => l.type === 'draw');
  const row = await store.get('SAMPLE#2026-W41', 'DRAW');
  const reveal = await store.get('SEED#2026-W41', 'REVEAL');
  assert.deepEqual([draw.weekId, draw.rule, draw.K, draw.eligible, draw.clusters, draw.seedHex, draw.drawnAt], ['2026-W41', 'v1', 22, row.eligible, row.clusters, reveal.seedHex, row.drawnAt]);
  assert.deepEqual(draw.picked, row.picked.map((p) => ({ qid: p.qid, hash: p.h, clusterKey: p.clusterKey })));
  assert.equal(lib.commitOf(draw.seedHex), commit.commitHash);
  await run({ action: 'draw', weekId: '2026-W41' }, mk('2026-10-13T10:30:00.000Z')); // already drawn: nothing new
  assert.equal(s3.lines('record/inbox/draws/2026-10-13.jsonl').length, 0);
});

test('draws inbox: shadow prefix, dry run writes nothing, a failed append is reported and the rows stay', async () => {
  const store = fakeStore([predRow('t', '2026-10-06', 1)]);
  const s3 = fakeS3();
  await run({ action: 'tick', shadow: true }, { store, inbox: s3.s3json, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
  assert.deepEqual([...s3.objects.keys()], ['record/shadow/inbox/draws/2026-10-01.jsonl']);
  const dry = fakeS3();
  await run({ action: 'tick', dryRun: true }, { store: fakeStore([]), inbox: dry.s3json, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
  assert.equal(dry.objects.size, 0);
  const bad = fakeStore([]);
  const out = await run({ action: 'tick' }, { store: bad, inbox: { async getLines() { throw new Error('AccessDenied'); } }, now: () => '2026-10-01T10:30:00.000Z', llm: async () => ({}), draftModel: 'm' });
  assert.ok(await bad.get('SEED#2026-W41', 'COMMIT'));
  assert.match(out.errors[0], /commit inbox line not written/);
});
