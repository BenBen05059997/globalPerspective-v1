'use strict';

// S3 CHECK (no model): the model's answer for one story -> accepted items and rejected items with a reason. Nothing the model
// says is kept unless it cites facts of the bundle and agrees with what the record already holds (verdicts, operator aliases).
const {isSpecific, shareIndex, NEAR_DAYS} = require('./select');
const {daysBetween} = require('./week');

const CAPS = {chapter: 8, link: 5, merge_proposal: 3, alias: 5, assignment: 5};
const LIMITS = {line: 200, chapter: 300, mechanism: 200};
const CONFIDENCE = ['high', 'medium', 'low'];
const DIRECTIONS = ['drives', 'driven_by', 'shared_cause'];
const NEW_STORY = 'new';
const QNUM = /^Q[1-9]\d*$/;

const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && (max === undefined || v.length <= max);
const strs = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Merge rule of the spec (decision 0039 / 0037 5% rule). rowA/rowB = active index rows; entry dates = last entry date of each. */
function mergeRule({rowA, rowB, lastEntryA, lastEntryB, share, confidence, citesBoth}) {
  const failed = [];
  const actors = (rowA.actorIds || []).filter((v) => (rowB.actorIds || []).includes(v) && isSpecific(share, 'actorIds', v));
  if (!actors.length) failed.push('no_shared_specific_actor');
  if (!(rowA.iso3 || []).some((v) => (rowB.iso3 || []).includes(v))) failed.push('no_shared_country');
  if (!lastEntryA || !lastEntryB || daysBetween(lastEntryA, lastEntryB) > NEAR_DAYS) failed.push('entries_not_within_14_days');
  if (!citesBoth) failed.push('cites_not_from_both');
  if (confidence !== 'high') failed.push('confidence_not_high');
  return {ok: failed.length === 0, failed};
}

/** operator aliases -> Map(actorId -> canonical) */
function operatorMap(aliases) {
  const m = new Map();
  for (const a of aliases || []) {
    if (!a || !a.canonical) continue;
    m.set(a.canonical, a.canonical);
    for (const v of a.variants || []) m.set(v, a.canonical);
  }
  return m;
}

/**
 * answer: the parsed model output. ctx: {row, mine (assemble result), world, assembleOther(threadId) -> assemble result | null}.
 * -> {accepted: [{subtype, payload, cites, confidence, autoMerge}], rejected: [{subtype, reason, detail}]}
 */
