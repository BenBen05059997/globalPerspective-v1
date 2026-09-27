// imported by Node tooling outside src/ — keep relative imports
// Analysis Studio — output guardrail checker.
//
// The whole feature rests on honesty rules that, until now, lived ONLY as
// instructions in the system prompt with nothing verifying the model obeyed them.
// This module checks the generated Markdown against those rules and returns a list
// of warnings. It runs both in the live Studio (a warning banner) and in the
// offline eval harness (quality/analysis) — same code, no drift.
//
// Pure + dependency-free on purpose (so the eval can import it under Node).
//
// Design principle ([[feedback-no-misinformation-fallback]]): a flag is only worth
// showing if it is high-precision. We bias toward catching the unambiguous failures
// (a citation to a source that does not exist; a % that appears nowhere in the
// material) and mark genuinely-soft heuristics as low severity, so the banner stays
// trustworthy rather than crying wolf.

// e.g. "12%", "3.5 %", "100%". Captures the literal percent form the prompt forbids
// fabricating. (We don't try to catch the spelled-out "12 percent" form — too noisy.)
const PCT_RE = /\b\d{1,3}(?:\.\d+)?\s?%/g;

function normPct(s) {
  return s.replace(/\s+/g, '');
}

// Specific calendar dates, for the invented-date check. We match only EXPLICIT
// month+day forms ("June 15", "15 June", "June 15, 2026", ISO 2026-06-15) — never
// relative horizons ("within weeks", "next month"), which are legitimate. Normalized
// to "M-D" so "June 15" and "2026-06-15" compare equal.
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
function extractDates(text) {
  const out = new Set();
  const s = text || '';
  // Month name + day: "June 15", "Jun 15th", "15 June"
  const reMD = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
  const reDM = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;
  const reISO = /\b\d{4}-(\d{2})-(\d{2})\b/g;
  let m;
  while ((m = reMD.exec(s))) out.add(`${MONTHS[m[1].slice(0, 3).toLowerCase()]}-${Number(m[2])}`);
  while ((m = reDM.exec(s))) out.add(`${MONTHS[m[2].slice(0, 3).toLowerCase()]}-${Number(m[1])}`);
  while ((m = reISO.exec(s))) out.add(`${Number(m[1])}-${Number(m[2])}`);
  return out;
}

// Estimative / approximation context. A percentage near these is an analyst JUDGMENT
// the model was asked to give (scenario probabilities) or an explicit rounding — not
// a sourced fact. The Scenario lens literally requests "a rough probability" per
// scenario, so flagging those would make the banner cry wolf on every forecast.
const ESTIMATIVE_RE = /(probab|likelihood|likely|chance|odds|estimat|scenario|roughly|around|about|approx|~|≈)/i;

