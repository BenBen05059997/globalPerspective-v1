// Unit test for the pure recommendation scorer. Run: node test-scoring.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { buildInterestProfile, isColdStart, rankRecommendations, scoreItem } = require('./scoring.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg); } };

const NOW = Date.parse('2026-06-05T12:00:00Z');
const iso = (d) => new Date(NOW - d * 86400000).toISOString();

// A small topic pool: tags chosen to exercise each signal.
const topics = [
  { topicId: 't1', threadId: 'thr-iran', title: 'Iran strike', category: 'conflict', regions: ['Iran', 'Israel'], sources: new Array(8), archivedAt: iso(0) },
  { topicId: 't2', threadId: 'thr-shipping', title: 'Red Sea shipping', category: 'economy', regions: ['Israel', 'Egypt'], sources: new Array(5), archivedAt: iso(1) },
  { topicId: 't3', threadId: 'thr-elec', title: 'EU election', category: 'politics', regions: ['Germany'], sources: new Array(2), archivedAt: iso(0) },
  { topicId: 't4', threadId: 'thr-old', title: 'Old trade', category: 'economy', regions: ['China'], sources: new Array(9), archivedAt: iso(20) },
];

// ── Cold start: no saves → trending (popularity × recency), not personalized ──
{
  const profile = buildInterestProfile([], {});
  ok(isColdStart(profile), 'empty saves → cold start');
  const ranked = rankRecommendations(topics, profile, { limit: 4, now: NOW });
  ok(ranked.every((r) => r.personalized === false), 'cold start results flagged non-personalized');
  // t1 (8 src, today) should outrank t4 (9 src but 20d old) on recency decay.
  const order = ranked.map((r) => r.topic.topicId);
  ok(order.indexOf('t1') < order.indexOf('t4'), 'fresh high-source topic beats stale high-source topic');
}

// ── Personalized: saved an Iran conflict thread → conflict+Iran/Israel boosted ──
{
  const saved = [{ itemType: 'thread', itemId: 'thr-iran' }];
  const tagIndex = { 'thr-iran': { category: 'conflict', regions: ['Iran', 'Israel'] } };
  const profile = buildInterestProfile(saved, tagIndex);
  ok(!isColdStart(profile), 'one save → not cold start');
  ok(profile.categories['conflict'] === 1, 'category weight picked up from saved thread');
  ok(profile.countries['iran'] === 1 && profile.countries['israel'] === 1, 'region weights picked up');

  const ranked = rankRecommendations(topics, profile, { limit: 4, now: NOW });
  const ids = ranked.map((r) => r.topic.topicId);
  ok(!ids.includes('t1'), 'already-saved thread (thr-iran) excluded from recommendations');
  ok(ids[0] === 't2', 'shared-region conflict-adjacent topic (Red Sea, Israel) ranks first');
  ok(ranked.every((r) => r.personalized === true), 'personalized results flagged personalized');
}

// ── Discovery, not a following feed: ALL topics of a followed thread are excluded ──
{
  const saved = [{ itemType: 'thread', itemId: 'thr-elec' }];
  // Add a sibling topic sharing the followed thread — it must also be excluded.
  const pool = [...topics, { topicId: 't5', threadId: 'thr-elec', title: 'EU runoff', category: 'politics', regions: ['Germany'], sources: new Array(1), archivedAt: iso(0) }];
  const tagIndex = { 'thr-elec': { category: 'politics', regions: ['Germany'] } };
  const profile = buildInterestProfile(saved, tagIndex);
  const ranked = rankRecommendations(pool, profile, { limit: 5, now: NOW });
  const ids = ranked.map((r) => r.topic.topicId);
  ok(!ids.includes('t3') && !ids.includes('t5'), 'every topic in a followed thread is excluded from discovery');
  // But the interest (politics/Germany) still surfaces OTHER topics — none here share it,
  // so the rail falls back to interest-agnostic recency/popularity over the rest.
  ok(ids.length > 0, 'still returns other discoverable topics');
}

// ── Country save contributes country weight ──
{
  const profile = buildInterestProfile([{ itemType: 'country', itemId: 'Germany' }], {});
  ok(profile.countries['germany'] === 2, 'saved country gets weight 2');
  ok(!isColdStart(profile), 'country save → not cold start');
}

// ── scoreItem is deterministic ──
{
  const profile = buildInterestProfile([{ itemType: 'thread', itemId: 'thr-iran' }], { 'thr-iran': { category: 'conflict', regions: ['Iran'] } });
  const a = scoreItem(topics[1], profile, NOW);
  const b = scoreItem(topics[1], profile, NOW);
  ok(a === b, 'scoreItem deterministic for same inputs');
}

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
