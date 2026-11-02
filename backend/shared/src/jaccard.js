'use strict';

// jaccard(a, b): intersection over union of two Sets; 0 when either is empty. Pure, no deps.
// Used by newsPostDevTo (headline -> thread match) and newsDriftCorrector (did the headline or trajectory change).

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

module.exports = { jaccard };