// Citation markers like [1], [2]. Returns the unique numbers cited, in order seen.
// Deliberately does NOT match [Wn] (web-source markers, webCitations.js) — those
// are a separate numbering space and must never be read as one of our story
// numbers (the exact collision this module used to get wrong; see extractCitedWebNumbers).
export function extractCitedNumbers(text) {
  const out = [];
  const seen = new Set();
  const re = /\[(\d{1,2})\]/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// Web-source citation markers like [W1], [W2] (webCitations.js renumbers/produces
// these). Returns the unique numbers cited, in order seen.
export function extractCitedWebNumbers(text) {
  const out = [];
  const seen = new Set();
  const re = /\[W(\d{1,3})\]/g;
  let m;
  while ((m = re.exec(text || ''))) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// Strip code fences / inline code so we don't mistake example snippets for claims.
function stripCode(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

/**
 * validateAnalysis(text, { citations, context, webSources, requiresStruct, structOk })
 *   → { ok, hasError, warnings, shareable }
 *
 *  - citations:     [{ n, title, ... }] the numbered stories that were provided.
 *  - context:       the assembled STORIES block (for the invented-figure check). Optional.
 *  - thinInput:     true when the source material was thin (assessRichness) — surfaces a
 *                   coverage caveat so the reader weights scenario specifics accordingly.
 *  - webSources:    [{ n, title, url }] renumbered web sources (webCitations.js),
 *                   for the web-citation phantom check. Optional.
 *  - requiresStruct: true when the active lens hard-requires a ```gp-struct``` block
 *                   (Scenario, Economic ripple — analysisPrompt.js LENSES).
 *  - structOk:      whether a valid, non-empty struct was actually extracted
 *                   (analysisStruct.js validateStruct(...) !== null).
 *
 * Each warning: { code, severity: 'error'|'warn'|'info', message }.
 *   error → a hard guardrail breach. hasError=true, the run is gated (hidden behind
 *           an explicit "checks failed" expand, marked not shareable — AnalysisStudio.jsx).
 *   warn  → likely problem a reader should verify; the run still renders normally.
 *   info  → coverage note, not a defect.
 *
 * `shareable` is `!hasError` — a run with a real guardrail breach is never shareable
 * (S5: TRACK_RECORD_AND_STUDIO_RULING.md).
 */
export function validateAnalysis(text, {
  citations = [],
  context = '',
  thinInput = false,
  webSources = [],
  requiresStruct = false,
  structOk = true,
} = {}) {
  const warnings = [];
  const raw = (text || '').trim();
  const body = stripCode(raw);
  const maxN = citations.length;
  const cited = extractCitedNumbers(body);

  // 1) Phantom citation — cites [n] that maps to no provided story. This is the
  //    cardinal failure: a fabricated source reference. (Only checkable when we know
  //    how many stories were provided.)
  if (maxN > 0) {
    const phantom = cited.filter((n) => n < 1 || n > maxN);
    if (phantom.length) {
      warnings.push({
        code: 'phantom_citation',
        severity: 'error',
        message:
          `Cites ${phantom.map((n) => `[${n}]`).join(', ')} but only ` +
          `${maxN} stor${maxN === 1 ? 'y was' : 'ies were'} provided — that source does not exist.`,
      });
    }
  }

  // 1b) Phantom WEB citation — cites [Wn] beyond the web sources actually returned
  //     (same failure mode as (1), for the separate web-marker numbering space).
  if (Array.isArray(webSources) && webSources.length > 0) {
    const maxW = webSources.length;
    const citedW = extractCitedWebNumbers(body);
    const phantomW = citedW.filter((n) => n < 1 || n > maxW);
    if (phantomW.length) {
      warnings.push({
        code: 'phantom_web_citation',
        severity: 'error',
        message:
          `Cites ${phantomW.map((n) => `[W${n}]`).join(', ')} but only ` +
          `${maxW} web source${maxW === 1 ? ' was' : 's were'} returned — that source does not exist.`,
      });
    }
  }

  // 2) Uncited substantive answer — makes claims at length but anchors none of them.
  //    (Skipped for short outputs, which are usually a clean "Limits of this analysis".)
  // This is a hard failure, not a soft nudge: an analysis long enough to carry real
  // claims that cites nothing at all cannot be checked against anything — the reader
  // has no way to verify a single sentence of it (critic 2: the validator must
  // actually gate, not just decorate a banner).
  const looksSubstantive = body.length > 400;
  const isLimits = /limits of this analysis/i.test(raw);
  if (looksSubstantive && cited.length === 0 && !isLimits) {
    warnings.push({
      code: 'no_citations',
      severity: 'error',
      message: 'The analysis makes claims at length but cites no sources with [n] — none of it can be checked against the material.',
    });
  }

  // 3) Invented figure — a percentage stated as a SOURCED FACT that appears nowhere
  //    in the material. Percentages in estimative context (scenario probabilities,
  //    explicit rounding) are excluded — those are analyst judgment, not fabricated
  //    facts. Soft (severity=warn): a flagged figure means "verify", not "breach".
  if (context) {
    const ctxPcts = new Set((context.match(PCT_RE) || []).map(normPct));
    const invented = new Set();
    const re = new RegExp(PCT_RE.source, 'g');
    let pm;
    while ((pm = re.exec(body))) {
      const pct = normPct(pm[0]);
      if (ctxPcts.has(pct)) continue;
      // Parenthetical / tilde'd annotation — "(15%)", "~60%" — is a probability or
      // share, not an inline factual claim. Comparison-operator thresholds —
      // ">50%", "≥30%" — are watch CRITERIA the analyst defines (the P1 indicators
      // table produces these), not facts asserted about the world.
      const justBefore = body.slice(Math.max(0, pm.index - 3), pm.index);
      if (/[(~≈<>≥≤]\s*$/.test(justBefore)) continue;
      // Look-behind widened 32→48: scenario headings put the estimative keyword at the
      // START of the line — "### Scenario 2: Accidental war (Downside tail, 25–35%)" —
      // and at 32 chars the word "Scenario" fell outside the window, false-flagging the
      // probability range (seen live 2026-07-10). The keyword requirement itself stays.
      const around = body.slice(Math.max(0, pm.index - 48), pm.index + pm[0].length + 14);
      if (ESTIMATIVE_RE.test(around)) continue; // a probability/rounding, not a fact
      invented.add(pct);
    }
    if (invented.size) {
      const list = [...invented];
      warnings.push({
        code: 'invented_figure',
        severity: 'warn',
        message:
          `Figure${list.length > 1 ? 's' : ''} stated as fact but not found in the source material: ` +
          `${list.join(', ')}. Verify before relying on ${list.length > 1 ? 'them' : 'it'}.`,
      });
    }
  }

  // 3b) Invented date — a specific calendar date in the output that appears nowhere
  //     in the source material (the Scenario lens used to fabricate trigger dates).
  //     Closed-book only (gated on context); relative horizons are never flagged.
  if (context) {
    const ctxDates = extractDates(context);
    const invented = [...extractDates(body)].filter((d) => !ctxDates.has(d));
    if (invented.length) {
      warnings.push({
        code: 'invented_date',
        severity: 'warn',
        message:
          `Specific date${invented.length > 1 ? 's' : ''} not found in the source material — ` +
          'verify this is not a fabricated timeline (use a relative horizon if undated).',
      });
    }
  }

  // 4) Unused source — provided but never referenced. Coverage note only.
  if (maxN > 0 && cited.length > 0) {
    const unused = [];
    for (let n = 1; n <= maxN; n++) if (!cited.includes(n)) unused.push(n);
    if (unused.length) {
      warnings.push({
        code: 'unused_source',
        severity: 'info',
        message:
          `Provided stor${unused.length === 1 ? 'y' : 'ies'} ` +
          `${unused.map((n) => `[${n}]`).join(', ')} not referenced in the analysis.`,
      });
    }
  }

  // 5) Thin input — coverage caveat (not a defect in the output itself). Surfaced so a
  //    reader treats any scenario specifics as lightly-supported.
  if (thinInput) {
    warnings.push({
      code: 'thin_input',
      severity: 'info',
      message: 'Limited source material backed this analysis — treat scenario specifics as lightly supported.',
    });
  }

  // 6) Structural / schema failure — the active lens hard-requires a machine-readable
  //    ```gp-struct``` block (Scenario, Economic ripple), but none survived extraction
  //    + validation (analysisStruct.js): the fence was missing, truncated, malformed
  //    JSON, or every entry in it failed the anti-invention cross-check against the
  //    prose. A lens promising structured output that doesn't deliver it is a real
  //    output-contract failure, not a style nitpick.
  if (requiresStruct && !structOk) {
    warnings.push({
      code: 'schema_invalid',
      severity: 'error',
      message: 'This lens requires a structured summary block, but none was returned (missing, truncated, or invalid) — the output does not match the required schema.',
    });
  }

  const hasError = warnings.some((w) => w.severity === 'error');
  return { ok: warnings.length === 0, hasError, shareable: !hasError, warnings };
}
