'use strict';

// Thread join rule — run with `node --test`. Cases are real archive topics from the 2026-10-06..19
// measurement (.board/linking/joins.md): judged wrong joins must start new threads, right ones join.

const test = require('node:test');
const assert = require('node:assert/strict');
const { joinScore, passesJoin, matchThread, relatedEntries, generateThreadId } = require('../src/threading');

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
