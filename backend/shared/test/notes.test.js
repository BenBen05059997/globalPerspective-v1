'use strict';
// notes.js (decision 0042): the one builder of record notes. buildNote throws on what backend/record/schema/note.schema.json would reject;
// each stored-row builder (entry, story analysis, drift, country, country facts, story history, link, web, briefs, archive copies) maps a
// DynamoDB item to that shape or returns null for an item with nothing to say. The schema itself is exercised in
// newsStoryRecord/test/note-schema.test.js (which also covers entryNote, storyAnalysisNote, driftNote, archiveEntryNotes and the writer
// on the happy path); this file covers the builders it leaves out and the refusals.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/notes');
const R = require('../src/record');

const producer = { lambda: 'capture-entry-notes', runId: 'test-1' };
const AT = '2026-10-30T05:30:00.123Z';
const countryPayload = { countryName: 'Ukraine', bluf: 'b', keyDevelopments: [], whyItMatters: 'w', trajectory: 'stable', riskLevel: 'high', riskScore: 70 };
const base = { subtype: 'country', subjectId: 'UKR', at: AT, iso3: ['UKR'], payload: countryPayload, model: 'deepseek-flash', producer };

// ---- buildNote ----

test('buildNote: the envelope of a note, with the noteId the shared noteId of subtype, subject, part and the normalised time', () => {
  const n = N.buildNote({ ...base, iso3: ['UKR', 'POL', 'UKR'], cites: ['x', 'y', 'x'], promptVersion: 4, threadId: 'thread-1' });
  assert.deepEqual(Object.keys(n), ['schemaVersion', 'noteId', 'subtype', 'subject', 'part', 'threadId', 'iso3', 'at', 'date', 'payload', 'cites', 'model', 'promptVersion', 'producer']);
  assert.equal(n.schemaVersion, N.SCHEMA_VERSION);
  assert.equal(n.noteId, R.noteId('country', 'UKR', '', AT));
  assert.deepEqual(n.subject, { kind: 'country', id: 'UKR' });
  assert.deepEqual([n.iso3, n.cites, n.threadId, n.promptVersion], [['POL', 'UKR'], ['x', 'y'], 'thread-1', '4']);
  assert.deepEqual([n.at, n.date], [AT, '2026-10-30']);
});

test('buildNote: optional fields default (part "", threadId null, iso3 [], cites [], promptVersion null) and `at` is normalised to ISO UTC', () => {
  const n = N.buildNote({ ...base, iso3: undefined, at: '2026-10-30T07:30:00+02:00' });
  assert.deepEqual([n.part, n.threadId, n.iso3, n.cites, n.promptVersion], ['', null, [], [], null]);
  assert.equal(n.at, '2026-10-30T05:30:00.000Z');
  assert.equal(N.buildNote({ ...base, promptVersion: 0 }).promptVersion, '0'); // 0 is a version, not "none"
  assert.equal(N.buildNote({ ...base, threadId: '' }).threadId, null);
});

