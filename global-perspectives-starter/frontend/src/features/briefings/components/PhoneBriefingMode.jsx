import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StoryMap from '@/shared/map/StoryMap.jsx';
import {
  buildDailySlides, buildWeeklySlides, mapFocusForDailySlide, mapFocusForWeeklySlide,
  shadingForDailySlides, shadingForWeeklySlides,
} from '@/features/briefings/lib/briefingSlides.js';
import { lastNDateKeys, buildDailyEditionMarks, buildPausedSegment, todayKey } from '@/features/briefings/lib/editions.js';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { SlideBody } from '@/features/briefings/components/BriefingSlides.jsx';
import EditionsStrip, { WeeklyEditionNav } from '@/features/briefings/components/EditionsStrip.jsx';
import { BriefingModeToggle } from '@/features/briefings/components/BriefingMode.jsx';
import Tabs, { tabPanelProps } from '@/shared/ui/Tabs.jsx';
import '@/shared/ui/deck.css';
import '@/features/briefings/components/BriefingMode.css';
import '@/features/briefings/components/PhoneBriefingMode.css';

const TABS = [
  { key: 'slides', label: 'Slides' },
  { key: 'map', label: 'Map' },
  { key: 'editions', label: 'Editions' },
];

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// PhoneBriefingMode — P1 + PH: SLIDES default (swipeable slides), MAP tab (lazy-loads the map),
// EDITIONS tab (the strip as a full list). Same dark console surface as PhoneStoryMode.
export default function PhoneBriefingMode({
  mode, onModeChange,
  dailyBrief, weeklyBrief,
  dailyEditionsIndex, dailyAnchorDateKey, requestedDateKey, onSelectDailyDate,
  requestedWeek, hrefForWeek,
}) {
  const brief = mode === 'weekly' ? weeklyBrief : dailyBrief;
  const slides = useMemo(
    () => (mode === 'weekly' ? buildWeeklySlides(weeklyBrief) : buildDailySlides(dailyBrief)),
    [mode, weeklyBrief, dailyBrief],
  );
  const shading = useMemo(
    () => (mode === 'weekly' ? shadingForWeeklySlides(weeklyBrief) : shadingForDailySlides(dailyBrief)),
    [mode, weeklyBrief, dailyBrief],
  );

  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => { setSlideIdx(0); }, [mode, brief]);
  useEffect(() => { if (slideIdx >= slides.length) setSlideIdx(0); }, [slides.length, slideIdx]);
  const activeSlide = slides[slideIdx] || slides[0];
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const goto = useCallback((i) => setSlideIdx(Math.max(0, Math.min(slides.length - 1, i))), [slides.length]);

  const mapFocusIso3 = mode === 'weekly' ? mapFocusForWeeklySlide(activeSlide) : mapFocusForDailySlide(activeSlide);

  const [tab, setTab] = useState('slides');
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

  const dailyMarks = useMemo(() => {
    if (mode !== 'daily' || !dailyAnchorDateKey) return [];
    const keys = lastNDateKeys(dailyAnchorDateKey, 14);
    return buildDailyEditionMarks(keys, dailyEditionsIndex, requestedDateKey || dailyAnchorDateKey);
  }, [mode, dailyAnchorDateKey, dailyEditionsIndex, requestedDateKey]);
  const pausedSegment = useMemo(
    () => (dailyAnchorDateKey ? buildPausedSegment(dailyAnchorDateKey, todayKey()) : null),
    [dailyAnchorDateKey],
  );

  if (!brief) {
    return (
      <div className="gp-console psm-root bm-empty">
        <p>No {mode} briefing is available right now.</p>
      </div>
    );
  }

  return (
    <div className="gp-console psm-root bm-root">
      <div className="psm-topbar bm-topbar">
        <div className="psm-topbar-label">PRESENT</div>
        <BriefingModeToggle mode={mode} onModeChange={onModeChange} />
      </div>

      <Tabs variant="phone" idBase="pbm" label="Briefing view" tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'slides' && (
        <div className="psm-panel" {...tabPanelProps('pbm', 'slides')}>
          <div
            className={`psm-slideview${reduced ? ' sm-instant' : ''}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <SlideBody mode={mode} slide={activeSlide} brief={brief} isLast={slideIdx === slides.length - 1} />
          </div>
          <div className="psm-slidenav" role="tablist" aria-label="Briefing slides">
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
        </div>
      )}

      {tab === 'map' && (
        <div className="psm-panel psm-panel-map" {...tabPanelProps('pbm', 'map')}>
          <StoryMap shading={shading} storyFocusIso3={mapFocusIso3} height={320} />
        </div>
      )}

      {tab === 'editions' && (
        <div className="psm-panel" {...tabPanelProps('pbm', 'editions')}>
          {mode === 'weekly' ? (
            <WeeklyEditionNav weekOf={weeklyBrief?.weekOf} requestedWeek={requestedWeek} hrefForWeek={hrefForWeek} />
          ) : (
            <EditionsStrip
              key={mode}
              marks={dailyMarks}
              pausedSegment={pausedSegment}
              currentDateKey={requestedDateKey || dailyAnchorDateKey}
              onSelect={(dk) => { onSelectDailyDate?.(dk); setTab('slides'); }}
              latestLabel={dailyAnchorDateKey ? formatDateLabel(dailyAnchorDateKey) : null}
              onGoLatest={() => { onSelectDailyDate?.(dailyAnchorDateKey); setTab('slides'); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
