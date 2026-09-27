// StudioDeck — S5c F1 (deck for a finished run) + F2 (stacking) + F3 (DECK|BOARD toggle),
// monitor round 2: the approved F1 layout is a dark `.gp-console` panel — a MAP, a SLIDE CARD
// (one slide at a time: Bottom line → the lens picture → Our data vs this run → Sources →
// Receipt, ◀ ▶ / dots / arrow keys), and a TIME BAR — the same pattern story mode uses
// (Studio.dc.html v3). Built by REUSING story mode's own pieces, not forking them:
//   - `StoryMap` (features/threads/components/StoryMode.jsx) for the map;
//   - `iso3ForName` (features/map/lib/situationLabels.js) to shade backed ("our data") places;
//   - the `.sm-*` slide/scroll/fade classes + `.gp-console` tokens (StoryMode.css, imported).
//
// DECK shows ONE section's deck at a time — F2's stacked sections become a switcher (chips)
// across decks, defaulting to the newest. "READ AS TEXT" is the long light-themed view every
// run has always rendered (StudioRunResult, unchanged) — still reachable, never removed.
// BOARD stays the desktop case board (unchanged). Phone (P1): READ slides / MAP (lazy) / LOG
// tabs on the dark surface, mirroring PhoneStoryMode's tab pattern (`.psm-*`, imported).
import { useState, useEffect, useMemo, useCallback } from 'react';
import StudioRunResult from '@/features/analysis-studio/components/StudioRunResult';
import {
  OursVsRunStrip, ScenarioBandPicture, ComparePicturePanel, WhatChangedChart, FreeformHighlighter, StudioTimeBar,
} from '@/features/analysis-studio/components/StudioPictures.jsx';
import { StoryMap } from '@/features/threads/components/StoryMode.jsx';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { buildReceipt } from '@/features/analysis-studio/lib/receipt';
import { SOURCE_KIND_LABELS } from '@/features/analysis-studio/lib/analysisPrompt';
import { formatCiteDate } from '@/features/analysis-studio/lib/formatDate';
import { nextFocusId } from '@/features/analysis-studio/lib/deckStack';
import '@/features/threads/components/StoryMode.css';
import '@/features/threads/components/PhoneStoryMode.css';
import '@/features/analysis-studio/components/StudioDeck.css';

const MAP_HEIGHT = 460;
const PHONE_MAP_HEIGHT = 300;

