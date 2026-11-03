// threadKeys — every story-thread id a situation answers to: its own `threadId` plus `threadIds[]`
// (the tracker's grouped situations carry the threads of all their member stories). Pure.

/** Distinct thread ids of a situation (empty when it has none). */
export function threadKeys(situation) {
  const out = [];
  if (situation?.threadId) out.push(situation.threadId);
  if (Array.isArray(situation?.threadIds)) for (const t of situation.threadIds) if (t && !out.includes(t)) out.push(t);
  return out;
}
