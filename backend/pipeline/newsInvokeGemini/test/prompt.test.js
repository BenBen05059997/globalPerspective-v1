'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIndex } = require('./load');

const { buildSelectionPrompt } = loadIndex()._internal;
const articles = [{ title: 'Quake kills 40', source: 'bbc.com', age: '1 hour ago', url: 'https://bbc.com/q', description: 'Rescue under way.' }];
const prompt = (extra = {}) => buildSelectionPrompt({ articles, limit: 15, ...extra });

test('prompt lists the articles and ends with the field list', () => {
  const p = prompt();
  assert.match(p, /1\. Quake kills 40\n   Source: bbc\.com/);
  assert.match(p, /event_type: string, exactly one of/);
});

test('W2: the live prompt carries the done-not-said rule with its reason and two examples', () => {
  const p = prompt();
  assert.match(p, /Select what was DONE, not what was said/);
  assert.match(p, /statement, plan, warning, call, claim, reaction, threat, pledge, poll or anniversary is not an event/);
  assert.match(p, /declaration of war, a formal resignation/);
  assert.match(p, /because readers can find statements anywhere/);
  assert.equal((p.match(/^ {3}- (Avoid|Good): "(UN official|Prime Minister)/gm) || []).length, 2);
});

test('decision 0062: the rules open with who uses the topics and give a reason for each rule', () => {
  const p = prompt();
  assert.match(p, /HOW YOUR TOPICS ARE USED: each topic becomes one entry on a story page/);
  assert.match(p, /does it START a story, or MOVE a story we already follow\?/);
  assert.match(p, /RULES, WITH THE REASON FOR EACH:/);
  assert.doesNotMatch(p, /CRITICAL RULES|BAD EXAMPLES|GOOD EXAMPLES/);
  assert.equal((p.match(/^\d\. (One event|Title only|Sources come|Select what|Significance floor|Name a followed story)/gm) || []).length, 6);
});

test('story kinds: the opening and task lines ask for starts and moves, the three kinds are spelled out', () => {
  const p = prompt();
  assert.match(p, /^You are the editor of a record of world news stories\. Read the articles below and pick the events that start a story or move a story we follow\.$/m);
  assert.match(p, /^Task: pick up to 15 events of the three kinds described below\./m);
  assert.match(p, /^WHAT GETS IN \(three kinds; nothing else\):$/m);
  assert.equal((p.match(/^[ABC]\. A (start|move|measured change):/gm) || []).length, 3);
  assert.match(p, /Set event_type to "measure"\. An opinion piece, a forecast, a poll, a commentary or one expert's view is never a measured change\./);
  assert.match(p, /Leave out an event that connects to nothing before or after it: a one-off with no story behind it and nothing likely to follow, such as a single crime or a criminal case against a private person \(a case against an office-holder or a political figure is not a one-off\), a minor accident, a one-day stunt, a celebrity or entertainment announcement, or one expert's opinion\./);
  assert.match(p, /This holds for moves too: a reaction, warning or claim in a story we follow is not a move/);
  assert.match(p, /An event that clears the floor always gets in: it starts a story or moves one\. Fewer than 15 is correct when fewer events matter or few are of the three kinds: never fill/);
  assert.equal((p.match(/Fewer than 15 is correct/g) || []).length, 1, 'one "fewer is correct" sentence');
  assert.match(p, /least significant event\. A quiet move \(a step in a followed story that does not itself clear the floor\) never takes the place of an event that clears the floor: when the list is full, the quiet move is the one left out, and one story never gets two quiet moves while an event that clears the floor is left out\. No category/);
  assert.match(p, /A grounded vague title beats a specific invented one\. Build each title from its own source articles only: words from a listed story line or from another topic do not belong in it\./);
  assert.match(p, /remove the least significant yourself\. Write the list in order of significance, every event that clears the floor first, so that a list that runs long loses only the least significant event\./);
  assert.match(p, /- Measured change: "Argentina Inflation Falls to 2\.4% Monthly, Lowest Since 2017"/);
});

test('rule 6: a followed story is named by its number, and the one with the most entries wins among duplicates', () => {
  const p = prompt();
  assert.match(p, /^6\. Name a followed story only by its number, copied exactly as listed \(for example "S12"\)\./m);
  assert.match(p, /when unsure, leave "follows" out and the topic starts a story\. A wrong number puts the event on the wrong page\. When several listed stories cover the same situation, name the one with the most entries, even when another story's newest title matches the event more closely\. The same situation means the same line of events \(the same talks, the same campaign, the same scandal\), not the same country or war: a military strike is not part of a peace-talks story, and a sanction or another summit is not part of a trip story\.$/m);
});

test('STORIES WE FOLLOW replaces the continuity and seen-today blocks; one numbered line per story', () => {
  const stories = [
    { key: 'S1', threadId: 'thread-a', lastDate: '2026-11-17', count: 4, title: 'Houthis Strike Riyadh Airport', firstTitle: 'Houthis Seize Hodeidah Port' },
    { key: 'S2', threadId: 'thread-c', lastDate: '2026-11-12', count: 2, title: 'Same Title Twice', firstTitle: 'Same Title Twice' },
    { key: 'S3', threadId: 'thread-b', lastDate: '2026-11-10', count: 1, title: 'Cyclone Arnab Makes Landfall', firstTitle: 'Cyclone Arnab Makes Landfall' },
  ];
  const p = prompt({ stories });
  assert.match(p, /^STORIES WE FOLLOW \(number · last entry date · entries in 14 days · newest title; for a story with 2 or more entries, "\(began: \.\.\.\)" is its oldest title in the 14 days\):\nS1 · 2026-11-17 · 4 · Houthis Strike Riyadh Airport \(began: Houthis Seize Hodeidah Port\)\nS2 · 2026-11-12 · 2 · Same Title Twice\nS3 · 2026-11-10 · 1 · Cyclone Arnab Makes Landfall\n/m);
  assert.doesNotMatch(p, /NARRATIVE CONTINUITY|PREVIOUSLY COVERED TODAY|continues_topic|thread-a/);
  assert.match(prompt(), /^STORIES WE FOLLOW .*\n\(none\)$/m, 'an empty list says so');
});

test('the field list asks for follows by number and offers measure as an event type', () => {
  const p = prompt();
  assert.match(p, /^- follows: string \(optional\) — the number of the followed story this topic moves, exactly as listed \(e\.g\. "S12"\); leave it out for a start$/m);
  assert.match(p, /event_type: string, exactly one of: war, unrest, diplomacy, election, policy, economy, markets, disaster, health, tech, measure, other \("measure" only for a measured change, kind C\)/);
});

test('W4: a significance floor replaces the topic quota and the category minimums', () => {
  const p = prompt();
  assert.doesNotMatch(p, /Generate 15 topics/);
  assert.doesNotMatch(p, /at least one topic from each/);
  assert.doesNotMatch(p, /25%/);
  assert.doesNotMatch(p, /CATEGORY BALANCE/);
  assert.doesNotMatch(p, /not enough new events to fill the limit/);
  assert.match(p, /Significance floor, not a quota\. A topic costs a reader's attention, so select EVERY event that clears the floor/);
  assert.match(p, /No category minimums, no category cap/);
});

test('the limit is stated as a hard cap with the consequence: the last topics are dropped, so count before answering', () => {
  const p = prompt();
  assert.match(p, /The limit is 15 topics in total and it is a hard cap/);
  assert.match(p, /the record keeps the first 15 of your list and discards the rest unread, so a 16th topic is lost, and the one lost is the last you wrote/);
  assert.match(p, /Count your topics before you answer, and if there are more than 15, remove the least significant yourself/);
});

test('rule 3 asks for every article that reports the event as a source of its topic, each URL in one topic only', () => {
  const p = prompt();
  assert.match(p, /Each article URL goes in exactly ONE topic/);
  assert.match(p, /list every article that reports the topic's event, not only the best one/);
});

test('W4: the floor lists the six editorial classes', () => {
  const p = prompt();
  for (const re of [
    /10 or more deaths, or 100 or more injured or displaced/,
    /head of state or government, or by a parliament/,
    /nationally significant court ruling/,
    /treaty, sanction, expulsion, recognition/,
    /strike or attack on infrastructure/,
    /disaster declaration/,
  ]) assert.match(p, re);
});

test('W4: regional diversity stays as a soft note that never overrides the floor', () => {
  const p = prompt();
  assert.match(p, /REGIONAL DIVERSITY \(soft note\)/);
  assert.match(p, /Never skip an event that clears the floor to improve the spread/);
});

test('W4: the limit follows the argument', () => {
  const p = buildSelectionPrompt({ articles, limit: 7 });
  assert.match(p, /The limit is 7 topics in total/);
  assert.match(p, /so a 8th topic is lost/);
  assert.match(p, /Task: pick up to 7 events/);
  assert.match(p, /never fill the list with one-offs or statements to reach 7\./);
});

test('rule 1 keeps merging same-event articles but never merges two different events into one topic', () => {
  const p = prompt();
  assert.match(p, /Err on the side of merging same-event articles, never of joining different events\./);
  assert.match(p, /articles about the SAME event, whatever their headlines, angles or names for the actors, go into ONE topic/);
  assert.match(p, /If a title needs "and", "as", "while" or a semicolon to hold two events, make two topics or keep only the more significant one/);
});
