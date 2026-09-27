// imported by Node tooling outside src/ — keep relative imports
// Analysis Studio — the reader-pays "quote before the run" (TRACK_RECORD_AND_STUDIO_RULING.md,
// S5b: TASK_2026-09-27_pages_local.md). Pure + dependency-free so it's testable under
// Node with no browser/network globals — same reason as analysisPrompt.js.
//
// A quote must never invent a price: no price table exists in the repo, so the
// billing line is always either "included with your membership" (server path) or a
// pointer to the provider's own pricing — never a number we made up.

// Rough token estimate — the standard "~4 characters per token" heuristic used across
// providers' own docs for ballpark sizing. Always labelled "estimate": it is not what
// the provider will actually report back (that's the receipt's job, from real `usage`).
export function estimateTokens(chars) {
  return Math.max(0, Math.ceil((chars || 0) / 4));
}

/**
 * buildQuote({ perStory, totalChars, model, maxOutputTokens, memberPath })
 *   perStory:        [{ title, richness:'RICH'|'THIN', counts, truncated }] (assembleContext output)
 *   totalChars:      the assembled context's character length
 *   model:           the model id that will run (byok model, or the server model when memberPath)
 *   maxOutputTokens: the request's output cap
 *   memberPath:      true when this run will use the member server path (no BYOK billing)
 *
 * Returns a quote object AND a `lines` array of ready-to-render strings — the
 * component renders `lines`, tests assert on the structured fields.
 */
export function buildQuote({ perStory = [], totalChars = 0, model = null, maxOutputTokens = null, memberPath = false } = {}) {
  const estInputTokens = estimateTokens(totalChars);
  const richCount = perStory.filter((p) => p.richness === 'RICH').length;
  const thinCount = perStory.length - richCount;
  const anyTruncated = perStory.some((p) => p.truncated);

  const billingLine = memberPath
    ? 'Included with your membership.'
    : 'Your provider bills you directly; see their pricing.';

  const lines = [
    `${perStory.length} stor${perStory.length === 1 ? 'y' : 'ies'} selected — ${richCount} RICH (stored analysis / drift / forecast), ${thinCount} THIN (headlines only).`,
    `Approx. ${totalChars.toLocaleString()} characters sent (~${estInputTokens.toLocaleString()} tokens, estimate).`,
    model ? `Model: ${model}${maxOutputTokens ? ` · output capped at ${maxOutputTokens.toLocaleString()} tokens` : ''}.` : null,
    anyTruncated ? 'Some stored material was trimmed to fit the per-story budget.' : null,
    billingLine,
  ].filter(Boolean);

  return { perStory, totalChars, estInputTokens, model, maxOutputTokens, memberPath, richCount, thinCount, anyTruncated, billingLine, lines };
}
