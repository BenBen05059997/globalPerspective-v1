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

test('W2: the live prompt carries the done-not-said rule with its three examples', () => {
  const p = prompt();
  assert.match(p, /DONE, NOT SAID/);
  assert.match(p, /statement, plan, warning, call, claim, reaction, threat, pledge, poll or anniversary is NOT a topic/);
  assert.match(p, /declaration of war, a formal resignation/);
  assert.equal((p.match(/^ {3}- (REJECT|SELECT)/gm) || []).length, 3);
});

test('W4: a significance floor replaces the topic quota and the category minimums', () => {
  const p = prompt();
  assert.doesNotMatch(p, /Generate 15 topics/);
  assert.doesNotMatch(p, /at least one topic from each/);
  assert.doesNotMatch(p, /25%/);
  assert.doesNotMatch(p, /CATEGORY BALANCE/);
  assert.doesNotMatch(p, /not enough new events to fill the limit/);
  assert.match(p, /Identify up to 15 SIGNIFICANT NEWS EVENTS/);
  assert.match(p, /SIGNIFICANCE FLOOR, NOT A QUOTA: Select EVERY event that clears the floor/);
  assert.match(p, /never more than 15 topics in total/);
  assert.match(p, /no category minimums and no category cap/);
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
  assert.match(p, /never more than 7 topics in total/);
  assert.match(p, /Identify up to 7 SIGNIFICANT/);
});
