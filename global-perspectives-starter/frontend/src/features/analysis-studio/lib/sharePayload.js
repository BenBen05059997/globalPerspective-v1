// sharePayload — what the browser tells the share service. It carries ONLY: which stories, what the reader's run
// wrote (prose, sanitised struct, web sources), the numbering it cited against, and which model produced it.
// Nothing the server stores as a SOURCE comes from here (it re-fetches and freezes those itself), and nothing is
// built from a run that failed its checks: `shareableSections` is the single gate.

export function shareableSections(sections) {
  return (Array.isArray(sections) ? sections : []).filter((s) => s && s.report && s.checks && !s.checks.hasError);
}

/**
 * @param {{sections:Array, selectedTopics:Array, byok?:{provider?:string}|null}} a
 * @returns {object|null}  null when nothing is shareable
 */
export function buildSharePayload({ sections, selectedTopics, byok = null }) {
  const ok = shareableSections(sections);
  if (ok.length === 0 || !Array.isArray(selectedTopics) || selectedTopics.length === 0) return null;
  return {
    stories: selectedTopics.map((t) => ({ topicId: t.topicId || t.id, threadId: t.threadId || null })),
    citations: ok[0].citations.map((c) => ({ n: c.n, kind: c.kind, date: c.date || null, label: c.label || null, url: c.url || null })),
    sections: ok.map((s) => ({
      lensId: s.lensId || null,
      mode: s.mode === 'deep' ? 'deep' : s.mode === 'freeform' ? 'freeform' : 'guided',
      prose: s.report,
      struct: s.struct || null,
      webSources: (s.webSources || []).map((w) => ({ n: w.n, title: w.title || null, url: w.url || null })),
    })),
    run: {
      provider: ok[0].ranOnServer ? 'global-perspectives' : (byok && byok.provider) || null,
      model: ok[0].ranOnServer ? null : (ok[0].byokModel || null),
      runAt: ok[0].createdAt || null,
    },
  };
}

// All shared sections must have cited the SAME numbered sources (the deck stacks lenses on one frozen selection).
export function sameCitations(sections) {
  const ok = shareableSections(sections);
  if (ok.length < 2) return true;
  const key = (s) => JSON.stringify(s.citations.map((c) => [c.n, c.kind, c.date || null, c.label || null, c.url || null]));
  const first = key(ok[0]);
  return ok.every((s) => key(s) === first);
}
