// cardMentions — deterministic in-text links for the story card (STORY_DOSSIER_BOARD_DESIGN_BRIEF
// "Links inside the summary text"): a mention becomes a link ONLY when it is an exact, whole-word,
// case-insensitive occurrence of the full title of a story that really exists in the story-web index
// (`web_index.threads{id:{title}}`, already loaded by the console). Nothing is matched loosely (no
// keywords, no partial titles); an unmatched mention stays plain text. Pure and DOM-free.

// Titles shorter than this are not matchable (a three-word title like "Iran talks" would match
// ordinary prose and could only be a guess about which story is meant).
export const MIN_TITLE_CHARS = 15;

/**
 * knownStoryTitles(threads, excludeId) -> [{ id, title, lower }] longest title first.
 * Skips the open story itself, short titles, and any title that two different stories share
 * (ambiguous: which one would the text mean?).
 */
export function knownStoryTitles(threads, excludeId = null) {
  if (!threads || typeof threads !== 'object') return [];
  const byLower = new Map();
  for (const [id, t] of Object.entries(threads)) {
    const title = typeof t?.title === 'string' ? t.title.trim() : '';
    if (!id || id === excludeId || title.length < MIN_TITLE_CHARS) continue;
    const lower = title.toLowerCase();
    const prev = byLower.get(lower);
    if (prev && prev.id !== id) { prev.ambiguous = true; continue; }
    if (!prev) byLower.set(lower, { id, title, lower, ambiguous: false });
  }
  return [...byLower.values()].filter((k) => !k.ambiguous).sort((a, b) => b.title.length - a.title.length);
}

// hyphens and apostrophes continue a word ("closure-related", "Iran's"): a title that is only the start of one is not a mention
const isWordChar = (ch) => !!ch && /[\p{L}\p{N}\-'\u2019]/u.test(ch);

/**
 * linkMentions(text, known) -> [{ text } | { text, threadId }]
 * Concatenating every segment's text gives back the input exactly.
 */
export function linkMentions(text, known) {
  const src = typeof text === 'string' ? text : '';
  if (!src) return [];
  if (!known || !known.length) return [{ text: src }];
  const lower = src.toLowerCase();
  // toLowerCase can change the length for a few characters; offsets would then be wrong, so link nothing.
  if (lower.length !== src.length) return [{ text: src }];
  const hits = [];
  for (const k of known) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(k.lower, from);
      if (at < 0) break;
      const end = at + k.lower.length;
      if (!isWordChar(src[at - 1]) && !isWordChar(src[end])) hits.push({ at, end, id: k.id });
      from = at + 1;
    }
  }
  // longest first (known is sorted that way and indexOf order keeps it), then drop overlaps left to right
  hits.sort((a, b) => a.at - b.at || (b.end - b.at) - (a.end - a.at));
  const out = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.at < cursor) continue;
    if (h.at > cursor) out.push({ text: src.slice(cursor, h.at) });
    out.push({ text: src.slice(h.at, h.end), threadId: h.id });
    cursor = h.end;
  }
  if (cursor < src.length) out.push({ text: src.slice(cursor) });
  return out;
}

const CONF_RANK = { strong: 3, medium: 2, weak: 1 };

/**
 * linkedStoryLines(derived, max) -> { into: [{ id, title, confidence }], from: [...] }
 * The stories this one is judged to feed into / was fed by, read from webIndexLinks.deriveFromIndex():
 * one entry per distinct story (its strongest analysis' confidence), strongest first, only stories whose
 * title is known, at most `max` per direction. Model judgment, never a causal claim.
 */
export function linkedStoryLines(derived, max = 3) {
  const pick = (rows, idKey, titleKey) => {
    const best = new Map();
    for (const r of rows || []) {
      const id = r?.[idKey];
      const title = r?.[titleKey];
      if (!id || !title) continue;
      const rank = CONF_RANK[r.confidence] || 0;
      const prev = best.get(id);
      if (!prev || rank > prev.rank) best.set(id, { id, title, confidence: r.confidence || null, rank });
    }
    return [...best.values()].sort((a, b) => b.rank - a.rank).slice(0, max).map((x) => ({ id: x.id, title: x.title, confidence: x.confidence }));
  };
  return {
    into: pick(derived?.fedInto, 'targetThreadId', 'targetTitle'),
    from: pick(derived?.fedFrom, 'sourceThreadId', 'sourceTitle'),
  };
}
