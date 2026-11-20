'use strict';

// dropRedatedRepeats: the archive re-wrote some old headlines under a later date. Keep only a headline's EARLIEST
// appearance, so a story's steps never claim news that did not happen. The function below is the same text as the
// frontend's shared/lib/dropRedatedRepeats.js (an ES module; also copied byte-identical into newsSharedAnalysis);
// scripts/check-shared-sync.mjs compares the two. newsStoryRecord counts a story's steps after it (views.js).
function dropRedatedRepeats(entries) {
  if (!Array.isArray(entries)) return entries;
  const earliest = new Map();
  for (const e of entries) {
    const key = String(e?.title || '').trim().toLowerCase();
    if (!key) continue;
    const prev = earliest.get(key);
    if (!prev || String(e.date || '') < String(prev.date || '')) earliest.set(key, e);
  }
  return entries.filter((e) => {
    const key = String(e?.title || '').trim().toLowerCase();
    return !key || earliest.get(key) === e;
  });
}

module.exports = { dropRedatedRepeats };
