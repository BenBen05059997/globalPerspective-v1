import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { iso3ForName } from '@/shared/lib/situationLabels.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { rootCauseSteps } from '@/shared/lib/rootCause';
import Button from '@/shared/ui/Button.jsx';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';
import { useStoryLinks } from '@/features/threads/hooks/useStoryLinks.js';
import { buildLinkArcs } from '@/shared/map/storyLinkArcs.js';
import {
  buildChapters, buildDeadlines, buildSlides, viewFrom,
} from '@/features/threads/lib/storyMode.js';
import { BriefSlide, ChapterSlide, FedIntoSlide, WatchSlide } from '@/features/threads/components/StoryMode.jsx';
import StoryMap from '@/shared/map/StoryMap.jsx';
import BottomSheet from '@/shared/ui/BottomSheet.jsx';
import '@/shared/ui/deck.css';
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

function SlideBody({ activeSlide, activeChapter, chapters, thread, analysis, displayTitle, category, forecast, deadlines, fedInto, linkNote, onJumpTimeline, onJumpOutlook }) {
  if (activeSlide?.key === 'brief') {
    return (
      <BriefSlide
        thread={thread} analysis={analysis} displayTitle={displayTitle} category={category}
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
        <Button compact onClick={onReadFull}>Read in full →</Button>
      </div>

      <Tabs variant="phone" idBase="psm" label="Story view" tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'read' && (
        <div className="psm-panel" {...tabPanelProps('psm', 'read')}>
          <div
            className={`psm-slideview${reduced ? ' sm-instant' : ''}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <SlideBody
              activeSlide={activeSlide} activeChapter={activeChapter} chapters={chapters}
              thread={thread} analysis={analysis} displayTitle={displayTitle} category={category}
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
              {hasWhy && <Button compact className="psm-drawer-open" onClick={() => setDrawer('why')}>WHY</Button>}
              {hasWho && <Button compact className="psm-drawer-open" onClick={() => setDrawer('who')}>WHO</Button>}
              {hasViewFrom && <Button compact className="psm-drawer-open" onClick={() => setDrawer('viewfrom')}>VIEW FROM</Button>}
              {hasSources && <Button compact className="psm-drawer-open" onClick={() => setDrawer('sources')}>SOURCES</Button>}
            </div>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="psm-panel psm-panel-map" {...tabPanelProps('psm', 'map')}>
          <StoryMap shading={shading} linkArcs={linkArcs} storyFocusIso3={mapFocusIso3} height={320} />
          <BottomSheet stop={mapSheetStop} onStopChange={setMapSheetStop} onClose={() => setMapSheetStop('peek')} title={activeSlide?.label}>
            <SlideBody
              activeSlide={activeSlide} activeChapter={activeChapter} chapters={chapters}
              thread={thread} analysis={analysis} displayTitle={displayTitle} category={category}
              forecast={forecast} deadlines={deadlines} fedInto={fedInto} linkNote={linkNote}
              onJumpTimeline={() => { if (chapters[0]) jumpToChapterKey(chapters[0].key); }}
              onJumpOutlook={() => jumpToChapterKey('watch')}
            />
          </BottomSheet>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="psm-panel" {...tabPanelProps('psm', 'timeline')}>
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
