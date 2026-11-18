'use strict';
// selection.js: the selector's steps as functions of their inputs (decision 0061 lifted them out of the handler for the recovery script).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/selection');
const { ageLabel } = require('../src/_shared/rss');

const NOW = Date.parse('2026-11-14T20:15:00Z');
const pool = [
  { title: 'Quake hits coast of Chile', url: 'https://a.example/1', source: 'bbc.com', description: 'A strong quake struck.', age: '1 hour ago', publishedAt: '2026-11-14T19:00:00.000Z', feed: 'BBC World' },
  { title: 'Parliament passes budget in Kenya', url: 'https://b.example/2', source: 'dw.com', description: 'Budget passed.', age: '3 hours ago', publishedAt: '2026-11-14T17:00:00.000Z', feed: 'DW English' },
];
const answer = (topics) => JSON.stringify({ topics });

test('ageLabel is the label parseRssXml gives, for a fixed clock', () => {
  const t = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(ageLabel(t, t + 10 * 60000), 'Just now');
  assert.equal(ageLabel(t, t + 3 * 3600000), '3 hours ago');
  assert.equal(ageLabel(t, t + 50 * 3600000), '2 days ago');
});

test('selectionChatOptions is the live selection call: step, JSON, caps', () => {
  const o = S.selectionChatOptions({ prompt: 'P', model: 'm' });
  assert.deepEqual([o.step, o.model, o.user, o.json, o.temperature, o.maxTokens, o.timeoutMs, o.retries], ['topic_selection', 'm', 'P', true, 0.5, 16000, 600000, 2]);
});

test('selectionRequest builds the pool prompt, and the fallback prompt for an empty pool', () => {
  const a = S.selectionRequest({ articles: pool, limit: 13 });
  assert.match(a.prompt, /=== NEWS ARTICLES ===/);
  assert.match(a.prompt, /Quake hits coast of Chile/);
  assert.equal(a.promptCount, 2);
  const b = S.selectionRequest({ articles: [], limit: 13 });
  assert.match(b.prompt, /trending on X/);
});

