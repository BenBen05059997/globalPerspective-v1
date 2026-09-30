import Markdown from '@/shared/ui/Markdown';
import { ScenarioBars, IndicatorMatrix, RippleTable } from '@/features/analysis-studio/components/AnalysisVisuals.jsx';
import { StudioTimeBar } from '@/features/analysis-studio/components/StudioPictures.jsx';
import { webLinkMap } from '@/features/analysis-studio/lib/webCitations';
import { SOURCE_KIND_LABELS } from '@/features/analysis-studio/lib/analysisPrompt';
import { formatCiteDate } from '@/features/analysis-studio/lib/formatDate';
import { httpOnly } from '@/features/analysis-studio/lib/shareApi.js';
import { fmtDay } from '@/features/track-record/lib/trFormatDate.js';

// SharedAnalysisView — the read-only debrief of a stored share: exactly what the reader's run wrote, the sources
// the SERVER froze (with their verbatim text), and the checks it passed. No live fetch, no AI, no map: pictures
// that need live data are not part of a shared copy (said on the page). All text goes through React (escaped)
// or <Markdown> (no raw HTML); links exist only where the server kept an http(s) URL.
const LENS_LABEL = { scenario: 'Scenario forecast', whatchanged: 'What changed', economic: 'Economic ripple', compare: 'Compare stories', freeform: 'Free-form' };

export default function SharedAnalysisView({ share, compact = false }) {
  const sources = share.sources || [];
  const dates = [...sources.map((s) => s.date).filter(Boolean).map((d) => String(d).slice(0, 10))];
  return (
    <article className={`as-shared${compact ? ' compact' : ''}`}>
      <header className="as-shared-head">
        <div className="label">Shared analysis · read-only</div>
        <p className="as-shared-meta">
          Run {fmtDay(share.runAt)} · sources frozen {fmtDay(share.sourcesFrozenAt)} · written by a reader with their own
          {share.run && share.run.model ? ` model (${share.run.model}, as reported by their browser)` : ' key'} from our stored story data.
          Not a Global Perspectives briefing.
        </p>
        {share.stories && share.stories.length > 0 && (
          <p className="as-shared-stories">Stories: {share.stories.map((s) => s.title).join(' · ')}</p>
        )}
      </header>

      {(share.sections || []).map((sec, i) => (
        <section key={i} className="as-section as-shared-section">
          <div className="as-section-lens">{sec.lensId ? (LENS_LABEL[sec.lensId] || sec.lensId) : 'Deep research'}{sec.focus ? ` — “${sec.focus}”` : ''}</div>
          <div className="as-checks ok">
            <span className="as-check-dot" aria-hidden />
            Guardrail checks passed when this was shared — every cited source exists, no unsupported figures were detected.
          </div>
          {sec.checks && sec.checks.warnings && sec.checks.warnings.length > 0 && (
            <ul className="as-shared-warns">
              {sec.checks.warnings.map((w, k) => <li key={k} className={`sev-${w.severity}`}>{w.message}</li>)}
            </ul>
          )}
          {i === 0 && dates.length > 0 && <StudioTimeBar dates={dates} today={String(share.sourcesFrozenAt || '').slice(0, 10)} />}
          <Markdown text={sec.prose} className="as-md" links={webLinkMap((sec.webSources || []).filter((w) => httpOnly(w.url)))} />
          {sec.struct && (
            <>
              <ScenarioBars scenarios={sec.struct.scenarios} />
              <IndicatorMatrix indicators={sec.struct.indicators} />
              <RippleTable ripples={sec.struct.ripples} />
            </>
          )}
          {(sec.webSources || []).length > 0 && (
            <div className="as-cites as-cites-web">
              <div className="label">Web sources reported by the reader&apos;s provider — not checked by us <span className="as-web-chip">web</span></div>
              <ol>
                {sec.webSources.map((w) => (
                  <li key={w.n}>
                    <span className="as-cite-num">[W{w.n}]</span>{' '}
                    {httpOnly(w.url) ? <a href={w.url} target="_blank" rel="noopener noreferrer nofollow">{w.title || w.url}</a> : (w.title || 'untitled source')}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {sec.lensId === 'whatchanged' && <p className="as-muted">The chart for this lens uses live data, so it is not included in shared copies.</p>}
        </section>
      ))}

      {sources.length > 0 && (
        <div className="as-cites as-shared-sources">
          <div className="label">Sources — frozen from our stored data on {fmtDay(share.sourcesFrozenAt)}</div>
          <ol>
            {sources.map((c) => (
              <li key={c.n}>
                <span className="as-cite-num">[{c.n}]</span>{' '}
                <span className={`as-kind-chip as-kind-${(c.kind || '').toLowerCase()}`}>{SOURCE_KIND_LABELS[c.kind] || c.kind}</span>
                <span className="as-cite-date">{c.date ? <time dateTime={c.date}>{formatCiteDate(c.date)}</time> : 'date unknown'}</span>
                {c.storyTitle && <span className="as-cite-title"> — {c.storyTitle}</span>}
                {c.label && c.label !== c.storyTitle && <span className="as-cite-meta"> ({c.label})</span>}
                {httpOnly(c.url) && <span className="as-cite-links"><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">link</a></span>}
                {c.text && <blockquote className="as-shared-snippet">{c.text}</blockquote>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="as-disclaimer">
        Generated by a model chosen by the reader from our story data. Treat as analyst input, not fact — verify load-bearing
        claims against the sources above.
      </p>
    </article>
  );
}
