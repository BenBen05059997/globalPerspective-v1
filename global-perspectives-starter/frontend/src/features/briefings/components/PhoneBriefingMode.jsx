import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoryMap } from '@/features/threads/components/StoryMode.jsx';
import {
  buildDailySlides, buildWeeklySlides, mapFocusForDailySlide, mapFocusForWeeklySlide,
  shadingForDailySlides, shadingForWeeklySlides,
} from '@/features/briefings/lib/briefingSlides.js';
import { lastNDateKeys, buildDailyEditionMarks, buildPausedSegment, todayKey } from '@/features/briefings/lib/editions.js';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { SlideBody } from '@/features/briefings/components/BriefingSlides.jsx';
import EditionsStrip, { WeeklyEditionNote } from '@/features/briefings/components/EditionsStrip.jsx';
import ReadAsText from '@/features/briefings/components/ReadAsText.jsx';
import '@/features/threads/components/StoryMode.css';
import '@/features/threads/components/PhoneStoryMode.css';
import '@/features/briefings/components/BriefingMode.css';
import '@/features/briefings/components/PhoneBriefingMode.css';

const TABS = [
  { key: 'read', label: 'Read' },
  { key: 'map', label: 'Map' },
  { key: 'editions', label: 'Editions' },
];

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

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
    onChange(TABS[nextIndex].key);
    requestAnimationFrame(() => document.getElementById(`pbm-tab-${TABS[nextIndex].key}`)?.focus());
  };
  return (
    <div className="psm-tabs" role="tablist" aria-label="Briefing view" onKeyDown={handleKeyDown}>
      {TABS.map((t) => (
        <button
          key={t.key} type="button" role="tab" id={`pbm-tab-${t.key}`}
          aria-selected={active === t.key} aria-controls={`pbm-panel-${t.key}`}
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

// PhoneBriefingMode — P1 + PH: READ default (swipeable slides), MAP tab (lazy-loads the map),
// EDITIONS tab (the strip as a full list). Same dark console surface as PhoneStoryMode.
export default function PhoneBriefingMode({
  mode, onModeChange,
  dailyBrief, weeklyBrief,
  dailyEditionsIndex, dailyAnchorDateKey, requestedDateKey, onSelectDailyDate,
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

  const [tab, setTab] = useState('read');
  const [readAsText, setReadAsText] = useState(false);

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
        <div className="psm-topbar-label">BRIEFING MODE</div>
        <div className="bm-mode-toggle" role="tablist" aria-label="Daily or weekly">
          <button type="button" role="tab" aria-selected={mode === 'daily'} className={`bm-mode-btn${mode === 'daily' ? ' on' : ''}`} onClick={() => onModeChange('daily')}>DAILY</button>
          <button type="button" role="tab" aria-selected={mode === 'weekly'} className={`bm-mode-btn${mode === 'weekly' ? ' on' : ''}`} onClick={() => onModeChange('weekly')}>WEEKLY</button>
        </div>
      </div>

      <PhoneTabs active={tab} onChange={setTab} />

      {tab === 'read' && (
        <div className="psm-panel" role="tabpanel" id="pbm-panel-read" aria-labelledby="pbm-tab-read">
          <button type="button" className="bm-readtext-btn" onClick={() => setReadAsText((v) => !v)}>
            {readAsText ? '← Back to slides' : 'Read as text →'}
          </button>
          {readAsText ? (
            <div className="bm-readtext-wrap">
              <ReadAsText mode={mode} brief={brief} />
            </div>
          ) : (
            <>
              <div
                className={`psm-slideview${reduced ? ' sm-instant' : ''}`}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <SlideBody mode={mode} slide={activeSlide} brief={brief} />
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
            </>
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="psm-panel psm-panel-map" role="tabpanel" id="pbm-panel-map" aria-labelledby="pbm-tab-map">
          <StoryMap shading={shading} storyFocusIso3={mapFocusIso3} height={320} />
        </div>
      )}

      {tab === 'editions' && (
        <div className="psm-panel" role="tabpanel" id="pbm-panel-editions" aria-labelledby="pbm-tab-editions">
          {mode === 'weekly' ? (
            <WeeklyEditionNote weekOf={weeklyBrief?.weekOf} />
          ) : (
            <EditionsStrip
              key={mode}
              marks={dailyMarks}
              pausedSegment={pausedSegment}
              currentDateKey={requestedDateKey || dailyAnchorDateKey}
              onSelect={(dk) => { onSelectDailyDate?.(dk); setTab('read'); }}
              latestLabel={dailyAnchorDateKey ? formatDateLabel(dailyAnchorDateKey) : null}
              onGoLatest={() => { onSelectDailyDate?.(dailyAnchorDateKey); setTab('read'); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
