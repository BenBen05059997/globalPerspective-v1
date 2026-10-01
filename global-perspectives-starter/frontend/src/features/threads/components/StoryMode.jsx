import { useMemo, useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import BootLoader from '@/shared/ui/boot/BootLoader.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import { formatDateLabel } from '@/shared/lib/dateUtils';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { crisisHueForCategory, crisisTypeForCategory } from '@/shared/lib/crisisHue.js';
import { CATEGORY_BADGE_COLORS, riskScoreToVar as RISK_COLOR } from '@/shared/styles/tokens';
import { tierFromScore, tierLabel } from '@/shared/lib/riskTiers';
import { rootCauseSteps } from '@/shared/lib/rootCause';
import { firstSentences } from '@/features/map/lib/cardText.js';
import { useStoryLinks } from '@/features/threads/hooks/useStoryLinks.js';
import {
  analysisTextState, buildChapters, buildScrubberDays, buildDeadlines, buildSlides, viewFrom,
  scrubberRange, pctForDate, shortDate, rawDateLabel, spanDays, buildScrubberTicks, mostLikelyScenario,
} from '@/features/threads/lib/storyMode.js';
import FedIntoList from '@/features/threads/components/FedIntoList.jsx';
import QuestionChip from '@/features/threads/components/QuestionChip.jsx';
import { legacyNote } from '@/features/threads/lib/questionChips.js';
import { buildLinkArcs } from '@/features/map/lib/storyLinkArcs.js';
import { distinctTargets } from '@/features/threads/lib/webIndexLinks.js';
import StoryLinkNote from '@/features/threads/components/StoryLinkNote.jsx';
import RadarMap from '@/features/map/components/RadarMap.jsx';
import '@/features/threads/components/StoryMode.css';

// Story-mode's map is the same console map component /map uses (lazy — deck.gl is heavy, code-
// split so it only loads on this route), with a WebGL-less RadarMap fallback (same pattern as
// SituationHome.jsx's USE_3D check).
const SituationMap3D = lazy(() => import('@/features/map/components/SituationMap3D.jsx'));

function canUse3D() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

const FALLBACK_STAGE_HEIGHT = 460;
const MIN_ROOT_HEIGHT = 520;

function AnalysisNote({ generatedAt, children }) {
  const state = analysisTextState(generatedAt);
  const date = generatedAt ? shortDate(generatedAt) : null;
  if (state === 'hidden') {
    return <p className="sm-analysis-hidden">Analysis from {date} is more than 30 days old — hidden.</p>;
  }
  return (
    <div className={state === 'older' ? 'sm-older' : ''}>
      {state === 'older' && date && <span className="sm-older-tag">older analysis · {date}</span>}
      {children}
    </div>
  );
}

// Review fix #8: the AI story-arc paragraph used to run off the bottom of the card with no cue.
// Show the first ~3 sentences (cardText.js's shared summarizer, so story mode reads the same as
// the map's story card) with an explicit "Read more" toggle, instead of relying only on scroll.
function ExpandableText({ text, tagLabel }) {
  const [expanded, setExpanded] = useState(false);
  const short = useMemo(() => firstSentences(text, 3), [text]);
  const truncated = !!short && short.length < text.length;
  return (
    <>
      <p className="sm-slide-text">
        {tagLabel && <span className="sm-ai-tag">{tagLabel}</span>} {expanded || !truncated ? text : short}
      </p>
      {truncated && (
        <button type="button" className="sm-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less ▴' : 'Read more ▾'}
        </button>
      )}
    </>
  );
}

// ── Slide bodies ──────────────────────────────────────────────────────────────

export function BriefSlide({ thread, analysis, displayTitle, category, catColors, forecast, hasChapters, hasWatch, linkNote = null, onJumpTimeline, onJumpOutlook }) {
  const first = thread.entries[thread.entries.length - 1]; // oldest
  const from = thread.dateRange.from;
  const to = thread.dateRange.to;
  const likely = mostLikelyScenario(forecast);
  return (
    <div className="sm-slide sm-slide-brief">
      <div className="sm-slide-kicker">
        {catColors && <CategoryTag category={category} />}
        <span>{rawDateLabel(from)} — {rawDateLabel(to)} · {spanDays(from, to)} day{spanDays(from, to) === 1 ? '' : 's'}</span>
      </div>
      <h2 className="sm-slide-title">{displayTitle}</h2>
      {analysis?.storyArc ? (
        <AnalysisNote generatedAt={analysis.generatedAt}>
          <ExpandableText text={analysis.storyArc} tagLabel="model judgment" />
        </AnalysisNote>
      ) : (
        <p className="sm-slide-text"><span className="sm-fact-badge">FACT</span> {first?.title}</p>
      )}
      {likely && (
        <div className="sm-likely-badge" title="The forecast's own highest-probability scenario">
          Most likely: <b>{likely.label}</b> ({Math.round(likely.probability * 100)}%)
        </div>
      )}
      <div className="sm-slide-stats">
        <span><b>{thread.entries.length}</b> events</span>
        <span><b>{thread.allSources.length}</b> sources</span>
        {analysis?.riskScore != null && (
          <span style={{ color: RISK_COLOR(analysis.riskScore) }}><b>{tierLabel(tierFromScore(analysis.riskScore))}</b> risk</span>
        )}
      </div>
      {(hasChapters || hasWatch) && (
        <div className="sm-jump-row">
          {hasChapters && <button type="button" className="sm-jump-btn" onClick={onJumpTimeline}>→ Timeline</button>}
          {hasWatch && <button type="button" className="sm-jump-btn" onClick={onJumpOutlook}>→ Outlook</button>}
        </div>
      )}
      <StoryLinkNote note={linkNote} />
      <p className="sm-legend">
        <span className="sm-fact-badge">FACT</span> cited dated news · <span className="sm-inference-badge">INFERENCE</span> model judgment
      </p>
    </div>
  );
}

export function ChapterSlide({ chapter, index }) {
  return (
    <div className="sm-slide sm-slide-chapter">
      <div className="sm-slide-kicker">
        CH{index + 1} · {formatDateLabel(chapter.from)}{chapter.to !== chapter.from ? ` – ${formatDateLabel(chapter.to)}` : ''}
        {chapter.isInflection && <span className="sm-flag"> ⚑ turning point</span>}
        {chapter.country && <span> · {chapter.country}</span>}
      </div>
      <h2 className="sm-slide-title">{chapter.label}</h2>
      <p className="sm-legend"><span className="sm-fact-badge">FACT</span> cited dated news, this story&apos;s own timeline</p>
      <ul className="sm-chapter-entries">
        {chapter.entries.map((e, i) => (
          <li key={`${e.topicId || e.date}-${i}`}>
            <span className="sm-chapter-date">{formatDateLabel(e.date)}</span>
            <span className="sm-chapter-hl">{e.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FedIntoSlide({ fedInto }) {
  return (
    <div className="sm-slide sm-slide-fedinto">
      <div className="sm-slide-kicker">FED INTO · {distinctTargets(fedInto)} linked {distinctTargets(fedInto) === 1 ? 'story' : 'stories'}</div>
      <h2 className="sm-slide-title">News this story is judged to feed into</h2>
      <p className="sm-caption">
        <span className="sm-inference-badge">INFERENCE</span> Links are between stories; we don&apos;t know which event in
        this story drove each one.
      </p>
      <FedIntoList links={fedInto} direction="into" />
    </div>
  );
}

export function WatchSlide({ deadlines }) {
  const now = Date.now();
  const note = legacyNote(deadlines);
  return (
    <div className="sm-slide sm-slide-watch">
      <div className="sm-slide-kicker">WATCH · {deadlines.length} dated {deadlines.length === 1 ? 'trigger' : 'triggers'}</div>
      <h2 className="sm-slide-title">What to watch</h2>
      <ul className="sm-watch-list">
        {deadlines.map((d) => {
          const ms = new Date(d.deadline).getTime();
          const daysLeft = Number.isFinite(ms) ? Math.round((ms - now) / 86400000) : null;
          return (
            <li key={d.id} className="sm-watch-row">
              <span className="sm-watch-diamond" aria-hidden="true">◆</span>
              <div>
                <div className="sm-watch-text">{d.label}</div>
                <QuestionChip trigger={d} />
                <div className="sm-watch-meta">
                  {formatDateLabel(d.deadline)}
                  {daysLeft != null && (daysLeft >= 0 ? ` · in ${daysLeft}d` : ` · ${-daysLeft}d ago`)}
                  {d.scenarioLabel && ` · scenario: ${d.scenarioLabel}`}
                  {d.verdict && ` · ${d.verdict}`}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {note && <p className="sm-watch-note">{note}</p>}
    </div>
  );
}

// ── Scrubber ──────────────────────────────────────────────────────────────────

function Scrubber({ days, chapters, deadlines, inflectionDate, activeKey, onJumpToChapter, onJumpToDate }) {
  const { startMs, endMs } = useMemo(
    () => scrubberRange(chapters[0]?.from, chapters[chapters.length - 1]?.to, deadlines),
    [chapters, deadlines],
  );
  const ticks = useMemo(() => buildScrubberTicks(startMs, endMs), [startMs, endMs]);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayPct = pctForDate(todayIso, startMs, endMs);

  return (
    <div className="sm-scrubber" role="group" aria-label="Story timeline scrubber">
      <div className="sm-scrubber-chapters">
        {chapters.map((c, i) => {
          const left = pctForDate(c.from, startMs, endMs);
          const right = pctForDate(c.to, startMs, endMs);
          const width = Math.max(2, right - left);
          return (
            <button
              key={c.key}
              type="button"
              className={`sm-scrubber-chapter${activeKey === c.key ? ' on' : ''}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onJumpToChapter(c.key)}
              title={`CH${i + 1} · ${c.label}`}
              aria-label={`Jump to chapter ${i + 1}: ${c.label}`}
            >
              {/* Chapters compressed by a long forecast tail (e.g. a week of news inside a
                  4-month range) are too narrow for a label — the title tooltip still carries it. */}
              {width >= 4 && <span className="sm-scrubber-chapter-label">CH{i + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="sm-scrubber-track">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className="sm-scrubber-day"
            style={{ left: `${pctForDate(d.date, startMs, endMs)}%`, height: `${(d.count / maxCount) * 100}%` }}
            title={`${formatDateLabel(d.date)} · ${d.count} item${d.count !== 1 ? 's' : ''}`}
            aria-label={`${formatDateLabel(d.date)}, ${d.count} item${d.count !== 1 ? 's' : ''}`}
            onClick={() => onJumpToDate(d.date)}
          />
        ))}
        {inflectionDate && (
          <span
            className="sm-scrubber-flag" style={{ left: `${pctForDate(inflectionDate, startMs, endMs)}%` }}
            role="img" aria-label={`Turning point, ${formatDateLabel(inflectionDate)}`} title={`Turning point · ${formatDateLabel(inflectionDate)}`}
          >⚑</span>
        )}
        {deadlines.map((d) => (
          <span
            key={d.id}
            className="sm-scrubber-deadline"
            style={{ left: `${pctForDate(d.deadline, startMs, endMs)}%` }}
            role="img"
            aria-label={`Deadline, ${formatDateLabel(d.deadline)}: ${d.label}`}
            title={`Deadline · ${formatDateLabel(d.deadline)} · ${d.label}`}
          >◆</span>
        ))}
        <span className="sm-scrubber-today" style={{ left: `${todayPct}%` }} title={`Today · ${formatDateLabel(todayIso)}`}>
          <span className="sm-scrubber-today-label">TODAY</span>
        </span>
      </div>
      <div className="sm-scrubber-axis">
        {ticks.map((t) => (
          <span key={t.ms} className="sm-scrubber-tick" style={{ left: `${pctForDate(new Date(t.ms).toISOString().slice(0, 10), startMs, endMs)}%` }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Drawers ───────────────────────────────────────────────────────────────────

function Drawer({ label, open, onToggle, children }) {
  return (
    <div className="sm-drawer">
      <button type="button" className={`sm-drawer-btn${open ? ' on' : ''}`} aria-expanded={open} onClick={onToggle}>
        {label}
      </button>
      {open && <div className="sm-drawer-body">{children}</div>}
    </div>
  );
}

// ── Map pane ──────────────────────────────────────────────────────────────────

export function StoryMap({ shading, storyFocusIso3, height, linkArcs = [] }) {
  const [use3D] = useState(() => canUse3D());
  const h = height || FALLBACK_STAGE_HEIGHT;
  return (
    <div className="sm-mapwrap" style={{ height: h }}>
      {use3D ? (
        <Suspense fallback={<div className="sm-maploading" style={{ height: h }}><BootLoader variant="inline" className="gp-boot--tight" label="Loading map" text="Loading map" /></div>}>
          <SituationMap3D
            situations={[]} focusId={null} callout={null} tour={null} newIds={null} view="globe"
            onSelect={() => {}} onOpenCallout={() => {}} height={h} width={null}
            shading={shading} linkArcs={linkArcs} storyFocusIso3={storyFocusIso3}
            onSelectCountry={() => {}} onHoverCountry={() => {}} onFocusCountry={() => {}} onLeaveCountry={() => {}}
            countryRisk={[]} onSelectCountryRisk={() => {}} onHoverCountryRisk={() => {}} onFocusCountryRisk={() => {}} onLeaveCountryRisk={() => {}}
          />
        </Suspense>
      ) : (
        <RadarMap
          situations={[]} focusId={null} callout={null} newIds={null}
          onSelect={() => {}} onOpenCallout={() => {}} onScan={() => {}} height={h}
          shading={shading} linkArcs={linkArcs} storyFocusIso3={storyFocusIso3}
          onSelectCountry={() => {}} onHoverCountry={() => {}} onFocusCountry={() => {}} onLeaveCountry={() => {}}
          countryRisk={[]} onSelectCountryRisk={() => {}} onHoverCountryRisk={() => {}} onFocusCountryRisk={() => {}} onLeaveCountryRisk={() => {}}
        />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StoryMode({ thread, analysis, forecast, displayTitle, category, onReadFull }) {
  const catColors = CATEGORY_BADGE_COLORS[category];
  const entriesOldestFirst = useMemo(() => [...thread.entries].reverse(), [thread.entries]);

  const chapters = useMemo(
    () => buildChapters(entriesOldestFirst, analysis?.entryShortTitles, analysis?.inflectionTopicId, iso3ForName),
    [entriesOldestFirst, analysis],
  );
  const deadlines = useMemo(() => buildDeadlines(forecast), [forecast]);
  const scrubberDays = useMemo(() => buildScrubberDays(thread.entries), [thread.entries]);
  const inflectionDate = chapters.find((c) => c.isInflection)?.inflectionDate || null;

  // Review fix #1: while the fed-into fetch is in flight, treat it as empty so the FED INTO dot
  // never appears (and disappears again) mid-load — it only ever shows once we KNOW there's a
  // real link (S6).
  const { fedInto: fedIntoRaw, fedFrom: fedFromRaw, loading: fedIntoLoading, note: linkNote, index: webIndex } = useStoryLinks(thread.threadId, thread.regions);
  const fedInto = useMemo(() => (fedIntoLoading ? [] : fedIntoRaw), [fedIntoLoading, fedIntoRaw]);
  const slides = useMemo(() => buildSlides({ chapters, fedInto, deadlines }), [chapters, fedInto, deadlines]);

  const [slideIdx, setSlideIdx] = useState(0);
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

  const jumpToChapterKey = useCallback((key) => {
    const i = slides.findIndex((s) => s.key === key);
    if (i >= 0) goto(i);
  }, [slides, goto]);
  const jumpToDate = useCallback((date) => {
    const chapter = chapters.find((c) => date >= c.from && date <= c.to);
    if (chapter) jumpToChapterKey(chapter.key);
  }, [chapters, jumpToChapterKey]);

  const [drawer, setDrawer] = useState(null);
  const toggleDrawer = (key) => setDrawer((d) => (d === key ? null : key));

  const whySteps = rootCauseSteps(analysis?.rootCauseChain);
  const who = analysis?.keyActors || [];
  const view = useMemo(() => viewFrom(thread.entries), [thread.entries]);
  const sourceCount = thread.allSources.length;
  // Review fix #2: a drawer with nothing behind it is hidden entirely (button included), not shown
  // as an empty "not analysed yet" shell — the task said hide, not stub.
  const hasWhy = whySteps.length > 0;
  const hasWho = who.length > 0;
  const hasViewFrom = !!view;
  const hasSources = sourceCount > 0;
  const anyDrawer = hasWhy || hasWho || hasViewFrom || hasSources;

  // Map shading: every chapter's country gets a wash (S7 — never a made-up pin).
  const activeChapter = chapters.find((c) => c.key === activeSlide?.key) || null;
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
  // Review fix #5: the map used to open on its generic default view (Africa) until a chapter slide
  // was visited. Default to the story's own primary country (its first chapter's) on every slide,
  // including BRIEF/FED INTO/WATCH, so it always opens centred on the story, never adrift.
  const primaryIso3 = chapters.find((c) => c.iso3)?.iso3 || null;
  const mapFocusIso3 = activeChapter?.iso3 || primaryIso3;
  // Batch 4 / F: judged links (strong + medium) to other stories, drawn between approx. places; memoised so the map
  // does not redraw on every render.
  const linkArcs = useMemo(
    () => (webIndex ? buildLinkArcs({ threadId: thread.threadId, links: [...fedInto, ...(fedIntoLoading ? [] : fedFromRaw)], threads: webIndex.threads, focalIso3: primaryIso3 }) : []),
    [webIndex, thread.threadId, fedInto, fedFromRaw, fedIntoLoading, primaryIso3],
  );

  // Review fix #9: size the console to the space actually available under the fixed nav/status
  // header, so nothing scrolls at 1440×900. Measured (not guessed) from this element's own
  // position, so it stays correct whatever banners/breadcrumbs sit above it.
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
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, []);
  // The map's own numeric height prop is read from the stage's actual rendered box (after the
  // flex layout above has settled), not recomputed independently — so the map, the slide card and
  // the rest of the console always agree on how tall the middle band is.
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

  return (
    <div className="gp-console sm-root" ref={rootRef} style={{ height: rootHeight }}>
      <div className="sm-topbar">
        <div className="sm-topbar-label">STORY MODE</div>
        <button type="button" className="sm-readfull-btn" onClick={onReadFull}>Read in full →</button>
      </div>

      <div className="sm-body">
        {anyDrawer && (
          <div className="sm-drawers-rail" role="group" aria-label="Story drawers">
            {hasWhy && (
              <Drawer label="WHY" open={drawer === 'why'} onToggle={() => toggleDrawer('why')}>
                {whySteps.map((s) => (
                  <div key={s.key} className="sm-drawer-step">
                    {s.label && <div className="sm-drawer-step-label">{s.label}</div>}
                    <p>{s.text}</p>
                  </div>
                ))}
              </Drawer>
            )}
            {hasWho && (
              <Drawer label="WHO" open={drawer === 'who'} onToggle={() => toggleDrawer('who')}>
                <ul className="sm-who-list">
                  {who.map((a, i) => (
                    <li key={i}><b>{a.name}</b>{a.role ? ` — ${a.role}` : ''}{a.mentionCount != null ? ` · ${a.mentionCount} mentions` : ''}</li>
                  ))}
                </ul>
              </Drawer>
            )}
            {hasViewFrom && (
              <Drawer label="VIEW FROM" open={drawer === 'viewfrom'} onToggle={() => toggleDrawer('viewfrom')}>
                <div className="sm-viewfrom-hd">{view.total} outlets identified{view.unknownCount ? ` · ${view.unknownCount} without country data` : ''}</div>
                {view.byCountry.length > 0 && (
                  <div className="sm-viewfrom-row"><span className="sm-drawer-step-label">By country</span> {view.byCountry.map((c) => `${c.code} ${c.count}`).join(' · ')}</div>
                )}
                {view.byType.length > 0 && (
                  <div className="sm-viewfrom-row"><span className="sm-drawer-step-label">By type</span> {view.byType.map((t) => `${t.type} ${t.count}`).join(' · ')}</div>
                )}
              </Drawer>
            )}
            {hasSources && (
              <Drawer label="SOURCES" open={drawer === 'sources'} onToggle={() => toggleDrawer('sources')}>
                <ul className="sm-sources-list">
                  {thread.allSources.slice(0, 20).map((s) => <li key={s}>{s}</li>)}
                </ul>
              </Drawer>
            )}
          </div>
        )}

        <div className="sm-stage" ref={stageRef}>
          <StoryMap shading={shading} linkArcs={linkArcs} storyFocusIso3={mapFocusIso3} height={stageHeight} />

          <div className="sm-slidecard">
            <div className="sm-slidenav" role="tablist" aria-label="Story slides">
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
                {activeSlide?.key === 'brief' && (
                  <BriefSlide
                    thread={thread} analysis={analysis} displayTitle={displayTitle} category={category} catColors={catColors}
                    forecast={forecast} hasChapters={chapters.length > 0} hasWatch={deadlines.length > 0} linkNote={linkNote}
                    onJumpTimeline={() => chapters[0] && jumpToChapterKey(chapters[0].key)}
                    onJumpOutlook={() => jumpToChapterKey('watch')}
                  />
                )}
                {activeChapter && <ChapterSlide chapter={activeChapter} index={chapters.indexOf(activeChapter)} />}
                {activeSlide?.key === 'fedinto' && <FedIntoSlide fedInto={fedInto} />}
                {activeSlide?.key === 'watch' && <WatchSlide deadlines={deadlines} />}
              </div>
            </div>
            <div className="sm-slidefade" aria-hidden="true" />
          </div>
        </div>
      </div>

      <Scrubber
        days={scrubberDays} chapters={chapters} deadlines={deadlines} inflectionDate={inflectionDate}
        activeKey={activeSlide?.key} onJumpToChapter={jumpToChapterKey} onJumpToDate={jumpToDate}
      />
    </div>
  );
}
