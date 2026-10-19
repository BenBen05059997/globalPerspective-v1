// age — short "how long ago" text + day count from a REAL ISO timestamp (never a typed date).
// Returns null / '' for a missing or unparseable timestamp so callers render nothing.
export function ageDaysFrom(iso, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t) / 86400000;
}

/** "just now" · "25m" · "5h" · "3d" */
export function ageShortFrom(iso, now = Date.now()) {
  const d = ageDaysFrom(iso, now);
  if (d == null) return '';
  const m = Math.round(d * 1440);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/**
 * asOfParts — the pieces of the one "as of" line (shared/ui/AsOf.jsx) from a REAL timestamp:
 *   { iso, relative: '5h ago' | 'just now', absolute: '19 Oct 2026' (locale date), text: 'as of 5h ago (19 Oct 2026)' }
 * null for a missing or unparseable timestamp (the caller renders nothing, never a guessed date).
 */
export function asOfParts(iso, now = Date.now()) {
  const short = ageShortFrom(iso, now);
  if (!short) return null;
  const d = new Date(iso);
  const relative = short === 'just now' ? short : `${short} ago`;
  const absolute = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return { iso: d.toISOString(), relative, absolute, text: `as of ${relative} (${absolute})` };
}
