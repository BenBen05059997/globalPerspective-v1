'use strict';

// Batch 4 / E: the systems prompt used to give the model each story as opaque topic ids (the 5
// newest), so it could not see what a cited entry said or when. Now each story lists up to N
// DATED entries spread across its whole span (always the oldest and the newest, the rest at even
// steps), and only those entries may be cited. Pure and deterministic.

const MAX_SHOWN = 10;
const TITLE_MAX = 110;

const cleanTitle = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').replace(/"/g, "'").trim().slice(0, TITLE_MAX);

/**
 * @param {Array<{topicId:string,date:string,title:string}>} entries a story's entries (any order)
 * @returns {Array<{topicId:string,date:string,title:string}>} up to `max`, ascending by date
 */
function pickSpreadEntries(entries, max = MAX_SHOWN) {
  const seen = new Set();
  const list = [];
  for (const e of entries || []) {
    if (!e || !e.topicId || seen.has(e.topicId)) continue;
    seen.add(e.topicId);
    list.push({ topicId: e.topicId, date: String(e.date || ''), title: cleanTitle(e.title) });
  }
  list.sort((a, b) => (a.date === b.date ? (a.topicId < b.topicId ? -1 : 1) : a.date < b.date ? -1 : 1));
  if (list.length <= max) return list;
  const picked = new Set();
  for (let i = 0; i < max; i++) picked.add(Math.round((i * (list.length - 1)) / (max - 1)));
  return [...picked].sort((a, b) => a - b).map((i) => list[i]);
}

module.exports = { pickSpreadEntries, cleanTitle, MAX_SHOWN };
