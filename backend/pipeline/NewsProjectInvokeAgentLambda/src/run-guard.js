'use strict';

// A selector generation predating an archive write is already consumed (even if a partial
// agent run never set agentProcessedAt). force never bypasses freshness.
function generationTime(item) {
  const m = /^gen-(\d{13})$/.exec(String(item?.generationId || ''));
  const value = m ? Number(m[1]) : Date.parse(item?.updatedAt || '');
  return Number.isFinite(value) ? value : null;
}
function staleReason(staging, archives = [], now = new Date()) {
  if (staging?.id !== 'staging') return 'staging-missing';
  const generated = generationTime(staging);
  if (generated === null) return 'generation-time-missing';
  if (generated > now.getTime()) return 'generation-in-future';
  if (new Date(generated).toISOString().slice(0, 10) < now.toISOString().slice(0, 10)) return 'generation-prior-day';
  const previousWrite = Math.max(0, ...archives.flatMap(a => [a?.updatedAt, ...(a?.entries || []).map(e => e.archivedAt)]).map(t => Date.parse(t || '')).filter(Number.isFinite));
  return generated <= previousWrite ? 'generation-already-archived' : null;
}
module.exports = { generationTime, staleReason };
