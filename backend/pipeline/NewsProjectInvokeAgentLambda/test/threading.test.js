'use strict';

// Thread join rule — run with `node --test`. Cases are real archive topics from the 2026-10-06..19
// measurement (.board/linking/joins.md): judged wrong joins must start new threads, right ones join.

const test = require('node:test');
const assert = require('node:assert/strict');
const { joinScore, passesJoin, matchThread, relatedEntries, generateThreadId, normalizeTitle, joinRecord } = require('../src/threading');

const past = (t, threadId) => ({ ...t, threadId });

const firingSquad = { title: 'Trump Approves Firing Squad Execution for Fort Hood Shooter Nidal Hasan', category: 'politics', regions: ['United States'], search_keywords: ['Nidal Hasan', 'firing squad', 'military execution', 'Fort Hood'] };
const tennessee = { title: 'Tennessee Prison Chief Resigns After Failed Execution of Christa Pike', category: 'politics', regions: ['United States'], search_keywords: ['Tennessee', 'prison chief', 'resign', 'failed execution', 'Christa Pike'] };
const flyingCar = { title: "Elon Musk Unveils Tesla's 'Flying' Car", category: 'technology', regions: ['United States'], search_keywords: ['Elon Musk', 'Tesla', 'flying car', 'thrusters', 'SpaceX'] };
const rogueAgent = { title: 'Rogue Anthropic AI Agent Gave Police Fake Tip in Unsolved Murder Case', category: 'technology', regions: ['United States'], search_keywords: ['Anthropic', 'AI agent', 'fake tip', 'police', 'murder case'] };
const plagueRu = { title: 'Russia plague quarantine following lab death raises concerns', category: 'health', regions: ['Russia'], search_keywords: ['Russia', 'plague', 'quarantine', 'lab death'] };
const plagueUs = { title: 'US Monitoring Plague Researcher Death in Russia, Russia Says Situation Under Control', category: 'health', regions: ['United States', 'Russia'], search_keywords: ['plague', 'Russia', 'lab technician', 'death', 'quarantine'] };

test('same region + same category with no shared words clears the composite but not the keyword gate', () => {
  const s = joinScore(flyingCar, rogueAgent);
  assert.ok(s.score >= 0.4, `composite ${s.score}`);
  assert.equal(s.kwScore, 0);
  assert.equal(passesJoin(s), false);
});

test('a judged wrong join (firing squad <= Tennessee execution, kw 0.04) starts a new thread', () => {
  const s = joinScore(firingSquad, tennessee);
  assert.ok(s.score >= 0.4 && s.kwScore < 0.15, JSON.stringify(s));
  const m = matchThread(firingSquad, [past(tennessee, 'thread-tn')]);
  assert.equal(m.via, 'new');
  assert.equal(m.threadId, null);
});

test('a judged right join (Russia plague, kw >= 0.15) joins the thread by score', () => {
  const m = matchThread(plagueRu, [past(plagueUs, 'thread-plague'), past(flyingCar, 'thread-car')]);
  assert.equal(m.via, 'score');
  assert.equal(m.threadId, 'thread-plague');
  assert.ok(m.kwScore >= 0.15 && m.score >= 0.4);
});

test('the best passing entry wins, not the best composite overall', () => {
  // flyingCar vs rogueAgent scores 0.5 with kw 0; a weaker-composite entry that shares words wins.
  const teslaFollowUp = { title: 'Tesla Flying Car Prototype Faces Regulators', category: 'business', regions: ['United States'], search_keywords: ['Tesla', 'flying car'] };
  const m = matchThread(flyingCar, [past(rogueAgent, 'thread-agent'), past(teslaFollowUp, 'thread-tesla')]);
  assert.equal(m.threadId, 'thread-tesla');
});

test('continues_topic joins regardless of the score gate', () => {
  const t = { ...firingSquad, continues_topic: tennessee.title };
  const m = matchThread(t, [past(tennessee, 'thread-tn')]);
  assert.equal(m.via, 'continues_topic');
  assert.equal(m.threadId, 'thread-tn');
});

test('entries without a threadId are never joined', () => {
  const m = matchThread({ ...plagueRu, continues_topic: plagueUs.title }, [plagueUs]);
  assert.equal(m.via, 'new');
});

test('relatedEntries (arc digest) uses the same rule', () => {
  const r = relatedEntries(plagueRu, [plagueUs, flyingCar, rogueAgent]);
  assert.deepEqual(r.map((e) => e.title), [plagueUs.title]);
});

test('generateThreadId is the founding-title slug + sha1 prefix', () => {
  assert.match(generateThreadId(plagueRu), /^thread-russia-plague-quarantine-follo-[0-9a-f]{6}$/);
});

