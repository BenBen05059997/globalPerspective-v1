'use strict';
// Validates the golden-week fixture only (no Lambda code involved).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'fixtures', 'golden-week');
const SCHEMA = require('../../newsStoryRecord/schema/fact.schema.json');
const FROM = '2026-10-13';
const TO = '2026-10-19';

const types = (t) => (Array.isArray(t) ? t : [t]);
const typeOk = (v, t) => types(t).some((x) => (x === 'null' ? v === null : x === 'array' ? Array.isArray(v) : x === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : x === 'integer' ? Number.isInteger(v) : typeof v === x));

// Minimal check: required fields, type, const/enum and pattern of the envelope; kind-specific required payload fields.
function checkFact(f) {
  const errs = [];
  for (const k of SCHEMA.required) if (!(k in f)) errs.push(`missing ${k}`);
  for (const [k, def] of Object.entries(SCHEMA.properties)) {
    if (!(k in f)) continue;
    const v = f[k];
    if ('const' in def && v !== def.const) errs.push(`${k} != ${def.const}`);
    if (def.enum && !def.enum.includes(v)) errs.push(`${k} not in enum`);
    if (def.type && !typeOk(v, def.type)) errs.push(`${k} wrong type`);
    if (def.pattern && typeof v === 'string' && !new RegExp(def.pattern).test(v)) errs.push(`${k} pattern`);
  }
  for (const rule of SCHEMA.allOf) {
    if (rule.if.properties.kind.const !== f.kind) continue;
    for (const k of rule.then.required || []) if (!(k in f)) errs.push(`${f.kind}: missing ${k}`);
    const pr = rule.then.properties && rule.then.properties.payload;
    for (const k of (pr && pr.required) || []) if (!f.payload || !(k in f.payload)) errs.push(`${f.kind}: payload missing ${k}`);
  }
  return errs;
}

const files = fs.readdirSync(path.join(ROOT, 'facts')).filter((n) => n.endsWith('.jsonl')).sort();
const facts = [];
for (const n of files) {
  fs.readFileSync(path.join(ROOT, 'facts', n), 'utf8').split('\n').filter(Boolean).forEach((line, i) => facts.push({file: n, i, f: JSON.parse(line)}));
}

test('every line is a valid fact', () => {
  assert.ok(facts.length > 0);
  for (const {file, i, f} of facts) assert.deepEqual(checkFact(f), [], `${file}:${i + 1}`);
});

test('dates: file name equals fact date, nothing after the week, week is covered', () => {
  for (const {file, i, f} of facts) {
    assert.equal(f.date, file.replace('.jsonl', ''), `${file}:${i + 1}`);
    assert.ok(f.date <= TO, `${file}:${i + 1} after ${TO}`);
    assert.ok(f.at.slice(0, 10) <= TO || f.precision === 'exact', `${file}:${i + 1} at`);
  }
  assert.ok(facts.some((x) => x.f.date >= FROM && x.f.date <= TO));
});

test('stories.json and manifest.json agree with the facts; every story has a story_born or entry fact', () => {
  const {stories} = require(path.join(ROOT, 'stories.json'));
  const manifest = require(path.join(ROOT, 'manifest.json'));
  assert.equal(manifest.storyCount, stories.length);
  assert.equal(manifest.factLines, facts.length);
  assert.deepEqual(manifest.days, files.map((n) => n.replace('.jsonl', '')));
  const ids = new Set(stories.map((s) => s.threadId));
  assert.equal(ids.size, stories.length);
  for (const s of stories) {
    assert.ok(s.why && s.why.length, `${s.threadId} has no reason`);
    const own = facts.filter((x) => x.f.threadId === s.threadId);
    assert.ok(own.some((x) => x.f.kind === 'story_born' || x.f.kind === 'entry'), `${s.threadId} has no story_born or entry`);
    assert.ok(own.some((x) => x.f.date >= FROM && x.f.date <= TO), `${s.threadId} not active in the week`);
  }
  for (const {f} of facts) assert.ok(f.threadId === null || ids.has(f.threadId), `foreign story ${f.threadId}`);
});

test('fixture stays under 2 MB', () => {
  let size = 0;
  (function walk(d) { for (const e of fs.readdirSync(d, {withFileTypes: true})) e.isDirectory() ? walk(path.join(d, e.name)) : (size += fs.statSync(path.join(d, e.name)).size); })(ROOT);
  assert.ok(size < 2 * 1024 * 1024, `size ${size}`);
});