test('processSelection validates urls against the pool, drops repeats of the last 24 h, caps to the limit', () => {
  const text = answer([
    { title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }, { url: 'https://invented.example/x' }], iso3: ['CHL'] },
    { title: 'Kenya parliament passes budget', category: 'diplomacy', sources: [{ url: 'https://b.example/2' }] },
    { title: 'No valid source', category: 'politics', sources: [{ url: 'https://invented.example/y' }] },
  ]);
  const out = S.processSelection({ text, articles: pool, limit: 13, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' } });
  assert.equal(out.normalizedCount, 3);
  assert.deepEqual(out.topics.map((t) => [t.id, t.category, t.sources.length]), [['Strong quake strikes Chile coast-0', 'disaster', 1], ['Kenya parliament passes budget-1', 'politics', 1]]);
  assert.equal(out.topics[0].sources[0].publishedAt, '2026-11-14T19:00:00.000Z');
  const again = S.processSelection({ text, articles: pool, limit: 1, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' }, seenEntries: [{ title: 'Strong quake strikes Chile coast' }] });
  assert.deepEqual(again.topics.map((t) => t.title), ['Kenya parliament passes budget']);
  assert.equal(again.droppedRepeats.length, 1);
});

test('the yesterday cut of the repeat check follows nowMs, not the real clock', () => {
  const text = answer([{ title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }] }]);
  const past = [{ date: '2026-11-13', title: 'Strong quake strikes Chile coast' }];
  const kept = S.processSelection({ text, articles: pool, limit: 5, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' }, archiveEntries: past });
  assert.equal(kept.topics.length, 0, '11-13 is within 24 h of 11-14 20:15 by the day cut');
  const old = S.processSelection({ text, articles: pool, limit: 5, nowMs: NOW + 3 * 86400000, env: { SOURCE_ENRICH_ENABLED: 'false' }, archiveEntries: past });
  assert.equal(old.topics.length, 1);
});

test('seen-today list: the 24 h window and the merge of a run', () => {
  const seen = [{ fingerprint: 'a', title: 'A', seenAt: NOW - 25 * 3600000 }, { fingerprint: 'b', title: 'B', seenAt: NOW - 3600000 }];
  assert.deepEqual(S.freshSeen(seen, NOW).map((e) => e.title), ['B']);
  const next = S.nextSeenEntries(S.freshSeen(seen, NOW), [{ title: 'B' }, { title: 'C' }], NOW);
  assert.deepEqual(next.map((e) => [e.title, e.seenAt]), [['B', NOW], ['C', NOW]]);
});

test('dedupeByUrl keeps the first of each url and drops rows without one', () => {
  assert.deepEqual(S.dedupeByUrl([{ url: 'u1', t: 1 }, { url: 'u1', t: 2 }, { t: 3 }, { url: 'u2', t: 4 }]).map((a) => a.t), [1, 4]);
});

test('the feed list is exported for the replay (feed name -> source domain)', () => {
  assert.equal(S.RSS_FEEDS.find((f) => f.name === 'BBC World').source, 'bbc.com');
});

// ---- the stories we follow ---------------------------------------------------------------------------------------------------------------

const quietly = (fn) => { const orig = [console.log, console.warn]; const out = []; console.log = console.warn = (...a) => out.push(a.join(' ')); try { return { value: fn(), out }; } finally { [console.log, console.warn] = orig; } };
const entry = (date, threadId, title, archivedAt) => ({ date, threadId, title, ...(archivedAt ? { archivedAt } : {}) });

test('followedStories: one line per thread, numbered in order, multi-entry stories first, newest first in each group', () => {
  const entries = [
    entry('2026-11-14', 'th-iran', 'Iran Fires Missiles at Tanker', '2026-11-14T04:20:00Z'),
    entry('2026-11-14', 'th-iran', 'Iran Seizes Second Tanker', '2026-11-14T12:20:00Z'),
    entry('2026-11-10', 'th-iran', 'Iran Closes Hormuz Lane', '2026-11-10T04:20:00Z'),
    entry('2026-11-14', 'th-crash', 'Bus Crash Kills 12 in Peru', '2026-11-14T20:20:00Z'),
    entry('2026-11-12', 'th-kenya', 'Kenya Budget Passes First Reading'),
    entry('2026-11-13', 'th-kenya', 'Kenya Senate Passes Budget'),
    entry('2026-11-13', 'th-quake', 'Quake Hits Chile Coast'),
  ];
  const { value: { stories, cut }, out } = quietly(() => S.followedStories(entries, NOW));
  assert.deepEqual(stories.map((s) => [s.key, s.threadId, s.lastDate, s.count, s.title, s.firstTitle]), [
    ['S1', 'th-iran', '2026-11-14', 3, 'Iran Seizes Second Tanker', 'Iran Closes Hormuz Lane'],
    ['S2', 'th-kenya', '2026-11-13', 2, 'Kenya Senate Passes Budget', 'Kenya Budget Passes First Reading'],
    ['S3', 'th-crash', '2026-11-14', 1, 'Bus Crash Kills 12 in Peru', 'Bus Crash Kills 12 in Peru'],
    ['S4', 'th-quake', '2026-11-13', 1, 'Quake Hits Chile Coast', 'Quake Hits Chile Coast'],
  ]);
  assert.equal(cut, 0);
  assert.deepEqual(out, ['FOLLOWED: 4 stories listed, 0 cut']);
});

test('followedStories: the newest title is by day, then archive time, then input order (the row is oldest generation first)', () => {
  const { value } = quietly(() => S.followedStories([
    entry('2026-11-14', 't', 'Later in the day', '2026-11-14T20:00:00Z'),
    entry('2026-11-14', 't', 'Earlier in the day', '2026-11-14T04:00:00Z'),
    entry('2026-11-13', 't', 'Day before'),
    entry('2026-11-13', 'u', 'First of the row'),
    entry('2026-11-13', 'u', 'Second of the row'),
  ], NOW));
  assert.deepEqual(value.stories.map((s) => [s.title, s.firstTitle]), [['Later in the day', 'Day before'], ['Second of the row', 'First of the row']]);
});

test('followedStories: today and the 14 days before only; entries without a thread id or title are not listed; empty input', () => {
  const { value } = quietly(() => S.followedStories([
    entry('2026-10-31', 'old', 'Fifteen days back'),
    entry('2026-10-30', 'older', 'Sixteen days back'),
    entry('2026-11-15', 'future', 'After now'),
    { date: '2026-11-14', title: 'No thread id' },
    entry('2026-11-14', 'notitle', ''),
    null,
  ], NOW));
  assert.deepEqual(value.stories.map((s) => s.threadId), ['old']);
  assert.equal(S.FOLLOWED_DAYS, 14);
  assert.deepEqual(quietly(() => S.followedStories([], NOW)).value, { stories: [], cut: 0 });
  assert.deepEqual(quietly(() => S.followedStories(undefined, NOW)).value, { stories: [], cut: 0 });
});

test('followedStories: the cap of 350 cuts the oldest single-entry stories first and logs the cut', () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push(entry('2026-11-01', `multi${i}`, `Multi ${i} a`), entry('2026-11-02', `multi${i}`, `Multi ${i} b`));
  for (let i = 0; i < 400; i++) entries.push(entry(i < 200 ? '2026-11-14' : '2026-11-03', `single${i}`, `Single ${i}`));
  const { value: { stories, cut }, out } = quietly(() => S.followedStories(entries, NOW));
  assert.equal(S.FOLLOWED_CAP, 350);
  assert.equal(stories.length, 350);
  assert.equal(cut, 60);
  assert.ok(stories.slice(0, 10).every((s) => s.count === 2), 'the multi-entry stories stay though they are the oldest');
  assert.equal(stories.filter((s) => s.lastDate === '2026-11-14').length, 200, 'every newer single stays');
  assert.equal(stories.filter((s) => s.lastDate === '2026-11-03').length, 140);
  assert.equal(stories[349].key, 'S350');
  assert.deepEqual(out, ['FOLLOWED: 350 stories listed, 60 cut']);
});

// ---- the answer: follows and measure ---------------------------------------------------------------------------------------------------

const followed = [
  { key: 'S1', threadId: 'thread-quake', lastDate: '2026-11-14', count: 3, title: 'Quake Hits Chile Coast' },
  { key: 'S2', threadId: 'thread-kenya', lastDate: '2026-11-13', count: 1, title: 'Kenya Budget Passes First Reading' },
];
const run = (topics, extra = {}) => quietly(() => S.processSelection({ text: answer(topics), articles: pool, limit: 13, nowMs: NOW, env: { SOURCE_ENRICH_ENABLED: 'false' }, stories: followed, ...extra }));

test('follows: a listed number sets continues_thread and the listed title; unknown is dropped and logged; absent is a start', () => {
  const { value, out } = run([
    { title: 'Aftershock Hits Chile Coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }], follows: 'S1' },
    { title: 'Kenya Parliament Passes Budget', category: 'politics', sources: [{ url: 'https://b.example/2' }], follows: 'S99' },
  ]);
  const [moved, unknown] = value.topics;
  assert.equal(moved.continues_thread, 'thread-quake');
  assert.equal(moved.continues_topic, 'Quake Hits Chile Coast');
  assert.equal('follows' in moved, false, 'the number is run-local and is not stored');
  assert.equal('continues_thread' in unknown, false);
  assert.equal('continues_topic' in unknown, false);
  assert.ok(out.includes('FOLLOWS: unknown "S99" for: Kenya Parliament Passes Budget'), out.join('\n'));
  const start = run([{ title: 'Kenya Parliament Passes Budget', category: 'politics', sources: [{ url: 'https://b.example/2' }] }]).value.topics[0];
  assert.equal('continues_thread' in start, false);
  assert.equal('continues_topic' in start, false);
});

test('follows: the model\'s own continues_topic is ignored; a lower-case or spaced number still maps', () => {
  const { value } = run([
    { title: 'Kenya Parliament Passes Budget', category: 'politics', sources: [{ url: 'https://b.example/2' }], continues_topic: 'Some Title The Model Copied' },
    { title: 'Aftershock Hits Chile Coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }], follows: ' s2 ' },
  ]);
  assert.equal('continues_topic' in value.topics[0], false);
  assert.equal(value.topics[1].continues_thread, 'thread-kenya');
});

test('event_type measure is kept; an unknown value still becomes other', () => {
  const { value } = run([
    { title: 'Argentina Inflation Falls to 2.4% Monthly', category: 'economy', sources: [{ url: 'https://a.example/1' }], event_type: 'measure' },
    { title: 'Kenya Parliament Passes Budget', category: 'politics', sources: [{ url: 'https://b.example/2' }], event_type: 'statistic' },
  ]);
  assert.deepEqual(value.topics.map((t) => t.event_type), ['measure', 'other']);
});

test('the repeat drop is unchanged and its log line names the followed story', () => {
  const { value, out } = run(
    [{ title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }], follows: 'S1' }],
    { seenEntries: [{ title: 'Strong quake strikes Chile coast' }] },
  );
  assert.equal(value.topics.length, 0);
  assert.ok(out.includes('DEDUPE: dropped repeat "Strong quake strikes Chile coast" [follows S1] (repeats "Strong quake strikes Chile coast")'), out.join('\n'));
  const plain = run([{ title: 'Strong quake strikes Chile coast', category: 'disaster', sources: [{ url: 'https://a.example/1' }] }], { seenEntries: [{ title: 'Strong quake strikes Chile coast' }] });
  assert.ok(plain.out.includes('DEDUPE: dropped repeat "Strong quake strikes Chile coast" (repeats "Strong quake strikes Chile coast")'));
});

test('selectionRequest puts the followed list in the prompt', () => {
  const { value } = quietly(() => S.selectionRequest({ articles: pool, limit: 13, stories: followed }));
  assert.match(value.prompt, /^S1 · 2026-11-14 · 3 · Quake Hits Chile Coast$/m, 'no firstTitle: no began part');
  assert.match(value.prompt, /^S2 · 2026-11-13 · 1 · Kenya Budget Passes First Reading$/m);
});

// ---- the whole handler: archive -> followed list -> prompt -> answer -> staging -------------------------------------------------------------

const { runHandler } = require('./fakes');

test('handler: reads today and 14 days of archive rows, lists the stories by thread id, and maps a canned follows to the staging topic', async () => {
  const archive = {
    '2026-10-22': [{ title: 'Earlier quake run', threadId: 'thread-quake', archivedAt: '2026-10-22T04:20:00Z' }],
    '2026-10-20': [{ title: 'Chile Quake Kills 40', threadId: 'thread-quake' }, { title: 'An entry with no thread' }],
    '2026-10-08': [{ title: 'Fourteen days back', threadId: 'thread-old' }],
    '2026-10-07': [{ title: 'Fifteen days back: not read', threadId: 'thread-gone' }],
  };
  const topics = (urls) => [
    { title: 'Chile Aftershock Damages Port', category: 'disaster', sources: [{ url: urls[0] }], follows: 'S1', event_type: 'disaster' },
    { title: 'Chile Central Bank Data Shows Record Copper Exports', category: 'economy', sources: [{ url: urls[1] }], event_type: 'measure' },
    { title: 'Kenya Parliament Passes Budget', category: 'politics', sources: [{ url: urls[2] }], follows: 'S7' },
  ];
  const { prompts, written, reads } = await runHandler({ archive, topics, seen: ['Something seen today'] });
  const archiveReads = reads.filter((k) => String(k).startsWith('archive#')).sort();
  assert.equal(archiveReads.length, 15);
  assert.deepEqual([archiveReads[0], archiveReads[14]], ['archive#2026-10-08', 'archive#2026-10-22']);
  const p = prompts[0];
  assert.match(p, /^STORIES WE FOLLOW .*\nS1 · 2026-10-22 · 2 · Earlier quake run \(began: Chile Quake Kills 40\)\nS2 · 2026-10-08 · 1 · Fourteen days back\n\n/m);
  assert.doesNotMatch(p, /An entry with no thread|Fifteen days back|Something seen today|PREVIOUSLY COVERED/);
  const staged = written.find((i) => i.id === 'staging').topics;
  assert.deepEqual(staged.map((t) => [t.title, t.continues_thread || null, t.continues_topic || null, t.event_type]), [
    ['Chile Aftershock Damages Port', 'thread-quake', 'Earlier quake run', 'disaster'],
    ['Chile Central Bank Data Shows Record Copper Exports', null, null, 'measure'],
    ['Kenya Parliament Passes Budget', null, null, 'other'],
  ]);
});

test('handler: an unreadable archive leaves an empty list and the run goes on (decision 0057)', async () => {
  const { result, prompts, written } = await runHandler({ archiveError: 'DynamoDB is down' });
  assert.equal(result.status, 'ok');
  assert.match(prompts[0], /^STORIES WE FOLLOW .*\n\(none\)$/m);
  assert.equal(written.find((i) => i.id === 'staging').topics.length, 1);
});

test('story lines: one entry has no began part, two or more show the oldest title, equal titles show none; the cap still cuts oldest singles', () => {
  const entries = [
    entry('2026-11-10', 'th-two', 'Kerch Bridge Struck by Ukrainian Missiles'),
    entry('2026-11-14', 'th-two', 'Russian Strikes Hit Two Dnipro Bridges in Kyiv'),
    entry('2026-11-12', 'th-same', 'Measles Elimination Status Lost'),
    entry('2026-11-13', 'th-same', 'Measles Elimination Status Lost'),
    entry('2026-11-14', 'th-one', 'Quake Hits Chile Coast'),
  ];
  for (let i = 0; i < 360; i++) entries.push(entry(i < 300 ? '2026-11-13' : '2026-11-01', `single${i}`, `Single ${i}`));
  const { value: { stories, cut } } = quietly(() => S.followedStories(entries, NOW));
  const p = quietly(() => S.selectionRequest({ articles: pool, limit: 13, stories })).value.prompt;
  assert.match(p, /^S1 · 2026-11-14 · 2 · Russian Strikes Hit Two Dnipro Bridges in Kyiv \(began: Kerch Bridge Struck by Ukrainian Missiles\)$/m);
  assert.match(p, /^S2 · 2026-11-13 · 2 · Measles Elimination Status Lost$/m);
  assert.match(p, /^S3 · 2026-11-14 · 1 · Quake Hits Chile Coast$/m);
  assert.equal((p.match(/\(began: /g) || []).length - 1, 1, 'one began line besides the header');
  assert.equal(cut, 13);
  assert.equal(stories.filter((s) => s.lastDate === '2026-11-01').length, 47, 'the oldest singles are the ones cut');
});