test('buildNote: the subject kind follows the subtype; an explicit kind must agree, except a story drift note', () => {
  const kinds = {
    country: ['country', 'UKR', ''], web: ['country', 'UKR', ''], country_facts: ['country', 'UKR', ''], drift: ['country', 'UKR', ''],
    story_history: ['story', 't1', ''], story_analysis: ['story', 't1', ''], link: ['pair', 'a__b', 'UKR'],
  };
  for (const [subtype, [kind, subjectId, part]] of Object.entries(kinds)) {
    const payload = subtype === 'story_history' ? { from: 'history' } : countryPayload;
    const n = N.buildNote({ ...base, subtype, subjectId, part, payload, model: subtype === 'country_facts' || subtype === 'story_history' ? null : 'm' });
    assert.equal(n.subject.kind, kind, subtype);
  }
  assert.throws(() => N.buildNote({ ...base, kind: 'story' }), /a country note's subject is not a story/);
  assert.equal(N.buildNote({ ...base, subtype: 'drift', subjectId: 't1', kind: 'story' }).subject.kind, 'story');
  assert.throws(() => N.buildNote({ ...base, subtype: 'drift', kind: 'pair' }), /subject is not a pair/);
});

test('buildNote: a subject id is required, whatever its type', () => {
  for (const subjectId of [undefined, null, '', 7]) assert.throws(() => N.buildNote({ ...base, subjectId }), /needs a subject id/);
});

test('buildNote: brief subjects are daily:DATE / weekly:DATE and the subtype has no part', () => {
  const daily = N.buildNote({ ...base, subtype: 'daily_brief', subjectId: 'daily:2026-10-30' });
  assert.deepEqual(daily.subject, { kind: 'brief', id: 'daily:2026-10-30' });
  assert.equal(N.buildNote({ ...base, subtype: 'weekly_brief', subjectId: 'weekly:2026-10-25' }).subject.id, 'weekly:2026-10-25');
  for (const bad of ['daily:2026-10-3', 'daily:2026-10-30x', 'weekly:2026-10-25', '2026-10-30', 'daily:']) {
    assert.throws(() => N.buildNote({ ...base, subtype: 'daily_brief', subjectId: bad }), /daily:DATE/, bad);
  }
  assert.throws(() => N.buildNote({ ...base, subtype: 'weekly_brief', subjectId: 'daily:2026-10-30' }), /weekly:DATE/);
});

test('buildNote: an entry note has one of the three parts and cites its entry; a link note\'s part is an ISO3', () => {
  const entry = { ...base, subtype: 'entry', subjectId: 'e1', iso3: [], payload: { format: 'markdown', content: 'x', topicId: 't' }, cites: ['e1'] };
  for (const part of ['summary', 'prediction', 'cause']) assert.equal(N.buildNote({ ...entry, part }).part, part);
  for (const part of ['', 'analysis', 'SUMMARY']) assert.throws(() => N.buildNote({ ...entry, part }), /entry part/);
  assert.throws(() => N.buildNote({ ...entry, part: 'summary', cites: [] }), /cites its entry/);
  const link = { ...base, subtype: 'link', subjectId: 'a__b' };
  assert.equal(N.buildNote({ ...link, part: 'JPN' }).part, 'JPN');
  for (const part of ['', 'jpn', 'JP', 'Japan']) assert.throws(() => N.buildNote({ ...link, part }), /part is its country ISO3/, part);
});

test('buildNote: country, web, country_facts and story_history notes have no part', () => {
  for (const subtype of ['country', 'web', 'country_facts', 'story_history']) {
    const payload = subtype === 'story_history' ? { from: 'history' } : countryPayload;
    assert.throws(() => N.buildNote({ ...base, subtype, part: 'x', payload, model: null }), /has no part/, subtype);
  }
});

test('buildNote: `at` must be a parseable time; iso3 must be ISO3 codes in an array; payload must be an object', () => {
  for (const at of [undefined, null, '', 'yesterday', 'not-a-date']) assert.throws(() => N.buildNote({ ...base, at }), /needs a valid at/);
  assert.equal(N.buildNote({ ...base, at: '2026-10-30' }).at, '2026-10-30T00:00:00.000Z'); // a bare date is a valid time
  for (const iso3 of [['Ukraine'], ['ukr'], ['UK'], ['UKRA'], [null], 'UKR']) assert.throws(() => N.buildNote({ ...base, iso3 }), /iso3 must be ISO3/);
  for (const payload of [undefined, null, 'text', 5]) assert.throws(() => N.buildNote({ ...base, payload }), /payload must be an object/);
});

test('buildNote: a story_history note must be a history copy', () => {
  const hist = { ...base, subtype: 'story_history', subjectId: 't1', iso3: [], model: null };
  assert.throws(() => N.buildNote({ ...hist, payload: { threadTitle: 'x' } }), /history copy/);
  assert.throws(() => N.buildNote({ ...hist, payload: { from: 'archive' } }), /history copy/);
  assert.equal(N.buildNote({ ...hist, payload: { from: 'history' } }).model, null);
});

test('buildNote: a model is required, and null is allowed only on an archive/history/web-history copy or a country_facts note', () => {
  for (const model of [undefined, null, '', 5]) assert.throws(() => N.buildNote({ ...base, model }), /model is required/);
  assert.equal(N.buildNote({ ...base, payload: { ...countryPayload, from: 'archive' }, model: null }).model, null);
  assert.equal(N.buildNote({ ...base, payload: { ...countryPayload, from: 'history' }, model: null }).model, null);
  assert.equal(N.buildNote({ ...base, payload: { ...countryPayload, source: 'web-history' }, model: null }).model, null);
  assert.equal(N.buildNote({ ...base, subtype: 'country_facts', model: null }).model, null);
  assert.throws(() => N.buildNote({ ...base, payload: { ...countryPayload, from: 'other' }, model: null }), /model is required/);
  assert.throws(() => N.buildNote({ ...base, payload: { ...countryPayload, from: 'archive' }, model: undefined }), /model is required/); // a copy says null, not nothing
});

test('buildNote: the producer must name a lambda and a run', () => {
  for (const p of [undefined, null, {}, { lambda: 'x' }, { runId: 'r' }, { lambda: '', runId: 'r' }, { lambda: 'x', runId: 7 }]) {
    assert.throws(() => N.buildNote({ ...base, producer: p }), /producer \{lambda, runId\} is required/);
  }
  assert.deepEqual(N.buildNote({ ...base, producer: { lambda: 'x', runId: 'r', extra: 1 } }).producer, { lambda: 'x', runId: 'r' }); // only the two fields are kept
});

// ---- entryNote ----

const topic = { title: 'US tech stocks fall', threadId: 'thread-topic', iso3: ['USA', 'Canada', 'CAN'], sources: [{ url: 'https://www.cbc.ca/news/a' }] };
const row = (SK, content, extra = {}) => ({ SK, content, topicId: 'US tech stocks fall-2', generatedAt: AT, model: 'deepseek-flash', ...extra });

test('entryNote: a row with no content, an unknown sort key, no row or no topic gives null', () => {
  const call = (item, t = topic) => N.entryNote({ item, topic: t, archiveDate: '2026-10-30', producer });
  assert.equal(call(row('SUMMARY', '')), null);
  assert.equal(call(row('SUMMARY', undefined)), null);
  assert.equal(call(row('SUMMARY', 5)), null);
  assert.equal(call(row('METADATA', 'x')), null);
  assert.equal(call(null), null);
  assert.equal(call(undefined), null);
  assert.equal(call(row('SUMMARY', 'x'), null), null);
});

test('entryNote: markdown by default, the row\'s thread over the topic\'s, topic ISO3s filtered to codes, model passed through', () => {
  const n = N.entryNote({ item: row('SUMMARY', '- point', { threadId: 'thread-row' }), topic, archiveDate: '2026-10-30', producer });
  assert.deepEqual([n.payload.format, n.payload.content, n.payload.topicId], ['markdown', '- point', 'US tech stocks fall-2']);
  assert.equal(n.threadId, 'thread-row');
  assert.deepEqual(n.iso3, ['CAN', 'USA']); // 'Canada' is a name, not a code: dropped, not an error
  const t2 = N.entryNote({ item: row('SUMMARY', 'x'), topic, archiveDate: '2026-10-30', producer });
  assert.equal(t2.threadId, 'thread-topic');
  const none = N.entryNote({ item: row('SUMMARY', 'x'), topic: { ...topic, threadId: undefined, iso3: undefined }, archiveDate: '2026-10-30', producer });
  assert.deepEqual([none.threadId, none.iso3], [null, []]);
});

test('entryNote: json content is parsed; a row that says json with text that is not JSON throws instead of storing a bad note', () => {
  const n = N.entryNote({ item: row('PREDICTION', '{"precedents":[1]}', { contentFormat: 'json' }), topic, archiveDate: '2026-10-30', producer });
  assert.deepEqual(n.payload.content, { precedents: [1] });
  assert.throws(() => N.entryNote({ item: row('TRACE_CAUSE', 'not json', { contentFormat: 'json' }), topic, archiveDate: '2026-10-30', producer }), SyntaxError);
  // any other contentFormat is markdown and kept as text
  assert.equal(N.entryNote({ item: row('SUMMARY', '{"a":1}', { contentFormat: 'text' }), topic, archiveDate: '2026-10-30', producer }).payload.format, 'markdown');
});

test('entryNote: no model on the row is refused (a live note always names its model)', () => {
  assert.throws(() => N.entryNote({ item: row('SUMMARY', 'x', { model: undefined }), topic, archiveDate: '2026-10-30', producer }), /model is required/);
  assert.throws(() => N.entryNote({ item: row('SUMMARY', 'x', { generatedAt: undefined }), topic, archiveDate: '2026-10-30', producer }), /valid at/);
});

// ---- storyAnalysisNote ----

const analysis = (extra = {}) => ({ PK: 'THREAD#t1', SK: 'THREAD_ANALYSIS', threadId: 't1', ttl: 9, iso3: ['UKR', 'Russia'], generatedAt: AT, model: 'deepseek-flash', threadTitle: 'T',
  storyArc: 'S', entryCount: 2, entryTopicIds: [], ...extra });

test('storyAnalysisNote: null for no item or an item without a threadId; payload drops keys, ttl and the envelope fields', () => {
  assert.equal(N.storyAnalysisNote({ item: null, producer }), null);
  assert.equal(N.storyAnalysisNote({ item: analysis({ threadId: '' }), producer }), null);
  const n = N.storyAnalysisNote({ item: analysis(), producer });
  assert.deepEqual(Object.keys(n.payload).sort(), ['entryCount', 'entryTopicIds', 'storyArc', 'threadTitle']);
  assert.deepEqual([n.subject, n.threadId, n.iso3, n.cites, n.model], [{ kind: 'story', id: 't1' }, 't1', ['UKR'], [], 'deepseek-flash']);
});

test('storyAnalysisNote: payload fields that are undefined are dropped, null ones kept; no entries list cites nothing', () => {
  const n = N.storyAnalysisNote({ item: analysis({ lead: null, sentiment: undefined, entryTopicIds: ['a-1'] }), producer });
  assert.equal(n.payload.lead, null);
  assert.equal('sentiment' in n.payload, false);
  assert.deepEqual(n.cites, []); // entries default to []
});

// ---- driftNote / storyDriftNote ----

const driftItem = { PK: 'COUNTRY#UKR', SK: 'DRIFT#2026-10-30', ttl: 1, countryName: 'Ukraine', asOf: '2026-10-30', since: '2026-10-29', changeScore: { from: 1, to: 2, delta: 1 },
  currentRiskScore: 2, whyChanged: 'x', noSingleDriver: false, triggerEvent: { topicId: 't-1', threadId: 'thread-x', title: 'X', date: '2026-10-30' }, generatedAt: AT };

test('driftNote: a country drift note takes the trigger story\'s thread and keeps the trigger in the payload', () => {
  const n = N.driftNote({ item: driftItem, iso3: 'UKR', model: 'deepseek-flash', producer });
  assert.deepEqual([n.subject, n.threadId, n.iso3, n.at], [{ kind: 'country', id: 'UKR' }, 'thread-x', ['UKR'], AT]);
  assert.deepEqual(n.payload.triggerEvent, driftItem.triggerEvent);
  for (const k of ['PK', 'SK', 'ttl', 'generatedAt']) assert.equal(k in n.payload, false, k);
  assert.equal(N.driftNote({ item: { ...driftItem, triggerEvent: null }, iso3: 'UKR', model: 'm', producer }).threadId, null);
  assert.throws(() => N.driftNote({ item: driftItem, iso3: 'Ukraine', model: 'm', producer }), /ISO3/);
  assert.throws(() => N.driftNote({ item: driftItem, iso3: 'UKR', model: undefined, producer }), /model is required/);
});

test('storyDriftNote: a story drift note is about the story (kind story), threadId stays in the payload, iso3 from the item else the argument else none', () => {
  const item = { PK: 'THREAD#t1', SK: 'DRIFT#2026-10-30', threadId: 't1', priorTitle: 'a', currentTitle: 'b', whyChanged: 'x', generatedAt: AT, ttl: 1 };
  const n = N.storyDriftNote({ item, threadId: 't1', model: 'm', producer });
  assert.deepEqual([n.subject, n.threadId, n.iso3, n.payload.threadId], [{ kind: 'story', id: 't1' }, 't1', [], 't1']);
  assert.deepEqual(N.storyDriftNote({ item, threadId: 't1', iso3: ['FRA', 'France'], model: 'm', producer }).iso3, ['FRA']);
  assert.deepEqual(N.storyDriftNote({ item: { ...item, iso3: ['DEU'] }, threadId: 't1', iso3: ['FRA'], model: 'm', producer }).iso3, ['DEU']);
  // the archive copy of a drift has no model recorded
  const copy = N.storyDriftNote({ item: { ...item, from: 'archive' }, threadId: 't1', model: null, producer });
  assert.equal(copy.model, null);
  assert.throws(() => N.storyDriftNote({ item, threadId: 't1', model: null, producer }), /model is required/);
  // the country and story drift notes of one day do not collide
  assert.notEqual(N.driftNote({ item: driftItem, iso3: 'UKR', model: 'm', producer }).noteId, N.storyDriftNote({ item, threadId: 't1', model: 'm', producer }).noteId);
});

// ---- countryNote / countryHistoryNote / countryFactsNote ----

const countryItem = { PK: 'COUNTRY#UKR', SK: 'COUNTRY_INTELLIGENCE', ttl: 1, countryName: 'Ukraine', bluf: 'b', riskScore: 70, generatedAt: AT, model: 'deepseek-flash' };

test('countryNote: the day\'s briefing as a country note; null without a country name; payload minus keys, ttl, generatedAt and model', () => {
  const n = N.countryNote({ item: countryItem, iso3: 'UKR', producer });
  assert.deepEqual([n.subtype, n.subject, n.part, n.iso3, n.model, n.at], ['country', { kind: 'country', id: 'UKR' }, '', ['UKR'], 'deepseek-flash', AT]);
  assert.deepEqual(n.payload, { countryName: 'Ukraine', bluf: 'b', riskScore: 70 });
  assert.equal(N.countryNote({ item: null, iso3: 'UKR', producer }), null);
  assert.equal(N.countryNote({ item: { ...countryItem, countryName: '' }, iso3: 'UKR', producer }), null);
  assert.equal(N.countryNote({ item: { ...countryItem, countryName: undefined }, iso3: 'UKR', producer }), null);
  assert.throws(() => N.countryNote({ item: { ...countryItem, model: undefined }, iso3: 'UKR', producer }), /model is required/);
});

test('countryHistoryNote: a backfill copy marked from history with model null and no dateKey; null without a country name', () => {
  const row = { PK: 'COUNTRY#UKR', SK: 'HISTORY#2026-10-11', dateKey: '2026-10-11', countryName: 'Ukraine', riskScore: 60, riskLevel: 'high', generatedAt: '2026-10-11T05:00:00.000Z', model: 'ignored', ttl: 3 };
  const n = N.countryHistoryNote({ item: row, iso3: 'UKR', producer });
  assert.equal(n.model, null);
  assert.deepEqual(n.payload, { countryName: 'Ukraine', riskScore: 60, riskLevel: 'high', from: 'history' });
  assert.equal(n.date, '2026-10-11');
  assert.equal(N.countryHistoryNote({ item: null, iso3: 'UKR', producer }), null);
  assert.equal(N.countryHistoryNote({ item: { ...row, countryName: null }, iso3: 'UKR', producer }), null);
  // a copy and a live note of the same country and instant share a noteId, so the writer dedupes them
  assert.equal(N.countryHistoryNote({ item: row, iso3: 'UKR', producer }).noteId, R.noteId('country', 'UKR', '', '2026-10-11T05:00:00.000Z'));
});

test('countryFactsNote: no model, at = lastUpdatedAt, payload minus keys, ttl and lastUpdatedAt; null without a name or an update time', () => {
  const item = { PK: 'FACTS#UKR', SK: 'COUNTRY_FACTS', ttl: 1, countryName: 'Ukraine', capital: { names: ['Kyiv'], source: 'wikidata' }, lastUpdatedAt: '2026-10-26T20:00:01.500Z' };
  const n = N.countryFactsNote({ item, iso3: 'UKR', producer });
  assert.deepEqual([n.subtype, n.subject, n.model, n.at, n.cites, n.promptVersion], ['country_facts', { kind: 'country', id: 'UKR' }, null, '2026-10-26T20:00:01.500Z', [], null]);
  assert.deepEqual(n.payload, { countryName: 'Ukraine', capital: { names: ['Kyiv'], source: 'wikidata' } });
  assert.equal(N.countryFactsNote({ item: null, iso3: 'UKR', producer }), null);
  assert.equal(N.countryFactsNote({ item: { ...item, countryName: '' }, iso3: 'UKR', producer }), null);
  assert.equal(N.countryFactsNote({ item: { ...item, lastUpdatedAt: '' }, iso3: 'UKR', producer }), null);
  assert.equal(N.countryFactsNote({ item: { ...item, lastUpdatedAt: undefined }, iso3: 'UKR', producer }), null);
  assert.throws(() => N.countryFactsNote({ item: { ...item, lastUpdatedAt: 'sometime' }, iso3: 'UKR', producer }), /valid at/);
});

// ---- storyHistoryNote ----

test('storyHistoryNote: a history copy of a story day; null without a threadId or a time; no iso3 and the thread kept', () => {
  const item = { PK: 'THREAD#t1', SK: 'THREAD_HISTORY#2026-10-11', threadId: 't1', ttl: 1, threadTitle: 'X', trajectory: 'escalating', riskScore: 70, entryCount: 4, generatedAt: '2026-10-11T04:41:00.000Z' };
  const n = N.storyHistoryNote({ item, producer });
  assert.deepEqual([n.subtype, n.subject, n.threadId, n.iso3, n.model, n.part], ['story_history', { kind: 'story', id: 't1' }, 't1', [], null, '']);
  assert.deepEqual(n.payload, { threadTitle: 'X', trajectory: 'escalating', riskScore: 70, entryCount: 4, from: 'history' });
  assert.equal(N.storyHistoryNote({ item: null, producer }), null);
  assert.equal(N.storyHistoryNote({ item: { ...item, threadId: '' }, producer }), null);
  assert.equal(N.storyHistoryNote({ item: { ...item, generatedAt: undefined }, producer }), null);
});

// ---- linkNote / entryEventIdIndex ----

const entries = [
  { topicId: 'a-1', date: '2026-10-02', title: 'A', sources: [{ url: 'https://www.reuters.com/a' }] },
  { topicId: 'b-1', date: '2026-10-03', title: 'B', sources: [{ url: 'https://www.bbc.com/b' }] },
  { topicId: 'c-1', date: '2026-10-04', title: 'C', sources: [{ url: 'https://www.cnn.com/c' }] },
];
const eid = (e) => R.entryIdentity({ sources: e.sources, date: e.date, title: e.title }).eventId;

test('entryEventIdIndex: maps date|topicId to the shared entry eventId, skipping rows missing a topicId or a date', () => {
  const idx = N.entryEventIdIndex([...entries, null, { topicId: 'x' }, { date: '2026-10-02' }, undefined]);
  assert.equal(idx.size, 3);
  assert.equal(idx.get('2026-10-02|a-1'), eid(entries[0]));
  assert.equal(idx.get('2026-10-03|a-1'), undefined);
  assert.equal(N.entryEventIdIndex().size, 0);
  assert.equal(N.entryEventIdIndex(null).size, 0);
});

test('linkNote: a story-to-story edge becomes a link note about the pair, part = the web\'s country, cites = the cited entries found in the index', () => {
  const eventIds = N.entryEventIdIndex(entries);
  const edge = { from: 'thread-b', to: 'thread-a', confidence: 'medium', lagDays: 1, mechanism: 'm',
    cited: [{ topicId: 'a-1', date: '2026-10-02', title: 'A' }, { topicId: 'zz', date: '2026-10-09', title: 'not archived' }, { topicId: 'b-1', date: '2026-10-03', title: 'B' }] };
  const n = N.linkNote({ edge, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'deepseek-flash', eventIds, producer });
  assert.deepEqual([n.subtype, n.subject, n.part, n.threadId, n.iso3, n.model], ['link', { kind: 'pair', id: R.pairKey('thread-b', 'thread-a') }, 'JPN', null, ['JPN'], 'deepseek-flash']);
  assert.deepEqual(n.cites, [eid(entries[0]), eid(entries[1])]); // the cite not in the index is left out
  assert.deepEqual(Object.keys(n.payload), ['from', 'to', 'country', 'confidence', 'lagDays', 'mechanism', 'cited']);
  assert.equal(n.payload.from, 'thread-b'); // the edge keeps its own direction; the subject is the unordered pair
  assert.equal(n.subject.id, 'thread-a__thread-b');
  assert.equal(n.payload.cited.length, 3); // the payload keeps every cited entry, found or not
});

test('linkNote: lagDays defaults to 0, older rows list citedEntries as ids, and no cited list means no cites', () => {
  const eventIds = new Map();
  const n = N.linkNote({ edge: { from: 'a', to: 'b', confidence: 'weak', mechanism: 'm', citedEntries: ['t1', 't2'] }, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', eventIds, producer });
  assert.equal(n.payload.lagDays, 0);
  assert.deepEqual(n.payload.cited, [{ topicId: 't1' }, { topicId: 't2' }]);
  assert.deepEqual(n.cites, []);
  const bare = N.linkNote({ edge: { from: 'a', to: 'b', confidence: 'weak', mechanism: 'm' }, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', producer });
  assert.deepEqual(bare.payload.cited, []);
  assert.deepEqual(bare.cites, []);
});

test('linkNote: the weaker reverse direction rides in payload.reverse and its cites join cites; a reverse that is not the same pair is ignored', () => {
  const eventIds = N.entryEventIdIndex(entries);
  const edge = { from: 'a', to: 'b', confidence: 'strong', lagDays: 2, mechanism: 'm', cited: [{ topicId: 'a-1', date: '2026-10-02', title: 'A' }],
    reverse: { from: 'b', to: 'a', confidence: 'weak', mechanism: 'back', cited: [{ topicId: 'c-1', date: '2026-10-04', title: 'C' }] } };
  const n = N.linkNote({ edge, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', eventIds, producer });
  assert.deepEqual(n.payload.reverse, { confidence: 'weak', lagDays: 0, mechanism: 'back', cited: [{ topicId: 'c-1', date: '2026-10-04', title: 'C' }] });
  assert.deepEqual(n.cites, [eid(entries[0]), eid(entries[2])]);
  const wrong = N.linkNote({ edge: { ...edge, reverse: { ...edge.reverse, to: 'z' } }, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', eventIds, producer });
  assert.equal('reverse' in wrong.payload, false);
  assert.deepEqual(wrong.cites, [eid(entries[0])]);
});

test('linkNote: a null model marks a copy rebuilt from the web history; an edge with nothing to link, or a self-link, gives null', () => {
  const n = N.linkNote({ edge: { from: 'a', to: 'b', confidence: 'weak', mechanism: 'm' }, countryName: 'Japan', iso3: 'JPN', at: AT, model: null, producer });
  assert.equal(n.model, null);
  assert.equal(n.payload.source, 'web-history');
  assert.equal('source' in N.linkNote({ edge: { from: 'a', to: 'b', confidence: 'weak', mechanism: 'm' }, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', producer }).payload, false);
  for (const edge of [null, undefined, {}, { from: 'a' }, { to: 'b' }, { from: '', to: 'b' }, { from: 'a', to: 'a' }]) {
    assert.equal(N.linkNote({ edge, countryName: 'Japan', iso3: 'JPN', at: AT, model: 'm', producer }), null, JSON.stringify(edge));
  }
  // undefined model (not null) is refused: a live link says which model made it
  assert.throws(() => N.linkNote({ edge: { from: 'a', to: 'b' }, countryName: 'Japan', iso3: 'JPN', at: AT, model: undefined, producer }), /model is required/);
  assert.throws(() => N.linkNote({ edge: { from: 'a', to: 'b' }, countryName: 'Japan', iso3: 'Japan', at: AT, model: 'm', producer }), /ISO3/);
});

// ---- webNote ----

test('webNote: nodes (each story once, summary only when it has text) and the deterministic backbone; part is empty and the subject the country', () => {
  const row = {
    countryName: 'Japan', generatedAt: AT,
    nodes: [{ threadId: 't1', summary: 's1' }, { threadId: 't1', summary: 'dup' }, { threadId: 't2' }, { threadId: 't3', summary: '' }, { threadId: '' }, null, { summary: 'orphan' }],
    backbone: [{ from: 't1', to: 't2', sharedActors: ['G7', '', 'EU'], weight: 5 }, { from: 't2', to: 't3', sharedActors: ['oil'] }, { from: 't1' }, null, { from: 't3', to: 't4' }],
  };
  const n = N.webNote({ row, iso3: 'JPN', model: 'deepseek-flash', producer });
  assert.deepEqual([n.subtype, n.subject, n.part, n.iso3, n.at, n.threadId], ['web', { kind: 'country', id: 'JPN' }, '', ['JPN'], AT, null]);
  assert.deepEqual(n.payload.nodes, [{ threadId: 't1', summary: 's1' }, { threadId: 't2' }, { threadId: 't3' }]);
  assert.deepEqual(n.payload.backbone, [
    { from: 't1', to: 't2', sharedActors: ['G7', 'EU'], weight: 5 },
    { from: 't2', to: 't3', sharedActors: ['oil'], weight: 1 }, // weight defaults to the number of shared actors
    { from: 't3', to: 't4', sharedActors: [], weight: 0 },
  ]);
  assert.equal(n.payload.country, 'Japan');
  assert.equal('source' in n.payload, false);
});

test('webNote: a web with no edges is still a note; `at` overrides the row\'s generatedAt; a null model marks web-history; no name gives null', () => {
  const n = N.webNote({ row: { countryName: 'Japan', generatedAt: AT }, iso3: 'JPN', model: 'm', producer });
  assert.deepEqual([n.payload.nodes, n.payload.backbone], [[], []]);
  assert.equal(N.webNote({ row: { countryName: 'Japan', generatedAt: AT }, iso3: 'JPN', at: '2026-10-01T00:00:00Z', model: 'm', producer }).at, '2026-10-01T00:00:00.000Z');
  const copy = N.webNote({ row: { countryName: 'Japan', generatedAt: AT }, iso3: 'JPN', model: null, producer });
  assert.equal(copy.model, null);
  assert.equal(copy.payload.source, 'web-history');
  assert.equal(N.webNote({ row: null, iso3: 'JPN', model: 'm', producer }), null);
  assert.equal(N.webNote({ row: { countryName: '', generatedAt: AT }, iso3: 'JPN', model: 'm', producer }), null);
  assert.throws(() => N.webNote({ row: { countryName: 'Japan' }, iso3: 'JPN', model: 'm', producer }), /valid at/);
});

// ---- dailyBriefNote / weeklyBriefNote ----

test('dailyBriefNote: subject daily:<dateKey>; iso3 is every country the brief names (listed, or read from region text); null without a date or headline', () => {
  const item = { PK: 'DAILY_BRIEF#2026-10-30', SK: 'DAILY_BRIEF', ttl: 1, dateKey: '2026-10-30', headline: 'H', summary: 's', generatedAt: AT, model: 'deepseek-flash',
    topStories: [{ title: 'a', iso3: ['UKR', 'USA'] }, { title: 'b', regions: ['Japan'] }, { title: 'c' }], countryToWatch: { countryName: 'France' } };
  const n = N.dailyBriefNote({ item, producer });
  assert.deepEqual([n.subtype, n.subject, n.part, n.threadId, n.model], ['daily_brief', { kind: 'brief', id: 'daily:2026-10-30' }, '', null, 'deepseek-flash']);
  assert.deepEqual(n.iso3, ['FRA', 'JPN', 'UKR', 'USA']);
  assert.deepEqual(Object.keys(n.payload).sort(), ['dateKey', 'headline', 'countryToWatch', 'summary', 'topStories'].sort());
  assert.equal('iso3' in n.payload.topStories[0], true); // the stored row is kept as stored
  assert.equal('iso3' in n.payload.topStories[1], false); // iso3 is derived for the note's envelope, not written into the payload
  assert.deepEqual(N.dailyBriefNote({ item: { ...item, topStories: undefined, countryToWatch: undefined }, producer }).iso3, []);
  for (const bad of [null, { ...item, dateKey: '' }, { ...item, dateKey: undefined }, { ...item, headline: '' }, { ...item, headline: undefined }]) {
    assert.equal(N.dailyBriefNote({ item: bad, producer }), null);
  }
  assert.throws(() => N.dailyBriefNote({ item: { ...item, dateKey: 'Oct 30' }, producer }), /daily:DATE/);
  assert.throws(() => N.dailyBriefNote({ item: { ...item, model: undefined }, producer }), /model is required/);
});

test('weeklyBriefNote: subject weekly:<weekOf>; iso3 from the signals (listed, or the "A · B" region text); status stays; null without weekOf or a signals array', () => {
  const item = { PK: 'WEEKLY_BRIEF#2026-10-25', SK: 'WEEKLY_BRIEF', ttl: 1, weekOf: '2026-10-25', status: 'published', generatedAt: AT, model: 'deepseek-flash',
    signals: [{ lede: 'a', iso3: ['YEM'] }, { lede: 'b', region: 'Saudi Arabia · France' }, { lede: 'c' }] };
  const n = N.weeklyBriefNote({ item, producer });
  assert.deepEqual([n.subtype, n.subject, n.part, n.model], ['weekly_brief', { kind: 'brief', id: 'weekly:2026-10-25' }, '', 'deepseek-flash']);
  assert.deepEqual(n.iso3, ['FRA', 'SAU', 'YEM']);
  assert.equal(n.payload.status, 'published');
  assert.equal(n.payload.signals.length, 3);
  assert.deepEqual(N.weeklyBriefNote({ item: { ...item, signals: [] }, producer }).iso3, []); // an empty week is still a brief
  for (const bad of [null, { ...item, weekOf: '' }, { ...item, weekOf: undefined }, { ...item, signals: undefined }, { ...item, signals: 'none' }]) {
    assert.equal(N.weeklyBriefNote({ item: bad, producer }), null);
  }
  assert.throws(() => N.weeklyBriefNote({ item: { ...item, weekOf: '2026-W43' }, producer }), /weekly:DATE/);
});

// ---- archiveEntryNotes ----

test('archiveEntryNotes: no entry, or no ai block, gives no notes; the archive time falls back to midnight of the archive date; every text field becomes a part', () => {
  const entry = { title: 'T', topicId: 'T-1', sources: [{ url: 'https://www.bbc.com/t' }], iso3: ['GBR', 'Britain'], threadId: 'th', ai: { summary: 's', prediction: 'p', trace_cause: 'c' } };
  assert.deepEqual(N.archiveEntryNotes({ entry: null, archiveDate: '2026-10-10', producer }), []);
  assert.deepEqual(N.archiveEntryNotes({ entry: undefined, archiveDate: '2026-10-10', producer }), []);
  assert.deepEqual(N.archiveEntryNotes({ entry: { ...entry, ai: undefined }, archiveDate: '2026-10-10', producer }), []);
  assert.deepEqual(N.archiveEntryNotes({ entry: { ...entry, ai: {} }, archiveDate: '2026-10-10', producer }), []);
  assert.deepEqual(N.archiveEntryNotes({ entry: { ...entry, ai: { summary: '', prediction: null, trace_cause: 5 } }, archiveDate: '2026-10-10', producer }), []);
  const notes = N.archiveEntryNotes({ entry, archiveDate: '2026-10-10', producer });
  assert.deepEqual(notes.map((n) => n.part), ['summary', 'prediction', 'cause']);
  for (const n of notes) {
    assert.deepEqual([n.at, n.model, n.threadId, n.iso3, n.payload.from, n.payload.format, n.payload.topicId], ['2026-10-10T00:00:00.000Z', null, 'th', ['GBR'], 'archive', 'text', 'T-1']);
    assert.deepEqual(n.cites, [n.subject.id]);
  }
  assert.deepEqual(notes.map((n) => n.payload.content), ['s', 'p', 'c']);
  assert.equal(new Set(notes.map((n) => n.noteId)).size, 3);
  assert.equal(N.archiveEntryNotes({ entry: { ...entry, threadId: undefined, iso3: undefined }, archiveDate: '2026-10-10', producer })[0].threadId, null);
});

// ---- makeNoteWriter ----

function fakeJson() {
  const manifests = new Map();
  const files = new Map();
  return {
    manifests, files,
    s3json: {
      getJsonEtag: async (k) => ({ obj: manifests.get(k) || null, etag: manifests.has(k) ? '"e"' : null }),
      putJsonIf: async (k, body) => { manifests.set(k, body); return true; },
      appendLines: async (k, notes, { idKey }) => {
        const have = files.get(k) || [];
        const fresh = notes.filter((n) => !have.some((h) => h[idKey] === n[idKey]));
        files.set(k, [...have, ...fresh]);
        return { appended: fresh.length, skipped: notes.length - fresh.length };
      },
    },
  };
}

test('makeNoteWriter: an unknown subtype is refused before anything is written; a note of another subtype in the write is refused', async () => {
  const f = fakeJson();
  const w = N.makeNoteWriter({ s3json: f.s3json });
  await assert.rejects(() => w.write('opinion', []), /unknown subtype opinion/);
  const n = N.buildNote(base);
  await assert.rejects(() => w.write('web', [n]), /country note in a web write/);
  assert.equal(f.manifests.size + f.files.size, 0);
});

test('makeNoteWriter: no notes writes nothing, not even the manifest', async () => {
  const f = fakeJson();
  assert.deepEqual(await N.makeNoteWriter({ s3json: f.s3json }).write('country', []), { appended: 0, skipped: 0, days: [] });
  assert.equal(f.manifests.size, 0);
});

test('makeNoteWriter: notes land in their own day files under the default record/ prefix, days are registered in the subtype manifest, counts add up across days', async () => {
  const f = fakeJson();
  const w = N.makeNoteWriter({ s3json: f.s3json });
  const a = N.buildNote({ ...base, at: '2026-10-30T05:00:00Z' });
  const b = N.buildNote({ ...base, at: '2026-10-31T05:00:00Z' });
  const c = N.buildNote({ ...base, subjectId: 'POL', iso3: ['POL'], at: '2026-10-31T06:00:00Z' });
  assert.deepEqual(await w.write('country', [b, a, c]), { appended: 3, skipped: 0, days: ['2026-10-30', '2026-10-31'] });
  assert.deepEqual([...f.files.keys()].sort(), ['record/notes/country/2026-10-30.jsonl', 'record/notes/country/2026-10-31.jsonl']);
  assert.equal(f.files.get('record/notes/country/2026-10-31.jsonl').length, 2);
  assert.deepEqual(f.manifests.get('record/notes/country/manifest.json'), { schemaVersion: 1, days: ['2026-10-30', '2026-10-31'] });
  // a second run with the same notes appends nothing and keeps the manifest as it was
  assert.deepEqual(await w.write('country', [a, b]), { appended: 0, skipped: 2, days: ['2026-10-30', '2026-10-31'] });
});

// ---- the schema examples are builder output: rebuilding each from its own stored-row shape gives the example back, field for field ----

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const example = (name) => JSON.parse(readFileSync(resolve(__dirname, '../../record/schema/examples', `note-${name}.json`), 'utf8'));

test('the builders rebuild the record schema examples exactly from the stored rows they were made from', () => {
  const rebuilt = {
    daily_brief: (e) => N.dailyBriefNote({ item: { ...e.payload, generatedAt: e.at, model: e.model }, producer: e.producer }),
    weekly_brief: (e) => N.weeklyBriefNote({ item: { ...e.payload, weekOf: e.subject.id.slice('weekly:'.length), generatedAt: e.at, model: e.model }, producer: e.producer }),
    country: (e) => N.countryNote({ item: { ...e.payload, generatedAt: e.at, model: e.model }, iso3: e.subject.id, producer: e.producer }),
    country_facts: (e) => N.countryFactsNote({ item: { ...e.payload, lastUpdatedAt: e.at }, iso3: e.subject.id, producer: e.producer }),
    story_history: (e) => N.storyHistoryNote({ item: { ...e.payload, threadId: e.subject.id, generatedAt: e.at }, producer: e.producer }),
    web: (e) => N.webNote({ row: { countryName: e.payload.country, nodes: e.payload.nodes, backbone: e.payload.backbone, generatedAt: e.at }, iso3: e.subject.id, model: e.model, producer: e.producer }),
    'drift-story': (e) => N.storyDriftNote({ item: { ...e.payload, generatedAt: e.at }, threadId: e.subject.id, model: e.model, producer: e.producer }),
  };
  for (const [name, build] of Object.entries(rebuilt)) {
    const e = example(name);
    assert.deepEqual(build(e), e, name);
  }
});
