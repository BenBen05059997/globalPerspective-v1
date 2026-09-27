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
import '@/features/briefings/components/BriefingMode.css';

const FALLBACK_STAGE_HEIGHT = 460;
const MIN_ROOT_HEIGHT = 520;

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

// BriefingMode — desktop briefing mode (S3): map + horizontal slides + an editions strip, the
// same console pattern as story mode (StoryMode.jsx).
export default function BriefingMode({
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
  const next = useCallback(() => goto(slideIdx + 1), [goto, slideIdx]);
  const prev = useCallback(() => goto(slideIdx - 1), [goto, slideIdx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const mapFocusIso3 = mode === 'weekly' ? mapFocusForWeeklySlide(activeSlide) : mapFocusForDailySlide(activeSlide);

  const [readAsText, setReadAsText] = useState(false);

  const rootRef = useRef(null);
  const [rootHeight, setRootHeight] = useState(MIN_ROOT_HEIGHT);
  useEffect(() => {
    const measure = () => {
      if (!rootRef.current) return;
      const top = rootRef.current.getBoundingClientRect().top;
      setRootHeight(Math.max(MIN_ROOT_HEIGHT, Math.round(window.innerHeight - top - 16)));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    // Layout's own "AI paused" banner loads asynchronously (a separate network round-trip) and,
    // when it lands after this mount's first measurement, pushes the console down without firing
    // a `resize` event — re-measuring shortly after catches that late shift instead of baking in
    // a too-tall height from before the banner existed.
    const settleTimer = setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
    };
  }, []);
  const stageRef = useRef(null);
  const [stageHeight, setStageHeight] = useState(FALLBACK_STAGE_HEIGHT);
  useEffect(() => {
    if (!stageRef.current || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height;
      if (h) setStageHeight(Math.round(h));
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  // Editions strip data — the probe window ends at the latest known edition (no extra requests;
  // useDailyEditionsIndex never looks past it), and the real gap since then (if any) is one dated
  // "paused" range, not a false "AI paused" reason stamped on every pre-pause missing day.
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
      <div className="gp-console bm-root bm-empty">
        <p>No {mode} briefing is available right now.</p>
      </div>
    );
  }

  return (
    <div className="gp-console bm-root" ref={rootRef} style={{ height: rootHeight }}>
      <div className="sm-topbar bm-topbar">
        <div className="sm-topbar-label">BRIEFING MODE</div>
        <div className="bm-mode-toggle" role="tablist" aria-label="Daily or weekly">
          <button type="button" role="tab" aria-selected={mode === 'daily'} className={`bm-mode-btn${mode === 'daily' ? ' on' : ''}`} onClick={() => onModeChange('daily')}>DAILY</button>
          <button type="button" role="tab" aria-selected={mode === 'weekly'} className={`bm-mode-btn${mode === 'weekly' ? ' on' : ''}`} onClick={() => onModeChange('weekly')}>WEEKLY</button>
        </div>
        <button type="button" className="sm-readfull-btn" onClick={() => setReadAsText((v) => !v)}>
          {readAsText ? '← Back to briefing mode' : 'Read as text →'}
        </button>
      </div>

      {readAsText ? (
        <div className="bm-readtext-wrap">
          <ReadAsText mode={mode} brief={brief} />
        </div>
      ) : (
        <>
          <div className="sm-body">
            <div className="sm-stage" ref={stageRef}>
              <StoryMap shading={shading} storyFocusIso3={mapFocusIso3} height={stageHeight} />

              <div className="sm-slidecard">
                <div className="sm-slidenav" role="tablist" aria-label="Briefing slides">
                  <button type="button" className="sm-slidenav-btn" onClick={prev} disabled={slideIdx === 0} aria-label="Previous slide">◀</button>
                  <div className="sm-slidedots">
                    {slides.map((s, i) => (
                      <button
                        key={s.key} type="button" role="tab" aria-selected={i === slideIdx}
                        className={`sm-slidedot${i === slideIdx ? ' on' : ''}`}
                        onClick={() => goto(i)} title={s.label}
                      >{s.label}</button>
                    ))}
                  </div>
                  <button type="button" className="sm-slidenav-btn" onClick={next} disabled={slideIdx === slides.length - 1} aria-label="Next slide">▶</button>
                </div>
                <div className="sm-slidescroll">
                  <div className={`sm-slideview${reduced ? ' sm-instant' : ''}`}>
                    <SlideBody mode={mode} slide={activeSlide} brief={brief} />
                  </div>
                </div>
                <div className="sm-slidefade" aria-hidden="true" />
              </div>
            </div>
          </div>

          {mode === 'weekly' ? (
            <WeeklyEditionNote weekOf={weeklyBrief?.weekOf} />
          ) : (
            <EditionsStrip
              key={mode}
              marks={dailyMarks}
              pausedSegment={pausedSegment}
              currentDateKey={requestedDateKey || dailyAnchorDateKey}
              onSelect={onSelectDailyDate}
              latestLabel={dailyAnchorDateKey ? formatDateLabel(dailyAnchorDateKey) : null}
              onGoLatest={() => onSelectDailyDate?.(dailyAnchorDateKey)}
            />
          )}
        </>
      )}
    </div>
  );
}
