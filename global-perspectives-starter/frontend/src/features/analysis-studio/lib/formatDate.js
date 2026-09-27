// imported by Node tooling outside src/ — keep relative imports
// Studio date display — the monitor's fix: a source/receipt/log date must read like the rest
// of the site ("Sep 22, 2026"), never a raw ISO timestamp, while the machine value stays
// available (a `<time dateTime>` in the component). Accepts either a bare "YYYY-MM-DD" or a
// full ISO timestamp; bare dates are anchored to UTC midnight (same fix `formatDateLabel`,
// `shared/lib/dateUtils.js`, already applies) so the day never shifts under a local timezone.
export function formatCiteDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
