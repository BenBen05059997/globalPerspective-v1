'use strict';
// The note schema of decision 0042 (backend/record/schema/note.schema.json): the example validates, and the rules that keep
// notes consistent (record IDs as subjects, the noteId form, an entry note's parts and citation) reject what breaks them.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {createRequire} = require('node:module');
const R = require('../src/_shared/record');

const requireFrontend = createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules', 'ajv/package.json'));
const Ajv = requireFrontend('ajv');
const ajv = new Ajv({allErrors: true, strict: false});
const load = (p) => JSON.parse(readFileSync(resolve(__dirname, '../../schema', p), 'utf8'));
const valid = ajv.compile(load('note.schema.json'));
const example = load('examples/note-entry.json');

test('the entry note example validates and its noteId is the shared noteId of its subject, part and time', () => {
  assert.equal(valid(example), true, JSON.stringify(valid.errors));
  assert.equal(example.noteId, R.noteId(example.subtype, example.subject.id, example.part, example.at));
});

test('a note breaking the consistency rules is rejected', () => {
  const bad = [
    {...example, subject: {kind: 'story', id: example.subject.id}}, // an entry note is about an entry
    {...example, part: 'analysis'}, // entry parts are summary, prediction, cause
    {...example, cites: []}, // an entry note cites its entry
    {...example, noteId: 'not-a-sha1'},
    {...example, iso3: ['Ukraine']}, // countries are ISO3 codes, never names
    {...example, payload: {format: 'markdown', content: 'x'}}, // the topicId is kept for tracing
    {...example, payload: {...example.payload, format: 'json'}}, // json content is an object, not text
    {...example, extra: 1}, // no fields outside the envelope
    {...example, subtype: 'brief', subject: {kind: 'brief', id: 'last week'}}, // brief subjects are daily:DATE or weekly:WEEK
  ];
  for (const n of bad) assert.equal(valid(n), false, JSON.stringify(n).slice(0, 120));
});

// The shared builder (backend/shared/src/notes.js) is what every writer uses: what it builds must pass the schema.
const N = require('../src/_shared/notes');
const {fakeS3} = require('./fake-s3');
const producer = {lambda: 'capture-entry-notes', runId: 'test-1'};
const topic = {title: 'US tech stocks fall sharply as AI spending nears $1 trillion', threadId: 'thread-us-tech-stocks-fall-sharply-as-200308', iso3: ['USA', 'CAN'],
  sources: [{url: 'https://www.cbc.ca/news/business/stocks-oct-30'}, {url: 'https://www.reuters.com/markets/us/tech-stocks'}]};
const item = (SK, content, extra = {}) => ({SK, content, contentFormat: SK === 'SUMMARY' ? 'markdown' : 'json', topicId: `${topic.title}-2`, threadId: topic.threadId,
  generatedAt: '2026-10-30T20:25:38.697Z', model: 'deepseek-flash', ...extra});

test('entryNote: each TOPIC# part becomes a schema-valid note about the entry fact, json parsed, ids the shared ones', () => {
  const {eventId} = R.entryIdentity({sources: topic.sources, date: '2026-10-30', title: topic.title});
  const notes = [item('SUMMARY', '- The Nasdaq fell about 3%.'), item('PREDICTION', '{"precedents":[]}', {model: 'deepseek-v4-pro', promptVersion: 3}), item('TRACE_CAUSE', '{"proximate":{}}')]
    .map((it) => N.entryNote({item: it, topic, archiveDate: '2026-10-30', producer}));
  for (const n of notes) assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(notes.map((n) => [n.part, n.payload.format, typeof n.payload.content, n.subject.id, n.cites[0]]), [
    ['summary', 'markdown', 'string', eventId, eventId], ['prediction', 'json', 'object', eventId, eventId], ['cause', 'json', 'object', eventId, eventId]]);
  assert.deepEqual([notes[1].promptVersion, notes[0].promptVersion, notes[0].iso3], ['3', null, ['CAN', 'USA']]);
  assert.equal(N.entryNote({item: item('SUMMARY', ''), topic, archiveDate: '2026-10-30', producer}), null); // no content: no note
  assert.equal(N.entryNote({item: item('OTHER', 'x'), topic, archiveDate: '2026-10-30', producer}), null);
});

test('buildNote refuses what the schema forbids: unknown subtype, a country name, a bad brief id, an entry note without a cite', () => {
  const base = {subtype: 'drift', subjectId: 'UKR', at: '2026-10-30T05:30:00Z', payload: {}, model: 'm', producer};
  assert.equal(valid(N.buildNote(base)), true, JSON.stringify(valid.errors));
  assert.throws(() => N.buildNote({...base, subtype: 'opinion'}), /unknown subtype/);
  assert.throws(() => N.buildNote({...base, iso3: ['Ukraine']}), /ISO3/);
  assert.throws(() => N.buildNote({...base, subtype: 'brief', subjectId: 'last week'}), /daily:DATE/);
  assert.throws(() => N.buildNote({...base, subtype: 'entry', subjectId: 'e1', part: 'summary'}), /cites its entry/);
});

test('the note writer registers the day, appends once per noteId, and keeps subtypes in their own files', async () => {
  const f = fakeS3();
  const w = N.makeNoteWriter({s3json: f.s3json, prefix: 'record/shadow/'});
  const n = N.entryNote({item: item('SUMMARY', 'x'), topic, archiveDate: '2026-10-30', producer});
  assert.deepEqual(await w.write('entry', [n, n]), {appended: 1, skipped: 1, days: ['2026-10-30']});
  assert.deepEqual(await w.write('entry', [n]), {appended: 0, skipped: 1, days: ['2026-10-30']});
  assert.deepEqual(f.json('record/shadow/notes/entry/manifest.json'), {schemaVersion: 1, days: ['2026-10-30']});
  assert.equal(f.lines('record/shadow/notes/entry/2026-10-30.jsonl').length, 1);
  await assert.rejects(() => w.write('drift', [n]), /entry note in a drift write/);
});
