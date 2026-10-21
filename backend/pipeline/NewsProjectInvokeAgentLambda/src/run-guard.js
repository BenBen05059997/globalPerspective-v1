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
// newsInvokeGemini runs cron(15 4/8) UTC (04:15, 12:15, 20:15; scripts/functions.json) and this agent
// follows at :25. Staging already processed is a quiet duplicate only if gemini wrote it in the current
// slot; one generated before the latest slot start means this run's gemini output never arrived.
const GEMINI_SLOT_HOURS = [4, 12, 20];
const GEMINI_SLOT_MINUTE = 15;
function currentSlotStart(now) {
  const d = new Date(now.getTime());
  d.setUTCMinutes(GEMINI_SLOT_MINUTE, 0, 0);
  for (let i = 0; i < 4; i++, d.setUTCHours(d.getUTCHours() - 1)) {
    if (GEMINI_SLOT_HOURS.includes(d.getUTCHours()) && d.getTime() <= now.getTime()) return d.getTime();
  }
  return null;
}
// null = fresh duplicate (quiet skip); otherwise detail for the failed-run error.
function staleProcessedRun(staging, now = new Date()) {
  const generated = generationTime(staging);
  const slot = currentSlotStart(now);
  if (generated === null || slot === null || generated >= slot) return null;
  return { generationId: staging.generationId, generatedAt: new Date(generated).toISOString(), ageMinutes: Math.round((now.getTime() - generated) / 60000), slotStart: new Date(slot).toISOString() };
}
module.exports = { generationTime, staleReason, staleProcessedRun };
