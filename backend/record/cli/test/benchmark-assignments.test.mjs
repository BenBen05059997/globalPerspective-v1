import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {articleIndex, survivorOf, buildAssignments, main} from '../benchmark-assignments.mjs';

const require = createRequire(import.meta.url);
const R = require('../../newsStoryRecord/src/_shared/record.js');
const AT = '2026-10-24T12:00:00.000Z';
const line = (url) => ({rawId: R.sha1(url), url, canonicalUrl: url, title: `T ${url}`, outlet: 'X', fetchedAt: '2026-09-20T00:00:00.000Z', publishedAt: null, recoveredFrom: 'gdelt-gkg'});
const U = ['https://a.test/1', 'https://a.test/2', 'https://a.test/3'];
const id12 = (url) => R.sha1(url).slice(0, 12);
const evt = (url) => R.sha1(`article${url}`);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-'));
  fs.mkdirSync(path.join(dir, 'inbox'));
  fs.writeFileSync(path.join(dir, 'inbox', '2026-09-20.jsonl'), U.map((u) => JSON.stringify(line(u))).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'T1-s1.json'), JSON.stringify([
    {threadId: 'thread-a', continues: [{id: id12(U[0]), why: 'follow-on act'}, {id: 'deadbeef0000', why: 'not in inbox'}]},
    {threadId: 'thread-old', continues: [{id: id12(U[1]), why: 'same rift'}]},
    {threadId: 'thread-empty', continues: []},
  ]));
  fs.writeFileSync(path.join(dir, 'T1-s2.json'), JSON.stringify([{threadId: 'thread-b', continues: [{id: id12(U[1]), why: 'also this'}]}]));
  fs.writeFileSync(path.join(dir, 'merges.jsonl'), '{"from":"thread-old","into":"thread-mid"}\n{"from":"thread-mid","into":"thread-new"}\n');
  return dir;
}

test('articleIndex maps the first 12 chars of rawId to the article fact eventId', () => {
  const dir = fixture();
  const {index, lines, rejected} = articleIndex(path.join(dir, 'inbox'));
  assert.deepEqual([lines, rejected, index.size], [3, 0, 3]);
  assert.equal(index.get(id12(U[0])), evt(U[0]));
});

test('survivorOf follows a merge chain and survives a cycle', () => {
  const s = survivorOf([{from: 'a', into: 'b'}, {from: 'b', into: 'c'}]);
  assert.deepEqual([s('a'), s('c'), s('z')], ['c', 'c', 'z']);
  assert.ok(['x', 'y'].includes(survivorOf([{from: 'x', into: 'y'}, {from: 'y', into: 'x'}])('x')));
});

test('buildAssignments: lines go to the survivor, with the reason suffix; unmapped ids and conflicting citations are reported', () => {
  const dir = fixture();
  const {index} = articleIndex(path.join(dir, 'inbox'));
  const t1 = [...JSON.parse(fs.readFileSync(path.join(dir, 'T1-s1.json'))), ...JSON.parse(fs.readFileSync(path.join(dir, 'T1-s2.json')))];
  const r = buildAssignments(t1, index, {survivor: survivorOf([{from: 'thread-old', into: 'thread-new'}]), at: AT});
  assert.deepEqual(r.lines, [
    {entryId: evt(U[0]), threadId: 'thread-a', by: 'operator', at: AT, reason: 'follow-on act (gap benchmark 2026-10-24)'},
    {entryId: evt(U[1]), threadId: 'thread-new', by: 'operator', at: AT, reason: 'same rift (gap benchmark 2026-10-24)'},
  ]);
  assert.deepEqual(r.unmapped, [{id: 'deadbeef0000', threadId: 'thread-a'}]);
  assert.deepEqual(r.conflicts, [{id: id12(U[1]), kept: 'thread-new', dropped: 'thread-b'}]);
});

test('main writes the JSONL file, expands T1-s*.json, and each line is a valid inbox assignment', () => {
  const dir = fixture();
  const out = path.join(dir, 'out.jsonl');
  const {inboxAssignmentFact} = require('../../newsStoryRecord/src/facts.js');
  const log = console.log; console.log = () => {};
  try { main(['--t1', path.join(dir, 'T1-s*.json'), '--inbox-dir', path.join(dir, 'inbox'), '--merges', path.join(dir, 'merges.jsonl'), '--at', AT, '--out', out]); } finally { console.log = log; }
  const lines = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].threadId, 'thread-new'); // thread-old -> thread-mid -> thread-new
  for (const l of lines) assert.equal(inboxAssignmentFact(l, 'r').kind, 'assignment');
});
