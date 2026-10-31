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
    {...example, subtype: 'daily_brief', subject: {kind: 'brief', id: 'last week'}}, // brief subjects are daily:DATE or weekly:DATE
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
  const base = {subtype: 'country', subjectId: 'UKR', at: '2026-10-30T05:30:00Z', iso3: ['UKR'],
    payload: {countryName: 'Ukraine', bluf: 'b', keyDevelopments: [], whyItMatters: 'w', trajectory: 'stable', riskLevel: 'high', riskScore: 70}, model: 'm', producer};
  assert.equal(valid(N.buildNote(base)), true, JSON.stringify(valid.errors));
  assert.throws(() => N.buildNote({...base, subtype: 'opinion'}), /unknown subtype/);
  assert.throws(() => N.buildNote({...base, iso3: ['Ukraine']}), /ISO3/);
  assert.throws(() => N.buildNote({...base, subtype: 'daily_brief', subjectId: 'last week'}), /daily:DATE/);
  assert.throws(() => N.buildNote({...base, subtype: 'weekly_brief', subjectId: 'weekly:2026-W43'}), /weekly:DATE/);
  assert.throws(() => N.buildNote({...base, subtype: 'brief', subjectId: 'daily:2026-10-30'}), /unknown subtype/);
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

// story_analysis and drift (decision 0042 step 2): the examples were built by the real builders from the stored item shapes.
const storyEx = load('examples/note-story_analysis.json');
const driftEx = load('examples/note-drift.json');

test('the story_analysis and drift examples validate and carry the shared noteId', () => {
  for (const ex of [storyEx, driftEx]) {
    assert.equal(valid(ex), true, JSON.stringify(valid.errors));
    assert.equal(ex.noteId, R.noteId(ex.subtype, ex.subject.id, ex.part, ex.at));
  }
  assert.deepEqual([storyEx.subject, storyEx.part, storyEx.threadId], [{kind: 'story', id: storyEx.threadId}, '', storyEx.threadId]);
  assert.deepEqual([driftEx.subject, driftEx.iso3], [{kind: 'country', id: 'IRN'}, ['IRN']]);
});

test('story_analysis and drift notes breaking their rules are rejected', () => {
  const sp = storyEx.payload;
  const dp = driftEx.payload;
  const {storyArc, ...noArc} = sp;
  const {whyChanged, ...noWhy} = dp;
  const bad = [
    {...storyEx, subject: {kind: 'country', id: storyEx.subject.id}}, // a story analysis is about a story
    {...storyEx, part: 'analysis'}, // one text, part ''
    {...storyEx, payload: noArc},
    {...storyEx, payload: {...sp, extra: 1}},
    {...storyEx, payload: {...sp, entryCount: '2'}},
    {...driftEx, subject: {kind: 'country', id: 'Iran'}}, // countries are ISO3, never names
    {...driftEx, iso3: []},
    {...driftEx, payload: noWhy},
    {...driftEx, payload: {...dp, extra: 1}},
    {...driftEx, payload: {...dp, noSingleDriver: 'no'}},
  ];
  for (const n of bad) assert.equal(valid(n), false, JSON.stringify(n).slice(0, 120));
});

