// imported by Node tooling outside src/ — keep relative imports
// Analysis Studio — the reader-pays "receipt after the run" (TRACK_RECORD_AND_STUDIO_RULING.md,
// S5b). Pure + dependency-free (same reason as quote.js): formats what actually came
// back from the provider / server into plain lines the UI renders as-is, so a test
// can assert on exactly what a reader sees without touching React.

/**
 * buildReceipt({ usage, model, checks, sourcesUsed, elapsedMs, memberPath })
 *   usage:       { inputTokens, outputTokens, model } | null — the provider's own
 *                `usage` field (llm.js). null means the provider didn't report it.
 *   model:       the model id the run actually used (falls back to usage.model).
 *   checks:      analysisValidator.js's validateAnalysis() result, or null.
 *   sourcesUsed: count of typed sources supplied to the run (citations.length).
 *   elapsedMs:   wall-clock run time in ms, or null.
 *   memberPath:  true when the member server path ran (no provider `usage` to show —
 *                the run is billed by membership/allowance, not a metered API key).
 *
 * Returns { lines, hasError } — `lines` are ready-to-render strings.
 */
export function buildReceipt({ usage = null, model = null, checks = null, sourcesUsed = 0, elapsedMs = null, memberPath = false } = {}) {
  const lines = [];
  const shownModel = model || usage?.model || null;
  if (shownModel) lines.push(`Model: ${shownModel}`);

  if (memberPath) {
    lines.push('Included with your membership — no per-run provider usage to report.');
  } else if (usage && (usage.inputTokens != null || usage.outputTokens != null)) {
    lines.push(`Tokens: ${usage.inputTokens ?? '—'} in / ${usage.outputTokens ?? '—'} out (as reported by the provider).`);
  } else {
    lines.push('Tokens: provider did not report usage for this run.');
  }

  const hasError = Boolean(checks?.hasError);
  if (checks) {
    const codes = (checks.warnings || []).map((w) => w.code);
    lines.push(hasError
      ? `Checks: failed — ${codes.length ? codes.join(', ') : 'see the report above'}.`
      : `Checks: passed${codes.length ? ` (notes: ${codes.join(', ')})` : ''}.`);
  }

  lines.push(`Sources used: ${sourcesUsed}.`);
  if (typeof elapsedMs === 'number' && elapsedMs >= 0) {
    lines.push(`Run time: ${(elapsedMs / 1000).toFixed(1)}s.`);
  }

  if (hasError && !memberPath) lines.push('Your provider still charged for this run.');

  return { lines, hasError };
}
