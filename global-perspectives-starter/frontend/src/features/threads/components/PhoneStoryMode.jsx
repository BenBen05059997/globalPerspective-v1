import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { rootCauseSteps } from '@/shared/lib/rootCause';
import { CATEGORY_BADGE_COLORS } from '@/shared/styles/tokens';
import { useStoryLinks } from '@/features/threads/hooks/useStoryLinks.js';
import { buildLinkArcs } from '@/features/map/lib/storyLinkArcs.js';
import {
  buildChapters, buildDeadlines, buildSlides, viewFrom,
} from '@/features/threads/lib/storyMode.js';
import { BriefSlide, ChapterSlide, FedIntoSlide, WatchSlide, StoryMap } from '@/features/threads/components/StoryMode.jsx';
import BottomSheet from '@/features/map/components/BottomSheet.jsx';
import '@/features/threads/components/StoryMode.css';
import '@/features/threads/components/PhoneStoryMode.css';

const TABS = [
  { key: 'read', label: 'Read' },
  { key: 'map', label: 'Map' },
  { key: 'timeline', label: 'Timeline' },
];

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// PhoneTabs — the P1 tab-bar pattern (same WAI-ARIA tabs + arrow-key roving used by MapPhoneTabs
// on /map), rebuilt here rather than imported so this file has no dependency on the map feature's
// internal tab list (READ/MAP/TIMELINE, not MAP/LIST/ALERTS).
function PhoneTabs({ active, onChange }) {
  const handleKeyDown = (e) => {
    const { key } = e;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    e.preventDefault();
    const count = TABS.length;
    const currentIndex = TABS.findIndex((t) => t.key === active);
    let nextIndex;
    if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = count - 1;
    else if (key === 'ArrowLeft') nextIndex = (currentIndex - 1 + count) % count;
    else nextIndex = (currentIndex + 1) % count;
    const nextKey = TABS[nextIndex].key;
    onChange(nextKey);
    requestAnimationFrame(() => document.getElementById(`psm-tab-${nextKey}`)?.focus());
  };
  return (
    <div className="psm-tabs" role="tablist" aria-label="Story view" onKeyDown={handleKeyDown}>
      {TABS.map((t) => (
        <button
          key={t.key} type="button" role="tab" id={`psm-tab-${t.key}`}
          aria-selected={active === t.key} aria-controls={`psm-panel-${t.key}`}
          tabIndex={active === t.key ? 0 : -1}
          className={`psm-tab${active === t.key ? ' on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SlideBody({ activeSlide, activeChapter, chapters, thread, analysis, displayTitle, category, catColors, forecast, deadlines, fedInto, linkNote, onJumpTimeline, onJumpOutlook }) {
  if (activeSlide?.key === 'brief') {
    return (
      <BriefSlide
        thread={thread} analysis={analysis} displayTitle={displayTitle} category={category} catColors={catColors}
        forecast={forecast} hasChapters={chapters.length > 0} hasWatch={deadlines.length > 0} linkNote={linkNote}
        onJumpTimeline={onJumpTimeline} onJumpOutlook={onJumpOutlook}
      />
    );
  }
  if (activeChapter) return <ChapterSlide chapter={activeChapter} index={chapters.indexOf(activeChapter)} />;
  if (activeSlide?.key === 'fedinto') return <FedIntoSlide fedInto={fedInto} />;
  if (activeSlide?.key === 'watch') return <WatchSlide deadlines={deadlines} />;
  return null;
}

function DrawerSheet({ drawerKey, onClose, whySteps, who, view, sources }) {
  if (!drawerKey) return null;
  const titles = { why: 'WHY', who: 'WHO', viewfrom: 'VIEW FROM', sources: 'SOURCES' };
  return (
    <BottomSheet stop="full" onStopChange={onClose} onClose={onClose} title={titles[drawerKey]}>
      {drawerKey === 'why' && whySteps.map((s) => (
        <div key={s.key} className="sm-drawer-step">
          {s.label && <div className="sm-drawer-step-label">{s.label}</div>}
          <p>{s.text}</p>
        </div>
      ))}
      {drawerKey === 'who' && (
        <ul className="sm-who-list">
          {who.map((a, i) => (
            <li key={i}><b>{a.name}</b>{a.role ? ` — ${a.role}` : ''}{a.mentionCount != null ? ` · ${a.mentionCount} mentions` : ''}</li>
          ))}
        </ul>
      )}
      {drawerKey === 'viewfrom' && view && (
        <>
          <div className="sm-viewfrom-hd">{view.total} outlets identified{view.unknownCount ? ` · ${view.unknownCount} without country data` : ''}</div>
          {view.byCountry.length > 0 && (
            <div className="sm-viewfrom-row"><span className="sm-drawer-step-label">By country</span> {view.byCountry.map((c) => `${c.code} ${c.count}`).join(' · ')}</div>
          )}
          {view.byType.length > 0 && (
            <div className="sm-viewfrom-row"><span className="sm-drawer-step-label">By type</span> {view.byType.map((t) => `${t.type} ${t.count}`).join(' · ')}</div>
          )}
        </>
      )}
      {drawerKey === 'sources' && (
        <ul className="sm-sources-list">
          {sources.slice(0, 20).map((s) => <li key={s}>{s}</li>)}
        </ul>
      )}
    </BottomSheet>
  );
}

// PhoneStoryMode — P1 + PH (TASK_2026-09-27_pages_local S2.2): the phone default for the story
// page. READ (default) shows the same slide deck as desktop, one slide at a time (swipe or ◀▶,
// dots); MAP loads the WebGL/radar map only once this tab opens, with the active slide as a
// BottomSheet; TIMELINE is the scrubber's chapters + deadlines as a vertical dated list, tapping
// a row jumps to that slide in READ. Drawers open as a full BottomSheet from a row of buttons
// under the slide. 44px targets; reduced motion = instant (no swipe transition class).
export default function PhoneStoryMode({ thread, analysis, forecast, displayTitle, category, onReadFull }) {
  const catColors = CATEGORY_BADGE_COLORS[category];
  const entriesOldestFirst = useMemo(() => [...thread.entries].reverse(), [thread.entries]);
  const chapters = useMemo(
    () => buildChapters(entriesOldestFirst, analysis?.entryShortTitles, analysis?.inflectionTopicId, iso3ForName),
    [entriesOldestFirst, analysis],
  );
  const deadlines = useMemo(() => buildDeadlines(forecast), [forecast]);

  const { fedInto: fedIntoRaw, fedFrom: fedFromRaw, loading: fedIntoLoading, note: linkNote, index: webIndex } = useStoryLinks(thread.threadId, thread.regions);
  const fedInto = useMemo(() => (fedIntoLoading ? [] : fedIntoRaw), [fedIntoLoading, fedIntoRaw]);
  const slides = useMemo(() => buildSlides({ chapters, fedInto, deadlines }), [chapters, fedInto, deadlines]);

  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => { if (slideIdx >= slides.length) setSlideIdx(0); }, [slides.length, slideIdx]);
  const activeSlide = slides[slideIdx] || slides[0];
  const activeChapter = chapters.find((c) => c.key === activeSlide?.key) || null;
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const goto = useCallback((i) => setSlideIdx(Math.max(0, Math.min(slides.length - 1, i))), [slides.length]);
  const jumpToChapterKey = useCallback((key) => {
    const i = slides.findIndex((s) => s.key === key);
    if (i >= 0) goto(i);
  }, [slides, goto]);

  const [tab, setTab] = useState('read');
  // Opens at peek so the map itself is visible when the MAP tab opens; drag / Expand for more.
  const [mapSheetStop, setMapSheetStop] = useState('peek');

  // Touch swipe (READ tab): a horizontal drag past a small threshold moves one slide.
  const touchRef = useRef(null);
  const onTouchStart = (e) => { touchRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (start == null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (dx <= -40) goto(slideIdx + 1);
    else if (dx >= 40) goto(slideIdx - 1);
  };

  const [drawer, setDrawer] = useState(null);
  const whySteps = rootCauseSteps(analysis?.rootCauseChain);
  const who = analysis?.keyActors || [];
  const view = useMemo(() => viewFrom(thread.entries), [thread.entries]);
  const hasWhy = whySteps.length > 0;
  const hasWho = who.length > 0;
  const hasViewFrom = !!view;
  const hasSources = thread.allSources.length > 0;
  const anyDrawer = hasWhy || hasWho || hasViewFrom || hasSources;

  const shading = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const c of chapters) {
      if (!c.iso3 || seen.has(c.iso3)) continue;
      seen.add(c.iso3);
      out.push({
        iso3: c.iso3, count: c.mentionCount, top: { title: c.label, category },
        crisisType: crisisTypeForCategory(category), hue: crisisHueForCategory(category),
      });
    }
    return out;
  }, [chapters, category]);
  const primaryIso3 = chapters.find((c) => c.iso3)?.iso3 || null;
  const mapFocusIso3 = activeChapter?.iso3 || primaryIso3;
  const linkArcs = useMemo(
    () => (webIndex ? buildLinkArcs({ threadId: thread.threadId, links: [...fedInto, ...(fedIntoLoading ? [] : fedFromRaw)], threads: webIndex.threads, focalIso3: primaryIso3 }) : []),
    [webIndex, thread.threadId, fedInto, fedFromRaw, fedIntoLoading, primaryIso3],
  );

  return (
    <div className="gp-console psm-root">
      <div className="psm-topbar">
        <div className="psm-topbar-label">STORY MODE</div>
        <button type="button" className="psm-readfull-btn" onClick={onReadFull}>Read in full →</button>
      </div>

      <PhoneTabs active={tab} onChange={setTab} />

      {tab === 'read' && (
        <div className="psm-panel" role="tabpanel" id="psm-panel-read" aria-labelledby="psm-tab-read">
          <div
            className={`psm-slideview${reduced ? ' sm-instant' : ''}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <SlideBody
              activeSlide={activeSlide} activeChapter={activeChapter} chapters={chapters}
              thread={thread} analysis={analysis} displayTitle={displayTitle} category={category} catColors={catColors}
              forecast={forecast} deadlines={deadlines} fedInto={fedInto} linkNote={linkNote}
              onJumpTimeline={() => { if (chapters[0]) jumpToChapterKey(chapters[0].key); }}
              onJumpOutlook={() => jumpToChapterKey('watch')}
            />
          </div>
          <div className="psm-slidenav" role="tablist" aria-label="Story slides">
            <button type="button" className="psm-slidenav-btn" onClick={() => goto(slideIdx - 1)} disabled={slideIdx === 0} aria-label="Previous slide">◀</button>
            <div className="psm-slidedots">
              {slides.map((s, i) => (
                <button
                  key={s.key} type="button" role="tab" aria-selected={i === slideIdx}
                  className={`psm-slidedot${i === slideIdx ? ' on' : ''}`}
                  onClick={() => goto(i)} aria-label={s.label}
                />
              ))}
            </div>
            <button type="button" className="psm-slidenav-btn" onClick={() => goto(slideIdx + 1)} disabled={slideIdx === slides.length - 1} aria-label="Next slide">▶</button>
          </div>
          {anyDrawer && (
            <div className="psm-drawer-row" role="group" aria-label="Story drawers">
              {hasWhy && <button type="button" className="psm-drawer-open" onClick={() => setDrawer('why')}>WHY</button>}
              {hasWho && <button type="button" className="psm-drawer-open" onClick={() => setDrawer('who')}>WHO</button>}
              {hasViewFrom && <button type="button" className="psm-drawer-open" onClick={() => setDrawer('viewfrom')}>VIEW FROM</button>}
              {hasSources && <button type="button" className="psm-drawer-open" onClick={() => setDrawer('sources')}>SOURCES</button>}
            </div>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="psm-panel psm-panel-map" role="tabpanel" id="psm-panel-map" aria-labelledby="psm-tab-map">
          <StoryMap shading={shading} linkArcs={linkArcs} storyFocusIso3={mapFocusIso3} height={320} />
          <BottomSheet stop={mapSheetStop} onStopChange={setMapSheetStop} onClose={() => setMapSheetStop('peek')} title={activeSlide?.label}>
            <SlideBody
              activeSlide={activeSlide} activeChapter={activeChapter} chapters={chapters}
              thread={thread} analysis={analysis} displayTitle={displayTitle} category={category} catColors={catColors}
              forecast={forecast} deadlines={deadlines} fedInto={fedInto} linkNote={linkNote}
              onJumpTimeline={() => { if (chapters[0]) jumpToChapterKey(chapters[0].key); }}
              onJumpOutlook={() => jumpToChapterKey('watch')}
            />
          </BottomSheet>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="psm-panel" role="tabpanel" id="psm-panel-timeline" aria-labelledby="psm-tab-timeline">
          <ul className="psm-tl-list">
            {chapters.map((c, i) => (
              <li key={c.key}>
                <button type="button" className="psm-tl-row" onClick={() => { jumpToChapterKey(c.key); setTab('read'); }}>
                  <span className="psm-tl-date">
                    {formatDateLabel(c.from)}{c.to !== c.from ? ` – ${formatDateLabel(c.to)}` : ''}
                    {c.isInflection && <span className="sm-flag"> ⚑</span>}
                  </span>
                  <span className="psm-tl-label">CH{i + 1} · {c.label}</span>
                </button>
              </li>
            ))}
            {deadlines.map((d) => (
              <li key={d.id}>
                <button type="button" className="psm-tl-row psm-tl-deadline" onClick={() => { jumpToChapterKey('watch'); setTab('read'); }}>
                  <span className="psm-tl-date">◆ {formatDateLabel(d.deadline)}</span>
                  <span className="psm-tl-label">{d.label}</span>
                </button>
              </li>
            ))}
            {chapters.length === 0 && deadlines.length === 0 && (
              <li className="psm-tl-empty">No dated timeline yet.</li>
            )}
          </ul>
        </div>
      )}

      <DrawerSheet drawerKey={drawer} onClose={() => setDrawer(null)} whySteps={whySteps} who={who} view={view} sources={thread.allSources} />
    </div>
  );
}
