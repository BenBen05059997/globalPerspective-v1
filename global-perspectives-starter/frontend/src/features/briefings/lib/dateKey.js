// Addresses for /briefings come from briefingHref in @/shared/lib/links.js; this file only reads the date
// query value. Bare `/briefings` still opens read mode (the nav links it).
import { isCalendarDate } from '@/shared/lib/dateUtils.js';

/** dateKeyOrNull — a real YYYY-MM-DD day from the query, or null for anything else (never a guessed date). */
export function dateKeyOrNull(value) {
  return isCalendarDate(value) ? value : null;
}
