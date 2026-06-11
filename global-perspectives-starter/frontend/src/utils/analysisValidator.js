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

// Estimative / approximation context. A percentage near these is an analyst JUDGMENT
// the model was asked to give (scenario probabilities) or an explicit rounding — not
// a sourced fact. The Scenario lens literally requests "a rough probability" per
// scenario, so flagging those would make the banner cry wolf on every forecast.
const ESTIMATIVE_RE = /(probab|likelihood|likely|chance|odds|estimat|scenario|roughly|around|about|approx|~|≈)/i;

// Citation markers like [1], [2]. Returns the unique numbers cited, in order seen.
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

// Strip code fences / inline code so we don't mistake example snippets for claims.
function stripCode(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

/**
 * validateAnalysis(text, { citations, context }) → { ok, hasError, warnings }
 *
 *  - citations: [{ n, title, ... }] the numbered stories that were provided.
 *  - context:   the assembled STORIES block (for the invented-figure check). Optional.
 *  - thinInput: true when the source material was thin (assessRichness) — surfaces a
 *               coverage caveat so the reader weights scenario specifics accordingly.
 *
 * Each warning: { code, severity: 'error'|'warn'|'info', message }.
 *   error → a hard guardrail breach (phantom source). hasError=true.
 *   warn  → likely problem a reader should verify.
 *   info  → coverage note, not a defect.
 */
export function validateAnalysis(text, { citations = [], context = '', thinInput = false } = {}) {
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

  // 2) Uncited substantive answer — makes claims at length but anchors none of them.
  //    (Skipped for short outputs, which are usually a clean "Limits of this analysis".)
  const looksSubstantive = body.length > 400;
  const isLimits = /limits of this analysis/i.test(raw);
  if (looksSubstantive && cited.length === 0 && !isLimits) {
    warnings.push({
      code: 'no_citations',
      severity: 'warn',
      message: 'The analysis makes claims but cites no sources with [n].',
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
      // share, not an inline factual claim.
      const justBefore = body.slice(Math.max(0, pm.index - 3), pm.index);
      if (/[(~≈]\s*$/.test(justBefore)) continue;
      const around = body.slice(Math.max(0, pm.index - 32), pm.index + pm[0].length + 14);
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

  const hasError = warnings.some((w) => w.severity === 'error');
  return { ok: warnings.length === 0, hasError, warnings };
}
