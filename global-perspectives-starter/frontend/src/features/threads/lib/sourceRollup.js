// sourceRollup — one row per outlet for a story's entries. The Sources tab's rows, its header counts, the
// "N primary" stat and the drawers all come from these rows, so they cannot disagree.
// One tier rule: an outlet is secondary only when every item of it is secondary (a missing tier counts as primary).

/** [{ name, count, tier: 'primary'|'secondary', latest }] sorted by item count, most first. */
export function rollupSources(entries) {
  const byName = new Map();
  for (const entry of entries || []) {
    for (const s of entry.sources || []) {
      const name = s.source || s.title || 'Source';
      const row = byName.get(name) || { name, count: 0, tier: 'secondary', latest: entry.date };
      row.count++;
      if (s.tier !== 'secondary') row.tier = 'primary';
      if (entry.date > row.latest) row.latest = entry.date;
      byName.set(name, row);
    }
  }
  return [...byName.values()].sort((a, b) => b.count - a.count);
}

/** The header counts, computed from the rows. */
export function rollupCounts(rows) {
  const primary = rows.filter((r) => r.tier === 'primary').length;
  return { outlets: rows.length, primary, secondary: rows.length - primary };
}
