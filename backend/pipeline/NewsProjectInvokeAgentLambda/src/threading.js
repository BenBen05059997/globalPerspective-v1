'use strict';

// Narrative threading: which story thread a topic joins. Pure (no I/O), shared by the agent's
// threadId assignment, its arc digest and backend/pipeline/cli/threads.mjs.
//
// Join rule (measured 2026-10-19, .board/linking/joins.md): a topic joins a past entry's thread when
//   1. its continues_topic names that entry's title, or
//   2. its own title is that entry's title, or
//   3. the composite score (0.5*keywords + 0.3*regions + 0.2*category) is >= JOIN_MIN_SCORE AND the
//      keyword-only Jaccard is >= JOIN_MIN_KW. Same region + same category alone scores 0.5 with zero
//      shared words; every judged wrong join had keyword overlap <= 0.10, every right one >= 0.14.
// Otherwise it starts a new thread. Titles compare normalised (case, whitespace, punctuation), so
// "Former German spy chief…" and "Former German Spy Chief…" are one story.

const crypto = require('crypto');

const JOIN_MIN_SCORE = 0.4;
const JOIN_MIN_KW = 0.15;

const THREAD_STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'is', 'are', 'was', 'were', 'as', 'by', 'its', 'be', 'with', 'from',
]);

function slugify(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80) || fallback;
}

function generateThreadId(topic) {
  const slug = slugify(topic.title || 'topic', 'topic').slice(0, 30);
  const hash = crypto.createHash('sha1').update(topic.title || '').digest('hex').slice(0, 6);
  return `thread-${slug}-${hash}`;
}

function topicSignature(topic) {
  const titleWords = String(topic.title || '')
    .toLowerCase().split(/\W+/)
    .filter(w => w.length > 2 && !THREAD_STOP_WORDS.has(w));
  const keywords = (topic.search_keywords || []).map(k => String(k).toLowerCase());
  return new Set([...titleWords, ...keywords]);
}

function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) { if (setB.has(item)) intersection++; }
  return intersection / (setA.size + setB.size - intersection);
}

// { score: composite, kwScore: keyword-only Jaccard } of a topic against one past entry.
function joinScore(topic, pastEntry) {
  const kwScore = jaccard(topicSignature(topic), topicSignature(pastEntry));
  const regionsA = new Set((topic.regions || []).map(r => String(r).toLowerCase()));
  const regionsB = new Set((pastEntry.regions || []).map(r => String(r).toLowerCase()));
  const regionScore = jaccard(regionsA, regionsB);
  const categoryScore = (topic.category || '') === (pastEntry.category || '') ? 1 : 0;
  return { score: (0.5 * kwScore) + (0.3 * regionScore) + (0.2 * categoryScore), kwScore };
}

function normalizeTitle(title) {
  return String(title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const passesJoin = ({ score, kwScore }) => score >= JOIN_MIN_SCORE && kwScore >= JOIN_MIN_KW;

const continuesEntry = (topic, entry) => Boolean(normalizeTitle(topic.continues_topic)) && normalizeTitle(entry.title) === normalizeTitle(topic.continues_topic);
const sameTitle = (topic, entry) => Boolean(normalizeTitle(topic.title)) && normalizeTitle(entry.title) === normalizeTitle(topic.title);

// The thread a topic joins among past archive entries:
// { threadId (null = start a new thread), via: 'continues_topic'|'title'|'score'|'new', score, kwScore, matched }.
// pastEntries come newest first, so a title match takes the most recent entry.
// score/kwScore are the best composite seen (for the log), or the joined entry's when it joined.
function matchThread(topic, pastEntries = []) {
  const withThread = pastEntries.filter(e => e && e.threadId);
  const cont = withThread.find(e => continuesEntry(topic, e));
  if (cont) return { threadId: cont.threadId, via: 'continues_topic', ...joinScore(topic, cont), matched: cont };
  const same = withThread.find(e => sameTitle(topic, e));
  if (same) return { threadId: same.threadId, via: 'title', ...joinScore(topic, same), matched: same };

  let best = null;
  let bestAny = { score: 0, kwScore: 0 };
  for (const entry of withThread) {
    const s = joinScore(topic, entry);
    if (s.score > bestAny.score) bestAny = s;
    if (passesJoin(s) && (!best || s.score > best.score)) best = { ...s, entry };
  }
  if (best) return { threadId: best.entry.threadId, via: 'score', score: best.score, kwScore: best.kwScore, matched: best.entry };
  return { threadId: null, via: 'new', score: bestAny.score, kwScore: bestAny.kwScore, matched: null };
}

// The thread a topic gets (a new one when nothing matches) as the agent logs it:
// { topicId, threadId, via, score, kwScore } — score/kwScore are the joined entry's, or the best seen
// for a new thread, rounded to 3 places.
function joinRecord(topic, pastEntries = []) {
  const m = matchThread(topic, pastEntries);
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    topicId: topic.id || topic.topicId || null,
    threadId: m.threadId || generateThreadId(topic),
    via: m.via,
    score: round(m.score),
    kwScore: round(m.kwScore),
  };
}

// Past entries on the same story as the topic, by the same rule (the forecast's arc digest).
function relatedEntries(topic, pastEntries = []) {
  return pastEntries.filter(e => continuesEntry(topic, e) || sameTitle(topic, e) || passesJoin(joinScore(topic, e)));
}

module.exports = {
  JOIN_MIN_SCORE, JOIN_MIN_KW,
  slugify, generateThreadId, normalizeTitle, topicSignature, jaccard, joinScore, passesJoin, matchThread, joinRecord, relatedEntries,
};
