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
    {...example, payload: {text: 'x'}}, // the topicId is kept for tracing
    {...example, extra: 1}, // no fields outside the envelope
    {...example, subtype: 'brief', subject: {kind: 'brief', id: 'last week'}}, // brief subjects are daily:DATE or weekly:WEEK
  ];
  for (const n of bad) assert.equal(valid(n), false, JSON.stringify(n).slice(0, 120));
});
