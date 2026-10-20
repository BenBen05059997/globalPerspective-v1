// countryChange — the latest score move that has a cited event: the trigger headline is a FACT, "why it changed" is
// the corrector model's judgment. Null without both (never a bare model claim).
import { safeWhy, safeTriggerEvent } from '@/shared/lib/driftNote.js';

export function latestChange(driftNotes, topicIdToThreadId) {
  const note = (driftNotes || []).find((d) => safeTriggerEvent(d)?.title && safeWhy(d));
  if (!note) return null;
  const threadId = topicIdToThreadId?.get(note.triggerEvent.topicId) || null;
  return { asOf: note.asOf, why: safeWhy(note), eventTitle: safeTriggerEvent(note).title, threadId };
}