function checkAnswer(answer, ctx) {
  const {row, mine, world} = ctx;
  const accepted = [];
  const rejected = [];
  const reject = (subtype, reason, detail) => rejected.push({subtype, reason, ...(detail ? {detail: String(detail).slice(0, 160)} : {})});
  const share = shareIndex(world.rows);
  const op = operatorMap(world.operatorAliases);
  const seen = new Set();
  const counts = {};
  const others = new Map();
  const otherOf = (id) => { if (!others.has(id)) others.set(id, ctx.assembleOther(id)); return others.get(id); };

  const take = (subtype, key, item, build) => {
    const confidence = CONFIDENCE.includes(item && item.confidence) ? item.confidence : 'low';
    const id = `${subtype}|${key}`;
    if (seen.has(id)) return reject(subtype, 'duplicate', key);
    counts[subtype] = (counts[subtype] || 0) + 1;
    if (CAPS[subtype] && counts[subtype] > CAPS[subtype]) return reject(subtype, 'over_cap', key);
    const cites = item && Array.isArray(item.cites) ? item.cites : null;
    if (!cites || !strs(cites)) return reject(subtype, 'bad_shape', 'cites');
    if (!cites.length) return reject(subtype, 'no_citation');
    const built = build({confidence, cites: [...new Set(cites)]});
    if (!built) return undefined;
    seen.add(id);
    return accepted.push({subtype, confidence, cites: [...new Set(cites)], ...built });
  };

  const ownCites = (subtype, cites) => {
    const foreign = cites.filter((c) => !mine.citable.has(c));
    if (foreign.length) { reject(subtype, 'unknown_eventId', foreign.join(',')); return false; }
    return true;
  };
  const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : null);
  const each = (name, subtype, fn) => {
    const items = list(answer[name]);
    if (items === null) return reject(subtype, 'bad_shape', `${name} is not a list`);
    items.forEach((it) => (it && typeof it === 'object' ? fn(it) : reject(subtype, 'bad_shape', `${name} item`)));
    return undefined;
  };

  // line
  if (answer.line !== undefined && answer.line !== null) {
    const it = answer.line;
    if (typeof it !== 'object' || !str(it.text, LIMITS.line)) reject('line', 'bad_shape', 'text missing or over 200 chars');
    else take('line', '', it, ({cites}) => (ownCites('line', cites) ? {payload: {text: it.text.trim()}} : null));
  }

  // chapters: the model gives title, summary and cites; the span is the dates of the cited facts (so it is the chapter key too)
  each('chapters', 'chapter', (it) => {
    if (!str(it.title, 120) || !str(it.summary, LIMITS.chapter) || !Array.isArray(it.cites) || !strs(it.cites)) return reject('chapter', 'bad_shape', it.title);
    if (!it.cites.length) return reject('chapter', 'no_citation');
    if (!ownCites('chapter', it.cites)) return undefined;
    const days = it.cites.map((c) => mine.dates.get(c)).filter(Boolean).sort();
    if (!days.length) return reject('chapter', 'no_dated_citation', it.title);
    const from = days[0];
    const to = days[days.length - 1];
    return take('chapter', from, it, () => ({payload: {title: it.title.trim(), from, to, summary: it.summary.trim()}}));
  });

  // links and merge proposals share the two-story citation rule
  const twoStory = (subtype, it, cites) => {
    const other = otherOf(it.otherThreadId);
    if (!other) { reject(subtype, 'unknown_story', it.otherThreadId); return null; }
    const foreign = cites.filter((c) => !mine.citable.has(c) && !other.citable.has(c));
    if (foreign.length) { reject(subtype, 'unknown_eventId', foreign.join(',')); return null; }
    if (!cites.some((c) => mine.citable.has(c)) || !cites.some((c) => other.citable.has(c))) { reject(subtype, 'cites_not_from_both', it.otherThreadId); return null; }
    return other;
  };
  const validOther = (it) => str(it.otherThreadId) && it.otherThreadId !== row.threadId;

  each('links', 'link', (it) => {
    if (!validOther(it) || !str(it.mechanism, LIMITS.mechanism) || !DIRECTIONS.includes(it.direction)) return reject('link', 'bad_shape', it.otherThreadId);
    return take('link', it.otherThreadId, it, ({cites}) => (twoStory('link', it, cites)
      ? {payload: {otherThreadId: it.otherThreadId, mechanism: it.mechanism.trim(), direction: it.direction}} : null));
  });

  each('mergeProposals', 'merge_proposal', (it) => {
    if (!validOther(it) || !str(it.why, 300)) return reject('merge_proposal', 'bad_shape', it.otherThreadId);
    return take('merge_proposal', it.otherThreadId, it, ({cites, confidence}) => {
      const other = twoStory('merge_proposal', it, cites);
      if (!other) return null;
      const rowB = world.rows.find((r) => r.threadId === it.otherThreadId);
      const rule = mergeRule({rowA: row, rowB, lastEntryA: mine.lastEntry, lastEntryB: other.lastEntry, share, confidence, citesBoth: true});
      let autoMerge = null;
      if (rule.ok) {
        const older = (row.born || '') < (rowB.born || '') || ((row.born || '') === (rowB.born || '') && row.threadId < rowB.threadId) ? row : rowB;
        autoMerge = {into: older.threadId, from: older === row ? rowB.threadId : row.threadId};
      }
      return {payload: {otherThreadId: it.otherThreadId, why: it.why.trim()}, autoMerge, autoBlocked: rule.failed};
    });
  });

  // assignment proposals (0040 rule 3, answer 6): written as readings, never applied. The entry is one of this story's shown entries, or
  // a neighbour's entry the model cites; every cite is an eventId the model was shown (this story's, or a neighbour's entry).
  each('assignments', 'assignment', (it) => {
    if (!str(it.entryId) || !str(it.threadId) || !str(it.why, 300)) return reject('assignment', 'bad_shape', it.entryId);
    return take('assignment', it.entryId, it, ({cites}) => {
      const foreign = cites.filter((c) => !mine.citable.has(c) && !mine.neighbourEntries.has(c));
      if (foreign.length) { reject('assignment', 'unknown_eventId', foreign.join(',')); return null; }
      const owner = mine.entryIds.has(it.entryId) ? row.threadId : cites.includes(it.entryId) ? mine.neighbourEntries.get(it.entryId) : undefined;
      if (!owner) { reject('assignment', 'entry_not_in_scope', it.entryId); return null; }
      if (it.threadId !== NEW_STORY && !world.rows.some((r) => r.threadId === it.threadId)) { reject('assignment', 'unknown_story', it.threadId); return null; }
      if (it.threadId === owner) { reject('assignment', 'already_assigned', it.threadId); return null; }
      return {payload: {entryId: it.entryId, threadId: it.threadId, why: it.why.trim()}};
    });
  });

  // aliases
  each('aliases', 'alias', (it) => {
    if (!Array.isArray(it.variants) || !it.variants.length || !it.variants.every((v) => str(v) && v.startsWith('name:')) || !str(it.canonical) || !it.canonical.startsWith('name:') || it.variants.includes(it.canonical)) {
      return reject('alias', 'bad_shape', it.canonical);
    }
    return take('alias', it.canonical, it, ({cites}) => {
      if (!ownCites('alias', cites)) return null;
      if (typeof it.wikidataId !== 'string' || !QNUM.test(it.wikidataId)) { reject('alias', 'alias_no_wikidata', it.canonical); return null; }
      if (!it.variants.every((v) => mine.actorIds.includes(v))) { reject('alias', 'alias_unknown_actor', it.variants.join(',')); return null; }
      const clash = it.variants.find((v) => op.has(v) && op.get(v) !== it.canonical) || (op.has(it.canonical) && op.get(it.canonical) !== it.canonical ? it.canonical : null);
      if (clash) { reject('alias', 'alias_conflicts_operator', clash); return null; }
      return {payload: {variants: [...it.variants].sort(), canonical: it.canonical, wikidataId: it.wikidataId}};
    });
  });

  return {accepted, rejected};
}

module.exports = {checkAnswer, mergeRule, operatorMap, CAPS};
