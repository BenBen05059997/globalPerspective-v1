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
