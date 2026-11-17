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
  assert.match(p, /HOW YOUR TOPICS ARE USED: each topic becomes one story page and one thread/);
  assert.match(p, /RULES, WITH THE REASON FOR EACH:/);
  assert.doesNotMatch(p, /CRITICAL RULES|BAD EXAMPLES|GOOD EXAMPLES/);
  assert.equal((p.match(/^\d\. (One event|Title only|Sources come|Select what|Significance floor)/gm) || []).length, 5);
});

test('W4: a significance floor replaces the topic quota and the category minimums', () => {
  const p = prompt();
  assert.doesNotMatch(p, /Generate 15 topics/);
  assert.doesNotMatch(p, /at least one topic from each/);
  assert.doesNotMatch(p, /25%/);
  assert.doesNotMatch(p, /CATEGORY BALANCE/);
  assert.doesNotMatch(p, /not enough new events to fill the limit/);
  assert.match(p, /Identify up to 15 SIGNIFICANT NEWS EVENTS/);
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
  assert.match(p, /Identify up to 7 SIGNIFICANT/);
});

test('rule 1 keeps merging same-event articles but never merges two different events into one topic', () => {
  const p = prompt();
  assert.match(p, /Err on the side of merging same-event articles, never of joining different events\./);
  assert.match(p, /articles about the SAME event, whatever their headlines, angles or names for the actors, go into ONE topic/);
  assert.match(p, /If a title needs "and", "as", "while" or a semicolon to hold two events, make two topics or keep only the more significant one/);
});
