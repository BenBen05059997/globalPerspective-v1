// Addresses for /briefings come from briefingHref in @/shared/lib/links.js; this file only reads the date
// query value. Bare `/briefings` still opens read mode (the nav links it).
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** dateKeyOrNull — a YYYY-MM-DD query value, or null for anything else (never a guessed date). */
export function dateKeyOrNull(value) {
  return typeof value === 'string' && DATE_KEY.test(value) ? value : null;
}