test('storyAnalysisNote and driftNote: payload as stored, ids from the shared helpers, cites = the entries the analysis was built from', () => {
  const entries = [
    {topicId: 'a-1', date: '2026-10-29', title: 'A', sources: [{url: 'https://www.reuters.com/a'}]},
    {topicId: 'b-1', date: '2026-10-30', title: 'B', sources: []}, // no usable url: title basis, still deterministic
    {topicId: 'old-1', date: '2026-09-01', title: 'Old', sources: [{url: 'https://www.bbc.com/old'}]}, // not in entryTopicIds (beyond the stored 50)
  ];
  const item = {PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', threadId: 't1', ttl: 1, iso3: ['UKR'], generatedAt: '2026-10-30T04:41:12.318Z', model: 'deepseek-flash',
    threadTitle: 'T', storyArc: 'S', entryShortTitles: [], trajectory: null, rootCauseChain: null, watchQuestions: [], inflectionTopicId: null,
    riskScore: null, dimensions: {}, lead: null, sentiment: null, keyActors: [], entryCount: 3, entryTopicIds: ['a-1', 'b-1'], latencyMs: 5};
  const n = N.storyAnalysisNote({item, entries, producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(n.cites, entries.slice(0, 2).map((e) => R.entryIdentity({sources: e.sources, date: e.date, title: e.title}).eventId));
  assert.deepEqual(Object.keys(n.payload).sort(), ['dimensions', 'entryCount', 'entryShortTitles', 'entryTopicIds', 'inflectionTopicId', 'keyActors', 'latencyMs', 'lead',
    'riskScore', 'rootCauseChain', 'sentiment', 'storyArc', 'threadTitle', 'trajectory', 'watchQuestions']);
  assert.equal(N.storyAnalysisNote({item: null, entries, producer}), null);

  const d = N.driftNote({iso3: 'UKR', model: 'm', producer, item: {countryName: 'Ukraine', asOf: '2026-10-30', since: '2026-10-29', changeScore: {from: 1, to: 2, delta: 1},
    currentRiskScore: 2, whyChanged: 'x', noSingleDriver: true, triggerEvent: undefined, generatedAt: '2026-10-30T05:30:00.000Z'}});
  assert.equal(valid(d), true, JSON.stringify(valid.errors));
  assert.equal(d.threadId, null); // no trigger story stored
  assert.equal('triggerEvent' in d.payload, false);
});

test('archive copies (backfill): one note per stored ai text, format text, model null, marked from archive, schema-valid', () => {
  const entry = {title: topic.title, threadId: topic.threadId, iso3: ['USA'], sources: topic.sources, topicId: `${topic.title}-2`, archivedAt: '2026-10-10T12:26:00.000Z',
    ai: {summary: '- Cut text...', prediction: '{\n  "scenarios": [ ...', trace_cause: null}};
  const notes = N.archiveEntryNotes({entry, archiveDate: '2026-10-10', producer});
  for (const n of notes) assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(notes.map((n) => [n.part, n.payload.format, n.payload.from, n.model, n.at]), [
    ['summary', 'text', 'archive', null, '2026-10-10T12:26:00.000Z'], ['prediction', 'text', 'archive', null, '2026-10-10T12:26:00.000Z']]);
  assert.equal(notes[0].subject.id, R.entryIdentity({sources: topic.sources, date: '2026-10-10', title: topic.title}).eventId);
  assert.deepEqual(N.archiveEntryNotes({entry: {...entry, ai: null}, archiveDate: '2026-10-10', producer}), []);
  // model null is allowed only on an archive copy; a text note must say it is one
  assert.throws(() => N.buildNote({subtype: 'entry', subjectId: 'e', part: 'summary', at: entry.archivedAt, payload: {format: 'markdown', content: 'x', topicId: 't'}, cites: ['e'], model: null, producer}), /model is required/);
  assert.equal(valid({...notes[0], payload: {format: 'text', content: 'x', topicId: 't'}}), false);
});

test('drift archive copies (backfill from DRIFTLOG#): payload.from archive with model null is valid; a null model without the mark throws', () => {
  const item = {countryName: 'Ukraine', asOf: '2026-10-30', since: '2026-10-29', changeScore: {from: 1, to: 2, delta: 1}, currentRiskScore: 2, whyChanged: 'x',
    noSingleDriver: true, generatedAt: '2026-10-30T05:30:00.000Z'};
  const n = N.driftNote({iso3: 'UKR', model: null, producer, item: {...item, from: 'archive'}});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual([n.model, n.payload.from], [null, 'archive']);
  assert.throws(() => N.driftNote({iso3: 'UKR', model: null, producer, item}), /model is required/);
  assert.equal(valid({...n, payload: {...n.payload, from: 'elsewhere'}}), false);
});

// country and link (decision 0042 steps 3-4): the examples were built by the real builders from live items.
const countryEx = load('examples/note-country.json');
const linkEx = load('examples/note-link.json');

test('the country and link examples validate and carry the shared noteId', () => {
  for (const ex of [countryEx, linkEx]) {
    assert.equal(valid(ex), true, JSON.stringify(valid.errors));
    assert.equal(ex.noteId, R.noteId(ex.subtype, ex.subject.id, ex.part, ex.at));
  }
  assert.deepEqual([countryEx.subject, countryEx.part, countryEx.iso3, countryEx.threadId], [{kind: 'country', id: 'JPN'}, '', ['JPN'], null]);
  assert.deepEqual([linkEx.subject.kind, linkEx.subject.id, linkEx.part, linkEx.threadId], ['pair', R.pairKey(linkEx.payload.from, linkEx.payload.to), 'JPN', null]);
});

test('country and link notes breaking their rules are rejected', () => {
  const cp = countryEx.payload;
  const lp = linkEx.payload;
  const {bluf, ...noBluf} = cp;
  const {mechanism, ...noMechanism} = lp;
  const bad = [
    {...countryEx, subject: {kind: 'country', id: 'Japan'}}, // countries are ISO3, never names
    {...countryEx, subject: {kind: 'story', id: 'JPN'}},
    {...countryEx, part: 'systems'}, // one text per country; the web nodes are not a country part
    {...countryEx, iso3: []},
    {...countryEx, model: null}, // null only on a history copy
    {...countryEx, payload: noBluf}, // a full briefing has its bluf
    {...countryEx, payload: {...cp, extra: 1}},
    {...countryEx, payload: {...cp, riskScore: '72'}},
    {...countryEx, payload: {countryName: 'Japan', riskLevel: 'high', riskScore: 70, trajectory: 'stable', from: 'archive'}},
    {...linkEx, subject: {kind: 'story', id: linkEx.subject.id}}, // a link is about a pair
    {...linkEx, subject: {kind: 'pair', id: 'one-thread'}}, // pairKey(a, b)
    {...linkEx, part: ''}, // the part is the web's country
    {...linkEx, part: 'Japan'},
    {...linkEx, threadId: linkEx.payload.from}, // a pair has no single story
    {...linkEx, iso3: []},
    {...linkEx, model: null}, // null only on a web-history copy
    {...linkEx, payload: noMechanism},
    {...linkEx, payload: {...lp, confidence: 'certain'}},
    {...linkEx, payload: {...lp, lagDays: 1.5}},
    {...linkEx, payload: {...lp, cited: [{date: '2026-10-02'}]}},
    {...linkEx, payload: {...lp, extra: 1}},
  ];
  for (const n of bad) assert.equal(valid(n), false, JSON.stringify(n).slice(0, 160));
});

test('countryNote and countryHistoryNote: the briefing as stored (minus keys, ttl, envelope); an older day is a reduced history copy with model null', () => {
  const item = {PK: 'COUNTRY#Japan', SK: 'COUNTRY_INTELLIGENCE', ttl: 1, countryName: 'Japan', headline: 'H', bluf: 'B', keyDevelopments: [{date: '2026-10-25', text: 't'}],
    whyItMatters: 'W', situationSummary: null, backgroundTimeline: [], crossThreadInsight: null, trajectory: 'stable', trajectoryDetail: null, riskSignals: [],
    riskLevel: 'moderate', riskScore: 40, dimensions: {}, lead: 'political', keyActors: [], dominantCategory: 'society', categories: {society: 1}, totalArticles: 1,
    activeArcCount: 1, dateRange: {from: '2026-10-25', to: '2026-10-25'}, dayCount: 1, generatedAt: '2026-10-26T05:15:44.865Z', model: 'deepseek-v4-pro', latencyMs: 9};
  const n = N.countryNote({item, iso3: 'JPN', producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual([n.at, n.date, n.model, n.threadId, n.cites], ['2026-10-26T05:15:44.865Z', '2026-10-26', 'deepseek-v4-pro', null, []]);
  for (const k of ['PK', 'SK', 'ttl', 'generatedAt', 'model']) assert.equal(k in n.payload, false, k);
  assert.equal(n.payload.situationSummary, null); // a stored null stays null
  assert.equal(N.countryNote({item: null, iso3: 'JPN', producer}), null);
  assert.throws(() => N.countryNote({item, iso3: undefined, producer}), /needs a subject id/);

  const row = {PK: 'COUNTRY#Japan', SK: 'HISTORY#2026-09-01', countryName: 'Japan', dateKey: '2026-09-01', riskLevel: 'high', riskScore: 70, trajectory: 'escalating',
    headline: 'H', dimensions: {conflict: {score: 70, why: 'w'}}, lead: 'conflict', generatedAt: '2026-09-01T05:16:00.000Z', ttl: 2};
  const h = N.countryHistoryNote({item: row, iso3: 'JPN', producer});
  assert.equal(valid(h), true, JSON.stringify(valid.errors));
  assert.deepEqual([h.model, h.payload.from, h.part, 'dateKey' in h.payload], [null, 'history', '', false]);
  assert.equal(valid({...h, model: 'm'}), false); // a copy has no model
  const {dimensions, lead, ...old} = row; // rows older than the risk dimensions
  assert.equal(valid(N.countryHistoryNote({item: old, iso3: 'JPN', producer})), true);
});

test('linkNote: one note per edge, subject pairKey whichever way it points, part = the web country, cites = eventIds of the cited entries it can find', () => {
  const entries = [
    {topicId: 'A-1', date: '2026-10-02', title: 'A', sources: [{url: 'https://www.reuters.com/a'}]},
    {topicId: 'B-1', date: '2026-10-03', title: 'B', sources: []},
  ];
  const eventIds = N.entryEventIdIndex(entries);
  const edge = {from: 'thread-b', to: 'thread-a', mechanism: 'm', lagDays: -1, confidence: 'weak', class: 'causal', relation: 'inferred_influence',
    cited: [{topicId: 'A-1', date: '2026-10-02', title: 'A'}, {topicId: 'B-1', date: '2026-10-03', title: 'B'}, {topicId: 'gone-1', date: '2026-10-03', title: 'G'}],
    citedEntries: ['A-1', 'B-1', 'gone-1']};
  const at = '2026-10-30T05:02:09.564Z';
  const n = N.linkNote({edge, countryName: 'Japan', iso3: 'JPN', at, model: 'deepseek-v4-pro', eventIds, producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual([n.subject, n.part, n.iso3, n.threadId, n.at], [{kind: 'pair', id: 'thread-a__thread-b'}, 'JPN', ['JPN'], null, at]);
  assert.deepEqual(n.cites, entries.map((e) => R.entryIdentity({sources: e.sources, date: e.date, title: e.title}).eventId)); // the unknown cite is left out
  assert.deepEqual(Object.keys(n.payload).sort(), ['cited', 'confidence', 'country', 'from', 'lagDays', 'mechanism', 'to']);
  assert.deepEqual([n.payload.from, n.payload.to, n.payload.lagDays], ['thread-b', 'thread-a', -1]); // direction kept in the payload
  // an old edge with only citedEntries; the reverse direction is the same pair
  const old = N.linkNote({edge: {from: 'thread-a', to: 'thread-b', mechanism: 'm', lagDays: 2, confidence: 'strong', citedEntries: ['A-1']}, countryName: 'Japan', iso3: 'JPN', at, model: 'm', producer});
  assert.equal(valid(old), true, JSON.stringify(valid.errors));
  assert.deepEqual([old.subject.id, old.payload.cited, old.cites], ['thread-a__thread-b', [{topicId: 'A-1'}], []]);
  // a copy rebuilt from the dated web history has no model, and says so
  const copy = N.linkNote({edge, countryName: 'Japan', iso3: 'JPN', at, model: null, producer});
  assert.equal(valid(copy), true, JSON.stringify(valid.errors));
  assert.deepEqual([copy.model, copy.payload.source], [null, 'web-history']);
  const {source, ...noSource} = copy.payload;
  assert.equal(valid({...copy, payload: noSource}), false);
  assert.equal(N.linkNote({edge: {...edge, to: 'thread-b'}, countryName: 'Japan', iso3: 'JPN', at, model: 'm', producer}), null); // a self-loop is no pair
  assert.throws(() => N.linkNote({edge, countryName: 'Japan', iso3: 'Japan', at, model: 'm', producer}), /ISO3/);
});

// story-level drift (the story page's "what changed" line): the same drift subtype and file, subject kind story.
const storyDriftEx = load('examples/note-drift-story.json');

test('storyDriftNote: the example validates; subject and thread are the story; the stored fields are the payload; an archive copy has model null', () => {
  assert.equal(valid(storyDriftEx), true, JSON.stringify(valid.errors));
  assert.equal(storyDriftEx.noteId, R.noteId('drift', storyDriftEx.subject.id, '', storyDriftEx.at));
  assert.deepEqual([storyDriftEx.subject.kind, storyDriftEx.threadId, storyDriftEx.iso3], ['story', storyDriftEx.subject.id, []]);
  const item = {threadId: 'thread-x', asOf: '2026-10-11', since: '2026-10-10', changeScore: {from: 70, to: 75, delta: 5}, priorTitle: 'a', currentTitle: 'b',
    whyChanged: 'Because.', noSingleDriver: true, directionFlag: {kinds: ['axisEffect']}, PK: 'THREAD#thread-x', SK: 'DRIFT#2026-10-11', ttl: 1, generatedAt: '2026-10-11T05:30:00.000Z'};
  const n = N.storyDriftNote({item, threadId: 'thread-x', model: 'deepseek-flash', producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(Object.keys(n.payload).sort(), ['asOf', 'changeScore', 'currentTitle', 'directionFlag', 'noSingleDriver', 'priorTitle', 'since', 'threadId', 'whyChanged']);
  const copy = N.storyDriftNote({item: {...item, from: 'archive'}, threadId: 'thread-x', model: null, producer});
  assert.equal(valid(copy), true, JSON.stringify(valid.errors));
  assert.equal(N.storyDriftNote({item, threadId: 'thread-x', model: 'm', iso3: ['IND'], producer}).iso3[0], 'IND');
  assert.throws(() => N.storyDriftNote({item, threadId: 'thread-x', model: null, producer}), /model/);
  assert.equal(valid({...storyDriftEx, threadId: null}), false); // the story is the thread
  assert.equal(valid({...storyDriftEx, subject: {kind: 'pair', id: storyDriftEx.subject.id}}), false);
  assert.equal(valid({...storyDriftEx, payload: {...storyDriftEx.payload, countryName: 'India'}}), false); // a story payload has no country fields
  assert.equal(valid({...driftEx, subject: {kind: 'story', id: 'thread-x'}}), false); // a country payload is not a story's
  assert.equal(valid({...countryEx, subject: {kind: 'story', id: 'thread-x'}}), false);
});

// web notes: one per SYSTEMS# country web, so a web with no edge (no link note) and its shared-actor backbone are in the record
const webEx = load('examples/note-web.json');

test('webNote: the example validates; nodes with or without an edge, the backbone as stored; a history copy has model null; a bad one is refused', () => {
  assert.equal(valid(webEx), true, JSON.stringify(valid.errors));
  assert.equal(webEx.noteId, R.noteId('web', webEx.subject.id, '', webEx.at));
  assert.deepEqual([webEx.subject, webEx.part, webEx.iso3, webEx.threadId], [{kind: 'country', id: 'JPN'}, '', ['JPN'], null]);
  const row = {countryName: 'Japan', generatedAt: '2026-10-30T05:02:09.564Z', nodes: [{threadId: 't1', summary: 'one'}, {threadId: 't2'}, {threadId: 't1'}, {summary: 'no id'}],
    backbone: [{from: 't1', to: 't2', sharedActors: ['G7', 'diesel']}, {from: 't1'}], edges: []};
  const n = N.webNote({row, iso3: 'JPN', at: row.generatedAt, model: 'deepseek-v4-pro', producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(n.payload, {country: 'Japan', nodes: [{threadId: 't1', summary: 'one'}, {threadId: 't2'}], backbone: [{from: 't1', to: 't2', sharedActors: ['G7', 'diesel'], weight: 2}]}); // weight defaults to the actor count
  const copy = N.webNote({row, iso3: 'JPN', at: row.generatedAt, model: null, producer});
  assert.equal(valid(copy), true, JSON.stringify(valid.errors));
  assert.deepEqual([copy.model, copy.payload.source], [null, 'web-history']);
  assert.equal(N.webNote({row: null, iso3: 'JPN', at: row.generatedAt, model: 'm', producer}), null);
  assert.throws(() => N.webNote({row, iso3: 'Japan', at: row.generatedAt, model: 'm', producer}), /ISO3/);
  const bad = [{...webEx, part: 'JPN'}, {...webEx, subject: {kind: 'pair', id: 'JPN'}}, {...webEx, model: null}, {...webEx, payload: {...webEx.payload, extra: 1}},
    {...webEx, payload: {...webEx.payload, nodes: ['t1']}}, {...webEx, payload: {country: 'Japan', nodes: []}}];
  for (const b of bad) assert.equal(valid(b), false, JSON.stringify(b).slice(0, 160));
});

test('linkNote: the other direction of a pair rides in payload.reverse, its cites join the note; a reverse that is not the opposite edge is ignored', () => {
  const entries = [{topicId: 'A-1', date: '2026-10-02', title: 'A', sources: [{url: 'https://www.reuters.com/a'}]}, {topicId: 'B-1', date: '2026-10-03', title: 'B', sources: [{url: 'https://www.bbc.com/b'}]}];
  const eventIds = N.entryEventIdIndex(entries);
  const at = '2026-10-30T05:02:09.564Z';
  const back = {from: 'thread-a', to: 'thread-b', mechanism: 'back', lagDays: 3, confidence: 'weak', cited: [{topicId: 'B-1', date: '2026-10-03', title: 'B'}]};
  const edge = {from: 'thread-b', to: 'thread-a', mechanism: 'm', lagDays: 1, confidence: 'strong', cited: [{topicId: 'A-1', date: '2026-10-02', title: 'A'}], reverse: back};
  const n = N.linkNote({edge, countryName: 'Japan', iso3: 'JPN', at, model: 'deepseek-v4-pro', eventIds, producer});
  assert.equal(valid(n), true, JSON.stringify(valid.errors));
  assert.deepEqual(n.payload.reverse, {confidence: 'weak', lagDays: 3, mechanism: 'back', cited: back.cited});
  assert.equal(n.cites.length, 2);
  assert.equal('reverse' in N.linkNote({edge: {...edge, reverse: {...back, to: 'thread-c'}}, countryName: 'Japan', iso3: 'JPN', at, model: 'm', producer}).payload, false);
  assert.equal(valid({...n, payload: {...n.payload, reverse: {...n.payload.reverse, extra: 1}}}), false);
});

// daily_brief and weekly_brief (decision 0048): the examples were built by the real builders from live rows (fixtures/brief-rows.json is the same data).
const dailyEx = load('examples/note-daily_brief.json');
const weeklyEx = load('examples/note-weekly_brief.json');
const briefRows = JSON.parse(readFileSync(resolve(__dirname, '../../cli/fixtures/brief-rows.json'), 'utf8'));

test('the brief examples validate and carry the shared noteId', () => {
  for (const ex of [dailyEx, weeklyEx]) {
    assert.equal(valid(ex), true, JSON.stringify(valid.errors));
    assert.equal(ex.noteId, R.noteId(ex.subtype, ex.subject.id, ex.part, ex.at));
  }
  assert.deepEqual([dailyEx.subject, dailyEx.part, dailyEx.threadId], [{kind: 'brief', id: 'daily:2026-10-30'}, '', null]);
  assert.deepEqual([weeklyEx.subject, weeklyEx.part, weeklyEx.payload.status], [{kind: 'brief', id: 'weekly:2026-10-25'}, '', 'published']);
});

test('dailyBriefNote and weeklyBriefNote: every live-shaped row (old and new, draft and published) builds a schema-valid note; payload is the row as stored', () => {
  const notes = [...briefRows.daily.map((item) => N.dailyBriefNote({item, producer})), ...briefRows.weekly.map((item) => N.weeklyBriefNote({item, producer}))];
  for (const n of notes) assert.equal(valid(n), true, JSON.stringify(valid.errors) + n.subject.id);
  for (const k of ['PK', 'SK', 'ttl', 'generatedAt', 'model']) assert.equal(notes.some((n) => k in n.payload), false, k);
  const old = notes.find((n) => n.subject.id === 'daily:2026-06-10');
  assert.equal(old.payload.topStories.some((s) => 'iso3' in s), false); // stored as written: the iso3 is derived on read, not stored
  assert.ok(old.iso3.length > 0 && old.iso3.every((c) => /^[A-Z]{3}$/.test(c)));
  assert.equal(notes.find((n) => n.subject.id === 'weekly:2026-06-21').payload.status, 'draft');
  assert.equal(notes.find((n) => n.subject.id === 'weekly:2026-06-10').payload.confirmedBy, 'human');
  assert.equal(N.dailyBriefNote({item: null, producer}), null);
  assert.equal(N.dailyBriefNote({item: {dateKey: '2026-10-30'}, producer}), null); // no headline
  assert.equal(N.weeklyBriefNote({item: {weekOf: '2026-10-25'}, producer}), null); // no signals
});

test('brief notes breaking their rules are rejected', () => {
  const dp = dailyEx.payload;
  const wp = weeklyEx.payload;
  const {headline, ...noHeadline} = dp;
  const {signals, ...noSignals} = wp;
  const bad = [
    {...dailyEx, subject: {kind: 'story', id: dailyEx.subject.id}},
    {...dailyEx, subject: {kind: 'brief', id: 'weekly:2026-10-25'}}, // a daily note is about a day
    {...dailyEx, part: 'summary'},
    {...dailyEx, payload: noHeadline},
    {...dailyEx, payload: {...dp, extra: 1}},
    {...dailyEx, model: null},
    {...weeklyEx, subject: {kind: 'brief', id: 'weekly:2026-W43'}}, // the weekOf date, not an ISO week
    {...weeklyEx, subject: {kind: 'brief', id: 'daily:2026-10-25'}},
    {...weeklyEx, payload: noSignals},
    {...weeklyEx, payload: {...wp, status: 'maybe'}},
    {...weeklyEx, payload: {...wp, extra: 1}},
  ];
  for (const n of bad) assert.equal(valid(n), false, JSON.stringify(n).slice(0, 120));
});