// ---------- normalised titles ----------

test('normalizeTitle folds case, whitespace and punctuation', () => {
  assert.equal(normalizeTitle("  Sri Lanka's Ex-First  Lady Arrested! "), normalizeTitle('sri lanka’s ex first lady arrested'));
  assert.equal(normalizeTitle(''), '');
});

test('continues_topic matches a title that differs only in case and punctuation', () => {
  const t = { ...plagueRu, title: 'Plague: WHO Sends Team to Russia', continues_topic: 'russia PLAGUE quarantine — following lab death raises concerns' };
  const m = matchThread(t, [past(plagueRu, 'thread-plague')]);
  assert.equal(m.via, 'continues_topic');
  assert.equal(m.threadId, 'thread-plague');
});

test('the same title (case variant) joins by title, taking the newest entry', () => {
  const halzen = { title: 'Belgian physicist Francis Halzen wins Nobel Prize in Physics', category: 'science', regions: ['Belgium'] };
  const variant = { ...halzen, title: 'Belgian Physicist Francis Halzen Wins Nobel Prize in Physics' };
  const m = matchThread(variant, [past(halzen, 'thread-newer'), past(halzen, 'thread-older')]);
  assert.equal(m.via, 'title');
  assert.equal(m.threadId, 'thread-newer');
});

// ---------- [join] log record ----------

test('joinRecord carries topicId, threadId, via, score and kwScore for a score join', () => {
  const rec = joinRecord({ ...plagueRu, id: 'Russia plague-3' }, [past(plagueUs, 'thread-plague')]);
  assert.deepEqual(Object.keys(rec), ['topicId', 'threadId', 'via', 'score', 'kwScore']);
  assert.equal(rec.topicId, 'Russia plague-3');
  assert.equal(rec.threadId, 'thread-plague');
  assert.equal(rec.via, 'score');
  assert.equal(rec.kwScore, Math.round(rec.kwScore * 1000) / 1000);
});

test('joinRecord founds a new thread id and keeps the best score seen', () => {
  const rec = joinRecord({ ...flyingCar, id: 'car-0' }, [past(rogueAgent, 'thread-agent')]);
  assert.equal(rec.via, 'new');
  assert.equal(rec.threadId, generateThreadId(flyingCar));
  assert.equal(rec.score, 0.5);
  assert.equal(rec.kwScore, 0);
});

test('an empty continues_topic never matches an untitled entry', () => {
  const m = matchThread({ title: 'Brand new event', continues_topic: '' }, [past({ title: '' }, 'thread-x')]);
  assert.equal(m.via, 'new');
});

const { joinRun } = require('../src/threading');
test('same-run score, title and forward explicit continuations share a newly minted id', () => {
  const rows = joinRun([
    { ...plagueRu, id: 'a' }, { ...plagueRu, id: 'b', title: plagueRu.title.toUpperCase() },
    { id: 'c', title: 'WHO dispatches experts', continues_topic: 'A different headline' },
    { id: 'd', title: 'A different headline' },
  ]);
  assert.equal(rows[0].threadId, rows[1].threadId);
  assert.equal(rows[2].threadId, rows[3].threadId);
  assert.notEqual(rows[0].threadId, rows[2].threadId);
  assert.equal(rows[1].via, 'run-title');
});
test('a new same-run topic joins another topic anchored in history', () => {
  const rows = joinRun([{ ...plagueRu, id: 'a' }, { ...plagueRu, id: 'b' }], [past(plagueUs, 'old')]);
  assert.ok(rows.every(r => r.threadId === 'old'));
});
test('conflicting continuation/title chooses thread latest member, not just matching row', () => {
  const topic = { title: 'Exact headline', continues_topic: 'Old headline' };
  const entries = [
    { title: 'Old headline', threadId: 'cont', archivedAt: '2026-10-17T12:00:00Z' },
    { title: 'Exact headline', threadId: 'exact', archivedAt: '2026-10-18T12:00:00Z' },
    { title: 'Other member', threadId: 'cont', archivedAt: '2026-10-19T12:00:00Z' },
  ];
  const rec = joinRecord(topic, entries);
  assert.equal(rec.threadId, 'cont');
  assert.equal(rec.conflict.reason, 'latest-thread-entry');
  entries[2].archivedAt = '2026-10-16T12:00:00Z';
  assert.equal(joinRecord(topic, entries).threadId, 'exact');
  assert.equal(joinRecord(topic, entries).via, 'title');
});
test('same-run comparison keeps unrelated US technology topics apart', () => {
 const rows = joinRun([{...flyingCar,id:'a'},{...rogueAgent,id:'b'}]);
 assert.notEqual(rows[0].threadId, rows[1].threadId);
});
