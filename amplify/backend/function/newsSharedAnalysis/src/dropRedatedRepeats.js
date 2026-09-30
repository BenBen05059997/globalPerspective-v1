// dropRedatedRepeats — the archive re-writes an old story's headline under a later date (see
// useNarrativeThread's note): keep only a headline's EARLIEST appearance so a story's span never
// claims news that didn't happen. Pure and import-free: a byte-identical copy lives in the
// newsSharedAnalysis Lambda (guarded by scripts/check-shared-sync.mjs).
export function dropRedatedRepeats(entries) {
  if (!Array.isArray(entries)) return entries;
  const earliest = new Map();
  for (const e of entries) {
    const key = String(e?.title || '').trim().toLowerCase();
    if (!key) continue;
    const prev = earliest.get(key);
    if (!prev || String(e.date || '') < String(prev.date || '')) earliest.set(key, e);
  }
  return entries.filter((e) => {
    const key = String(e?.title || '').trim().toLowerCase();
    return !key || earliest.get(key) === e;
  });
}