// The prose always opens with a "## Bottom line" section (SYSTEM_PROMPT) — pull just that
// paragraph for the slide; fall back to the first paragraph of whatever prose exists (e.g. a
// "Limits of this analysis" refusal) rather than show nothing.
function extractBottomLine(prose) {
  const text = typeof prose === 'string' ? prose : '';
  const m = text.match(/##\s*bottom line\s*\n+([\s\S]*?)(?=\n##|\n```|$)/i);
  const raw = (m ? m[1] : text.replace(/^##[^\n]*\n/, '')).trim();
  const firstPara = raw.split(/\n\s*\n/)[0] || raw;
  return firstPara.replace(/^#+\s*/, '').trim();
}

// Shade the run's backed ("our data") places on the map — never the dropped/run-only ones
// (D4 already dropped anything unbacked from the picture). `category` is the first selected
// story's editorial category; crisisHueForCategory/crisisTypeForCategory fall back to the
// safe "neutral" hue for anything that doesn't map (crisisHue.js), never a guessed severity.
function useShading(section, category) {
  return useMemo(() => {
    const ours = section?.picture?.oursVsRun?.ours || [];
    const out = [];
    const seen = new Set();
    for (const name of ours) {
      const iso3 = iso3ForName(name);
      if (!iso3 || seen.has(iso3)) continue;
      seen.add(iso3);
      out.push({
        iso3, count: 1, top: { title: name, category },
        crisisType: crisisTypeForCategory(category), hue: crisisHueForCategory(category),
      });
    }
    return out;
  }, [section, category]);
}

function BottomLineSlide({ section }) {
  const { checks, expanded, report } = section;
  if (checks?.hasError && !expanded) {
    return (
      <div className="sd-slide">
        <div className="sm-slide-kicker">CHECKS FAILED</div>
        <p className="sm-slide-text">
          This run failed a guardrail check and is not shareable. Switch to “Read as text” to
          review what failed — you can still show it there if you want to see it anyway.
        </p>
      </div>
    );
  }
  const bottomLine = extractBottomLine(report);
  return (
    <div className="sd-slide">
      <div className="sm-slide-kicker">{section.lensLabel}</div>
      <h2 className="sm-slide-title">Bottom line</h2>
      <p className="sm-slide-text">{bottomLine || 'No bottom line stated for this run.'}</p>
      {checks?.ok && <div className="sd-check-ok">✓ Guardrail check passed</div>}
      {checks && !checks.ok && !checks.hasError && (
        <div className="sd-check-warn">⚠ {checks.warnings.length} guardrail note{checks.warnings.length === 1 ? '' : 's'} — see Read as text</div>
      )}
    </div>
  );
}

function PictureSlide({ section }) {
  const { picture } = section;
  if (!picture) return <div className="sd-slide"><p className="sm-slide-text">No picture for this lens.</p></div>;
  return (
    <div className="sd-slide sd-slide-picture">
      {picture.kind === 'scenario' && <ScenarioBandPicture bands={picture.data.bands} undated={picture.data.undated} />}
      {picture.kind === 'compare' && <ComparePicturePanel picture={picture.data} />}
      {picture.kind === 'whatchanged' && <WhatChangedChart countries={picture.data.countries} />}
      {picture.kind === 'freeform' && <FreeformHighlighter sentences={picture.data.sentences} />}
    </div>
  );
}

function OursSlide({ section }) {
  const ov = section.picture?.oursVsRun;
  if (!ov || (ov.ours.length === 0 && ov.runOnly.length === 0 && ov.dropped.length === 0)) {
    return <div className="sd-slide"><p className="sm-slide-text">No place named by this run.</p></div>;
  }
  return <div className="sd-slide"><OursVsRunStrip {...ov} /></div>;
}

function SourcesSlide({ section }) {
  const { citations, webSources } = section;
  if (citations.length === 0 && webSources.length === 0) {
    return <div className="sd-slide"><p className="sm-slide-text">No sources for this run.</p></div>;
  }
  return (
    <div className="sd-slide">
      {webSources.length > 0 && (
        <div className="sd-sources-block">
          <div className="sm-slide-kicker">Web sources</div>
          <ol className="sd-sources-list">
            {webSources.map((w) => (
              <li key={w.url}><span className="sd-cite-num">[W{w.n}]</span> <a href={w.url} target="_blank" rel="noopener noreferrer">{w.title}</a></li>
            ))}
          </ol>
        </div>
      )}
      {citations.length > 0 && (
        <div className="sd-sources-block">
          <div className="sm-slide-kicker">Sources</div>
          <ol className="sd-sources-list">
            {citations.map((c) => (
              <li key={c.n}>
                <span className="sd-kind-chip">{SOURCE_KIND_LABELS[c.kind] || c.kind}</span>{' '}
                {c.date ? <time dateTime={c.date}>{formatCiteDate(c.date)}</time> : <span>date unknown</span>}
                {c.storyTitle && <span> — {c.storyTitle}</span>}
                {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer"> link</a>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ReceiptSlide({ section }) {
  const receipt = buildReceipt({
    usage: section.usage,
    model: section.ranOnServer ? null : (section.byokModel || section.usage?.model || null),
    checks: section.checks,
    sourcesUsed: section.citations.length,
    elapsedMs: section.elapsedMs,
    memberPath: section.ranOnServer,
  });
  return (
    <div className="sd-slide">
      <div className="sm-slide-kicker">Receipt</div>
      <ul className="sd-receipt-list">{receipt.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

// `label` is the full description (used as a title/aria attribute only); `dot` is the short
// code shown as the visible slide-nav text — kept short and distinct from any sentence a
// screen-text assertion or reader might reasonably search for (e.g. never the literal phrase
// "Bottom line", which the slide body itself also renders as a heading).
function buildDeckSlides(section) {
  return [
    { key: 'bottomline', label: 'Bottom line', dot: 'BL', content: <BottomLineSlide section={section} /> },
    { key: 'picture', label: section.lensLabel || 'Picture', dot: 'PIC', content: <PictureSlide section={section} /> },
    { key: 'ours', label: 'Our data vs this run', dot: 'MAP', content: <OursSlide section={section} /> },
    { key: 'sources', label: 'Sources', dot: 'SRC', content: <SourcesSlide section={section} /> },
    { key: 'receipt', label: 'Receipt', dot: 'RCT', content: <ReceiptSlide section={section} /> },
  ];
}

// ── Desktop dark deck (F1) ─────────────────────────────────────────────────────
function DesktopDeck({ decorated, focused, focusId, onFocus, category }) {
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => { setSlideIdx(0); }, [focusId]);
  const slides = useMemo(() => (focused ? buildDeckSlides(focused) : []), [focused]);
  const goto = useCallback((i) => setSlideIdx(Math.max(0, Math.min(slides.length - 1, i))), [slides.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goto(slideIdx + 1);
      else if (e.key === 'ArrowLeft') goto(slideIdx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slideIdx, goto]);

  const shading = useShading(focused, category);
  const focusIso3 = shading[0]?.iso3 || null;

  if (!focused) return null;

  return (
    <div className="gp-console sm-root sd-root">
      <div className="sm-topbar">
        <div className="sm-topbar-label">STUDIO DECK</div>
        {decorated.length > 1 && (
          <div className="sd-switcher" role="tablist" aria-label="Case sections">
            {decorated.map((s) => (
              <button
                key={s.id} type="button" role="tab" aria-selected={s.id === focusId}
                className={`sd-switcher-chip${s.id === focusId ? ' on' : ''}`}
                onClick={() => onFocus(s.id)}
              >
                {s.lensLabel}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="sm-body sd-body">
        <div className="sm-stage" style={{ height: MAP_HEIGHT }}>
          <StoryMap shading={shading} storyFocusIso3={focusIso3} height={MAP_HEIGHT} />
          <div className="sm-slidecard">
            <div className="sm-slidenav" role="tablist" aria-label="Studio deck slides">
              <button type="button" className="sm-slidenav-btn" onClick={() => goto(slideIdx - 1)} disabled={slideIdx === 0} aria-label="Previous slide">◀</button>
              <div className="sm-slidedots">
                {slides.map((s, i) => (
                  <button
                    key={s.key} type="button" role="tab" aria-selected={i === slideIdx}
                    className={`sm-slidedot${i === slideIdx ? ' on' : ''}`}
                    onClick={() => goto(i)} title={s.label} aria-label={s.label}
                  >{s.dot}</button>
                ))}
              </div>
              <button type="button" className="sm-slidenav-btn" onClick={() => goto(slideIdx + 1)} disabled={slideIdx === slides.length - 1} aria-label="Next slide">▶</button>
            </div>
            <div className="sm-slidescroll">
              <div className="sm-slideview">{slides[slideIdx]?.content}</div>
            </div>
            <div className="sm-slidefade" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="sd-timebar-wrap">
        <StudioTimeBar dates={focused.timeDates} today={focused.today} />
      </div>
    </div>
  );
}

// ── BOARD (unchanged concept: one run's parts as separate cards) ───────────────
function BoardCards({ section }) {
  return (
    <div className="as-board-grid">
      <div className="as-board-card">
        <div className="as-board-card-head">Analysis</div>
        <StudioRunResult
          section={{ ...section, timeDates: [], picture: { ...section.picture, oursVsRun: null } }}
          expanded={section.expanded}
          onShowAnyway={section.onShowAnyway}
        />
      </div>
      {section.picture?.oursVsRun && (
        <div className="as-board-card">
          <div className="as-board-card-head">Our data vs this run</div>
          <OursVsRunStrip {...section.picture.oursVsRun} />
        </div>
      )}
    </div>
  );
}

// ── Phone (P1): READ slides / MAP (lazy) / LOG, dark surface ───────────────────
function PhoneDeck({ decorated, focused, category }) {
  const [tab, setTab] = useState('read');
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => { setSlideIdx(0); }, [focused?.id]);
  const slides = useMemo(() => (focused ? buildDeckSlides(focused) : []), [focused]);
  const goto = (i) => setSlideIdx(Math.max(0, Math.min(slides.length - 1, i)));
  const shading = useShading(focused, category);
  const focusIso3 = shading[0]?.iso3 || null;

  return (
    <div className="gp-console psm-root sd-phone-root">
      <div className="psm-topbar">
        <div className="psm-topbar-label">STUDIO DECK</div>
      </div>
      <div className="psm-tabs" role="tablist" aria-label="Studio view">
        {['read', 'map', 'log'].map((k) => (
          <button
            key={k} type="button" role="tab" aria-selected={tab === k}
            className={`psm-tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}
          >
            {k === 'read' ? 'READ' : k === 'map' ? 'MAP' : 'LOG'}
          </button>
        ))}
      </div>

      {tab === 'read' && focused && (
        <div className="psm-panel" role="tabpanel">
          <div className="psm-slideview">{slides[slideIdx]?.content}</div>
          <div className="psm-slidenav" role="tablist" aria-label="Studio deck slides">
            <button type="button" className="psm-slidenav-btn" onClick={() => goto(slideIdx - 1)} disabled={slideIdx === 0} aria-label="Previous slide">◀</button>
            <div className="psm-slidedots">
              {slides.map((s, i) => (
                <button key={s.key} type="button" role="tab" aria-selected={i === slideIdx} className={`psm-slidedot${i === slideIdx ? ' on' : ''}`} onClick={() => goto(i)} aria-label={s.label} />
              ))}
            </div>
            <button type="button" className="psm-slidenav-btn" onClick={() => goto(slideIdx + 1)} disabled={slideIdx === slides.length - 1} aria-label="Next slide">▶</button>
          </div>
        </div>
      )}

      {tab === 'map' && (
        // Lazy: the map (and its data) only mount once this tab is opened.
        <div className="psm-panel psm-panel-map" role="tabpanel">
          <StoryMap shading={shading} storyFocusIso3={focusIso3} height={PHONE_MAP_HEIGHT} />
        </div>
      )}

      {tab === 'log' && (
        <ul className="as-phone-log" role="tabpanel">
          {decorated.map((s) => (
            <li className="as-phone-log-row" key={s.id}>
              <span className="as-phone-log-lens">{s.lensLabel}</span>
              <span className="as-phone-log-meta"><time dateTime={s.createdAt}>{formatCiteDate(s.createdAt)}</time>{s.checks?.hasError ? ' · checks failed' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StudioDeck({ sections, view, onToggleView, expandedFailed, onShowAnyway, phone, category }) {
  const [focusId, setFocusId] = useState(() => nextFocusId(sections));
  useEffect(() => { setFocusId(nextFocusId(sections)); }, [sections.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const decorated = sections.map((s) => ({ ...s, expanded: !!expandedFailed[s.id], onShowAnyway: () => onShowAnyway(s.id) }));
  const focused = decorated.find((s) => s.id === focusId) || decorated[decorated.length - 1];

  if (phone) return <PhoneDeck decorated={decorated} focused={focused} category={category} />;

  return (
    <div className="as-deck">
      <div className="as-deck-head">
        <div className="as-view-toggle">
          <button type="button" className={view === 'deck' ? 'on' : ''} onClick={() => onToggleView('deck')}>DECK</button>
          <button type="button" className={view === 'text' ? 'on' : ''} onClick={() => onToggleView('text')}>READ AS TEXT</button>
          <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => onToggleView('board')}>BOARD</button>
        </div>
      </div>

      {view === 'text' && decorated.map((s) => <StudioRunResult key={s.id} section={s} expanded={s.expanded} onShowAnyway={s.onShowAnyway} />)}

      {view === 'board' && (
        <>
          {decorated.length > 1 && (
            <div className="as-board-picker">
              {decorated.map((s) => (
                <button key={s.id} type="button" className={`as-board-chip${s.id === focusId ? ' on' : ''}`} onClick={() => setFocusId(s.id)}>
                  {s.lensLabel}
                </button>
              ))}
            </div>
          )}
          {focused && <BoardCards section={focused} />}
        </>
      )}

      {view === 'deck' && (
        <DesktopDeck decorated={decorated} focused={focused} focusId={focusId} onFocus={setFocusId} category={category} />
      )}
    </div>
  );
}
