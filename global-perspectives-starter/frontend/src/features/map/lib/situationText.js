// situationText — wording helpers for the situation card (pure).

/**
 * changeNote(situation) -> the "what changed" line for the card header.
 * A news situation's `what_changed` is written when it opens or changes ("2 outlets · coverage 1.67×
 * prior · spreading to USA, IRN"), so its outlet count and coverage ratio go stale while the stat
 * boxes under it (outlets, vs prior) are read from the live evidence. Those two parts are dropped from
 * the header so one card never shows two different outlet counts; the rest (spread, alert text) stays.
 * GDACS lines are passed through unchanged.
 */
export function changeNote(situation) {
  const text = situation?.what_changed;
  if (!text) return null;
  if (situation.source === 'gdacs') return text;
  const rest = text.split(' · ').filter((p) => !/^\d+\s+outlets?$/i.test(p.trim()) && !/^coverage\s+[\d.]+\s*[×x]\s+prior$/i.test(p.trim()));
  return rest.length ? rest.join(' · ') : null;
}

const sameTitle = (a, b) => String(a || '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * differingStoryTitle(situation, storyTitle) -> the story's own title when it reads differently from the
 * situation's heading, else null. The heading is the title of the situation's lead story (outlets x
 * severity), which is not always the story the reader came from, so the card names that story too.
 */
export function differingStoryTitle(situation, storyTitle) {
  const t = typeof storyTitle === 'string' ? storyTitle.trim() : '';
  if (!t || sameTitle(t, situation?.verb_label)) return null;
  return t;
}
