// Text helpers for the map story card. Monitor fix (M5b review, 2026-09-26): the first version
// split sentences on every "." and turned "…, per al-monitor.com." into "com. com. org.".
// Summaries are stored as markdown bullets ("- fact, per outlet.com."), so take whole bullets;
// prose splits only at a stop followed by whitespace and a capital letter / quote.

function unmark(s) {
  return String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
}

// First n bullet facts of a stored summary. Drops the trailing "Countries/regions mentioned:"
// line (metadata, not a fact). Falls back to prose sentences when the text has no bullets.
export function summaryFacts(text, n = 3) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => unmark(l.replace(/^[-•*]\s+/, '')))
    .filter((l) => l && !/^countries\/regions mentioned:/i.test(l));
  if (bullets.length) return bullets.slice(0, n);
  const one = firstSentences(text, n);
  return one ? [one] : [];
}

// First n sentences of prose. A boundary is . ! or ? followed by whitespace and then a capital
// letter, digit or opening quote — so "al-monitor.com", "U.S." mid-sentence and decimals survive.
export function firstSentences(text, n = 2) {
  if (!text || typeof text !== 'string') return '';
  const clean = unmark(text.replace(/^[-•*]\s+/gm, ''));
  if (!clean) return '';
  const parts = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'‘(])/);
  return parts.slice(0, n).join(' ').trim();
}
