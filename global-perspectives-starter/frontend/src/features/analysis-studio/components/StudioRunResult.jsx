// StudioRunResult — ONE stacked section of the Studio deck (S5c F2 "+ Add analysis"):
// exactly the checks banner / prose / struct visuals / lens picture / sources / receipt
// that a single Analysis Studio run has always rendered (unchanged text/classes from
// S5a/S5b — the capture tests key off this exact markup), now reusable per-section so a
// case can stack several lens runs on the SAME frozen sources without losing any of them.
import Markdown from '@/shared/ui/Markdown';
import { ScenarioBars, IndicatorMatrix, RippleTable } from '@/features/analysis-studio/components/AnalysisVisuals.jsx';
import {
  OursVsRunStrip, StudioTimeBar, ScenarioBandPicture, ComparePicturePanel, WhatChangedChart, FreeformHighlighter,
} from '@/features/analysis-studio/components/StudioPictures.jsx';
import { buildReceipt } from '@/features/analysis-studio/lib/receipt';
import { webLinkMap } from '@/features/analysis-studio/lib/webCitations';
import { SOURCE_KIND_LABELS } from '@/features/analysis-studio/lib/analysisPrompt';
import { formatCiteDate } from '@/features/analysis-studio/lib/formatDate';

export default function StudioRunResult({ section, expanded, onShowAnyway }) {
  const {
    report, citations, webSources, checks, struct, sourceInfo, ranOnServer, usage, elapsedMs,
    byokModel, lensLabel, picture, timeDates, today,
  } = section;

  return (
    <div className="as-section">
      {lensLabel && <div className="as-section-lens">{lensLabel}</div>}

      {sourceInfo && sourceInfo.total > 0 && (
        <div className={`as-srcbasis${sourceInfo.severity === 'warn' ? ' warn' : ''}`}>
          <span className="as-check-dot" aria-hidden />
          <span><strong>Source basis:</strong> {sourceInfo.message}</span>
        </div>
      )}

      {checks && checks.hasError ? (
        <div className="as-checks err" role="alert">
          <div className="as-checks-head">Checks failed — this run is not shareable</div>
          <ul>
            {checks.warnings.filter((w) => w.severity === 'error').map((w, i) => (
              <li key={i} className={`sev-${w.severity}`}>
                <span className="as-check-dot" aria-hidden />
                {w.message}
              </li>
            ))}
          </ul>
          {!expanded ? (
            <button className="as-link-btn as-show-failed" onClick={onShowAnyway}>
              Show anyway (not shareable) →
            </button>
          ) : (
            <div className="as-not-shareable">Shown despite failed checks — not shareable. Your provider still charged for this run.</div>
          )}
        </div>
      ) : checks && checks.warnings.length > 0 ? (
        <div className="as-checks">
          <div className="as-checks-head">Guardrail check — please verify the flagged items</div>
          <ul>
            {checks.warnings.map((w, i) => (
              <li key={i} className={`sev-${w.severity}`}>
                <span className="as-check-dot" aria-hidden />
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : checks && checks.ok ? (
        <div className="as-checks ok">
          <span className="as-check-dot" aria-hidden />
          Guardrail check passed — every source cited exists and no unsupported figures were detected.
        </div>
      ) : null}

      {(!checks?.hasError || expanded) && (
        <>
          {timeDates && timeDates.length > 0 && <StudioTimeBar dates={timeDates} today={today} />}
          {picture?.kind === 'freeform' ? (
            // Free-form's ONE picture (S5c F1 §2) IS the reading surface here — clicking a
            // sentence lights the sources it cites. Rendering the same prose a second time
            // as plain Markdown alongside it would just duplicate the same text; this lens
            // replaces the Markdown pass rather than layering on top of it.
            <FreeformHighlighter sentences={picture.data.sentences} />
          ) : (
            <Markdown text={report} className="as-md" links={webLinkMap(webSources)} />
          )}
          {struct && (
            <>
              <ScenarioBars scenarios={struct.scenarios} />
              <IndicatorMatrix indicators={struct.indicators} />
              <RippleTable ripples={struct.ripples} />
            </>
          )}

          {picture?.oursVsRun && <OursVsRunStrip {...picture.oursVsRun} />}
          {picture?.kind === 'scenario' && <ScenarioBandPicture bands={picture.data.bands} undated={picture.data.undated} />}
          {picture?.kind === 'compare' && <ComparePicturePanel picture={picture.data} />}
          {picture?.kind === 'whatchanged' && <WhatChangedChart countries={picture.data.countries} />}

          {webSources.length > 0 && (
            <div className="as-cites as-cites-web">
              <div className="label">Web sources (model-retrieved) <span className="as-web-chip">web</span></div>
              <ol>
                {webSources.map((w) => (
                  <li key={w.url}>
                    <span className="as-cite-num">[W{w.n}]</span>{' '}
                    <a href={w.url} target="_blank" rel="noopener noreferrer">{w.title}</a>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {citations.length > 0 && (
            <div className="as-cites">
              <div className="label">Sources</div>
              <ol>
                {citations.map((c) => (
                  <li key={c.n}>
                    <span className={`as-kind-chip as-kind-${(c.kind || '').toLowerCase()}`}>{SOURCE_KIND_LABELS[c.kind] || c.kind}</span>
                    <span className="as-cite-date">{c.date ? <time dateTime={c.date}>{formatCiteDate(c.date)}</time> : 'date unknown'}</span>
                    {c.storyTitle && <span className="as-cite-title"> — {c.storyTitle}</span>}
                    {c.label && c.label !== c.storyTitle && <span className="as-cite-meta"> ({c.label})</span>}
                    {c.url && (
                      <span className="as-cite-links">
                        <a href={c.url} target="_blank" rel="noopener noreferrer">link</a>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="as-disclaimer">
            Generated by {ranOnServer && webSources.length === 0 ? 'Global Perspectives AI' : 'your chosen model'} from our story data
            {webSources.length > 0 && ' plus model-retrieved web sources (not verified by our pipeline)'}.
            Treat as analyst input, not fact — verify load-bearing claims against the linked sources.
          </p>
        </>
      )}

      {(() => {
        const receipt = buildReceipt({
          usage,
          model: ranOnServer ? null : (byokModel || usage?.model || null),
          checks,
          sourcesUsed: citations.length,
          elapsedMs,
          memberPath: ranOnServer,
        });
        return (
          <div className="as-receipt-block">
            <div className="as-receipt-head">Receipt</div>
            <ul>
              {receipt.lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
