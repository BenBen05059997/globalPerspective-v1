// briefingPath — the one builder for /briefings addresses inside this feature.
// TODO(L1-LINKS): replace with briefingHref from @/shared/lib/links.js once it lands on main.
//   mode  'read' (default) | 'weekly' | 'present' — always written, so each edition has one address
//   date  YYYY-MM-DD daily edition (read, present daily deck)
//   week  YYYY-MM-DD weekly edition (weekly, present weekly deck)
//   deck  'weekly' for the present-mode weekly deck (daily is the default deck)
// Bare `/briefings` still opens read mode (the nav links it).
export function briefingPath({ mode = 'read', date, week, deck } = {}) {
  const q = new URLSearchParams({ mode });
  if (date) q.set('date', date);
  if (week) q.set('week', week);
  if (deck === 'weekly') q.set('deck', 'weekly');
  return `/briefings?${q}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** dateKeyOrNull — a YYYY-MM-DD query value, or null for anything else (never a guessed date). */
export function dateKeyOrNull(value) {
  return typeof value === 'string' && DATE_KEY.test(value) ? value : null;
}
