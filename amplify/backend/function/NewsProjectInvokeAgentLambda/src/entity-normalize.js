'use strict';

// ⚠️ COPIED LOGIC — keep byte-identical with
// amplify/backend/function/newsSituationIngest/src/classifier-core.js (normalizeEntity +
// ACTOR_ALIASES + ENTITY_ORG_SUFFIX/ENTITY_TITLE_PREFIX). If that file's actor-folding rules change,
// port the change here too — the R3 fingerprint match depends on BOTH sides normalizing identically.
// (No cross-Lambda require is possible; this is a different deploy unit.)

// Conservative entity-key normalization (audit F1 — storyId fragmentation). Folds obvious lexical
// variants of the SAME actor onto one cluster key (e.g. "President Trump", "Trump administration",
// "the Trump Administration" → "trump") WITHOUT fuzzy/similarity merging — merging two DISTINCT
// actors would hide a real situation, which is worse than fragmenting one. Strips a small set of
// leading honorifics/titles and trailing generic org words only; leaves everything else intact.
const ENTITY_TITLE_PREFIX = /^(the\s+)?(president|vice[- ]president|prime minister|pm|mr|mrs|ms|dr|sir|king|queen|general|senator|governor|secretary|foreign minister|defense minister|defence minister|minister|chancellor|ambassador|pope)\s+/i;
const ENTITY_ORG_SUFFIX = /\s+(administration|government|govt|regime|cabinet|ministry|authorities|officials?)$/i;
// Actor-alias fold (identity pass 2, S5.5·T3b) — the dominant fragmentation pass 1 couldn't safely
// catch: given-name/full-name variants of ONE recurring world figure ("donald trump" & "trump" →
// "trump"). This is NAME-variant normalization, not a claim about who currently holds office (a fold
// stays correct regardless of office), so it carries no leader-accuracy risk. Curated + bounded
// (editorial-fact-layer pattern); every canonical is an UNAMBIGUOUS surname — where a surname is
// shared or too short, the full name is kept as its own canonical (e.g. 'xi jinping', 'kim jong un').
// A missing/misspelled key is a harmless no-op (just no fold). Extend as new figures recur.
const ACTOR_ALIASES = {
  'donald trump': 'trump', 'donald j trump': 'trump',
  'joe biden': 'biden', 'joseph biden': 'biden',
  'vladimir putin': 'putin',
  'volodymyr zelensky': 'zelensky', 'volodymyr zelenskyy': 'zelensky', 'zelenskyy': 'zelensky',
  'benjamin netanyahu': 'netanyahu',
  'narendra modi': 'modi',
  'emmanuel macron': 'macron',
  'keir starmer': 'starmer',
  'recep tayyip erdogan': 'erdogan', 'tayyip erdogan': 'erdogan',
  'ali khamenei': 'khamenei', 'ayatollah ali khamenei': 'khamenei',
  'masoud pezeshkian': 'pezeshkian',
  'giorgia meloni': 'meloni',
  'viktor orban': 'orban',
  'luiz inacio lula da silva': 'lula', 'lula da silva': 'lula',
  'javier milei': 'milei',
  'nicolas maduro': 'maduro',
  'ursula von der leyen': 'von der leyen',
  'antonio guterres': 'guterres',
};
function normalizeEntity(s) {
  let e = String(s || '').toLowerCase().trim();
  e = e.replace(/^the\s+/, '');       // leading article ("the Trump administration")
  e = e.replace(ENTITY_ORG_SUFFIX, '');
  e = e.replace(ENTITY_TITLE_PREFIX, '');
  e = e.trim();
  return ACTOR_ALIASES[e] || e;       // fold full-name/variant → canonical surname
}

module.exports = { normalizeEntity };
