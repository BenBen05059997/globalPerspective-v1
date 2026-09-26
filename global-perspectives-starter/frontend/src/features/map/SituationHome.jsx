import { useMemo, useCallback, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorld, useSituationDetail } from '@/features/map/hooks/useWorld.js';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief.js';
import { useGeminiTopics } from '@/shared/data/useGeminiTopics.js';
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import HudStatusLine from '@/features/map/components/HudStatusLine.jsx';
import HudBriefPanel from '@/features/map/components/HudBriefPanel.jsx';
import HudSensorPanel from '@/features/map/components/HudSensorPanel.jsx';
import HudIntelFeed from '@/features/map/components/HudIntelFeed.jsx';
import RadarMap from '@/features/map/components/RadarMap.jsx';
import { iso3Name, buildLede, TIER_LABEL } from '@/features/map/lib/situationLabels.js';
import { pausedSince, freshnessState, olderLabel } from '@/shared/lib/freshness.js';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';
import { storiesForShading } from '@/features/map/lib/storyShading.js';
import { defaultMapView, normalizeStoredView } from '@/features/map/lib/globeSpin.js';
import { usePeek } from '@/shared/hooks/usePeek.js';
import { peekData } from '@/shared/lib/peekData.js';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import StoryCard from '@/features/map/components/StoryCard.jsx';
import OrientationBanner from '@/features/map/components/OrientationBanner.jsx';
import '@/features/map/SituationHome.css';

// deck.gl is heavy — code-split so it loads only on this route.
const SituationMap3D = lazy(() => import('@/features/map/components/SituationMap3D.jsx'));

function canUse3D() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
const USE_3D = typeof window !== 'undefined' && canUse3D();

const STATE_LABEL = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing', closed: 'Ended' };
const AXIS_LABEL = { conflict: 'Conflict', political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian' };
const AXES = ['conflict', 'political', 'economic', 'humanitarian'];
const TIER_WEIGHT = { high: 3, elevated: 2, moderate: 1, low: 0 };
const TIER_HINT = { high: 'read this first', elevated: 'worth watching today', moderate: 'developing', low: 'on the record' };
const TOUR_MAX = 6;

function fmtAgo(iso) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}
function fmtIn(iso) {
  if (!iso) return '';
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'shortly';
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.floor(mins / 60)}h`;
}
function fmtSince(iso) {
  const d = new Date(iso); const days = (Date.now() - d.getTime()) / 86400000;
  if (days < 1) return 'earlier today';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Structured metrics for the detail panel. VS-PRIOR / outlet count are carried inside the
// tracker's `what_changed` string today ("5 outlets · coverage 1.67× prior"); parse them here
// so the metric row works now, and prefer the structured evidence fields when present.
function metricsFor(selected, ev) {
  const wc = selected?.what_changed || '';
  const outlets = ev.outlets ?? (wc.match(/(\d+)\s+outlets?/)?.[1] != null ? Number(wc.match(/(\d+)\s+outlets?/)[1]) : null);
  const spread = (selected?.iso3_affected?.length) || (ev.spread_new_iso3?.length) || null;
  let ratio = ev.coverage_ratio ?? null;
  if (ratio == null) { const m = wc.match(/coverage\s+([\d.]+)\s*[×x]/i); if (m) ratio = Number(m[1]); }
  return { outlets, spread, ratio };
}

export default function SituationHome() {
  const { world, situations, loading, error, asOf, stale } = useWorld();
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const storyParam = params.get('story');
  const { detail } = useSituationDetail(focus);

  // ?focus= (a situation) and ?story= (a topic) are mutually exclusive selections (M5a spec).
  const select = useCallback((id) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) { n.set('focus', id); n.delete('story'); } else { n.delete('focus'); }
      return n;
    }, { replace: true });
  }, [setParams]);

  const selectStory = useCallback((topic) => {
    const id = topic?.threadId || topic?.topicId || null;
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) { n.set('story', id); n.delete('focus'); } else { n.delete('story'); }
      return n;
    }, { replace: true });
  }, [setParams]);

  const open = useMemo(() => situations.filter((s) => s.state !== 'closed' && s.centroid), [situations]);
  const ranked = useMemo(() => {
    return [...open].sort((a, b) => {
      const t = (TIER_WEIGHT[b.tier] || 0) - (TIER_WEIGHT[a.tier] || 0);
      if (t) return t;
      if (!!b.escalating !== !!a.escalating) return b.escalating ? 1 : -1;
      return new Date(b.last_change_at || 0) - new Date(a.last_change_at || 0);
    });
  }, [open]);
  const hero = ranked[0] || null;

  // "Since you last looked" — compare each situation's opened_at against the last visit stamp
  // (this browser only). v1 is new-only; "escalated since your visit" needs a tier_changed_at
  // field the bundle doesn't carry yet (design 3f). Stamp THIS visit on mount.
  const [lastSeen] = useState(() => { try { return localStorage.getItem('gp_map_last_seen'); } catch { return null; } });
  useEffect(() => { try { localStorage.setItem('gp_map_last_seen', new Date().toISOString()); } catch { /* storage blocked */ } }, []);
  const newIds = useMemo(() => {
    if (!lastSeen) return null;
    const cut = new Date(lastSeen).getTime(); const s = new Set();
    for (const x of open) if (x.opened_at && new Date(x.opened_at).getTime() > cut) s.add(x.id);
    return s.size ? s : null;
  }, [open, lastSeen]);
  const newCount = newIds ? newIds.size : 0;

  // Guided tour: manual stepper, NO autoplay (design 3b). Advancing flies the camera (never
  // writes the URL); the rail highlights the current stop.
  const tourN = Math.min(ranked.length, TOUR_MAX);
  const [tourOn, setTourOn] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const tourStop = tourOn && ranked.length ? ranked[Math.min(tourIdx, tourN - 1)] : null;
  const startTour = () => { setTourIdx(0); setTourOn(true); };
  const stopTour = () => setTourOn(false);
  const tourNext = () => setTourIdx((i) => (i + 1) % tourN);
  const tourPrev = () => setTourIdx((i) => (i - 1 + tourN) % tourN);
  const userSelect = useCallback((id) => { setTourOn(false); select(id); }, [select]);
  const userSelectStory = useCallback((topic) => { setTourOn(false); selectStory(topic); }, [selectStory]);
  useEffect(() => { const onKey = (e) => { if (e.key === 'Escape' && tourOn) setTourOn(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [tourOn]);

  // M5a — stories (current topics feed) reused as-is from the existing public hook; no re-fetch.
  const { topics, updatedAt: topicsUpdatedAt, generatedDate: topicsGeneratedDate } = useGeminiTopics();
  const topicsAsOf = topicsUpdatedAt || topicsGeneratedDate || null;
  const topicsAgeDays = topicsAsOf ? (Date.now() - new Date(topicsAsOf).getTime()) / 86400000 : null;
  const topicsFreshness = topicsAgeDays != null ? freshnessState(topicsAgeDays) : null;
  const shading = useMemo(() => storiesForShading(topics, situations), [topics, situations]);
  const visibleShading = useMemo(
    () => (topicsFreshness === 'hidden' ? [] : shading.map((e) => ({ ...e, dim: topicsFreshness === 'older' }))),
    [shading, topicsFreshness]
  );
  const selectedStory = useMemo(() => {
    if (!storyParam) return null;
    return topics.find((t) => (t.threadId || t.topicId) === storyParam) || null;
  }, [topics, storyParam]);
  const storyFocusId = selectedStory ? (selectedStory.threadId || selectedStory.topicId) : null;
  const storyFocusIso3 = selectedStory && Array.isArray(selectedStory.iso3) ? selectedStory.iso3[0] : null;

  // One shared hover/focus preview instance for the map's shaded countries (feed rows carry their
  // own — see HudIntelFeed). Story selection from a shaded country reuses userSelectStory above.
  const mapPeek = usePeek();
  const shadingByIso3 = useMemo(() => new Map(visibleShading.map((e) => [e.iso3, e])), [visibleShading]);
  const hoveredCountry = mapPeek.openId ? shadingByIso3.get(mapPeek.openId) : null;
  const selectStoryByCountry = useCallback((iso3) => {
    const entry = shadingByIso3.get(iso3);
    if (entry?.top) userSelectStory(entry.top);
  }, [shadingByIso3, userSelectStory]);

  const counts = useMemo(() => {
    const c = { conflict: 0, political: 0, economic: 0, humanitarian: 0 };
    for (const s of open) if (c[s.axis] != null) c[s.axis]++;
    return c;
  }, [open]);
  const newsAxesEmpty = counts.conflict + counts.political + counts.economic === 0;
  const ledeBase = useMemo(() => buildLede(open, hero), [open, hero]);
  const lede = newCount && lastSeen ? `${ledeBase} · ${newCount} new since ${fmtSince(lastSeen)}` : ledeBase;

  // Honesty status line + sensor panel (M2). newestAnalysisAt is reused from the /daily page's
  // own "find the latest published edition" lookup — useDailyBrief() with no dateKey defaults to
  // today and searches backward through real DAILY_BRIEF# records (hooks/useDailyBrief.js); its
  // `generatedAt` is the same field DailyPage.jsx shows as "Generated Xh ago". No new endpoint.
  const { brief: latestBrief, loading: briefLoading, error: briefError } = useDailyBrief();
  // searched = the lookup finished without an error; then "nothing found" is itself a fact
  // (no brief in the lookback window) and must be shown, not hidden.
  const paused = useMemo(() => pausedSince({
    newestAnalysisAt: latestBrief?.generatedAt,
    searched: !briefLoading && !briefError,
    lookbackDays: MAX_LOOKBACK_DAYS,
  }), [latestBrief, briefLoading, briefError]);
  const tierCounts = useMemo(() => {
    const c = { high: 0, elevated: 0, moderate: 0, low: 0 };
    for (const s of open) if (c[s.tier] != null) c[s.tier]++;
    return c;
  }, [open]);
  // "News situations" = anything not sourced straight from GDACS (today that's everything with
  // an axis of conflict/political/economic, plus any non-GDACS humanitarian situation).
  const newsSituationCount = useMemo(() => open.filter((s) => s.source !== 'gdacs').length, [open]);
  const sensorRows = useMemo(() => {
    if (!world) return [];
    const rows = [];
    if (world.sources?.gdacs) {
      rows.push({ key: 'gdacs', name: 'Disaster alerts (GDACS)', ok: true, text: `live · checked ${fmtAgo(world.sources.gdacs)}` });
    }
    if (world.sources?.news) {
      const checked = fmtAgo(world.sources.news);
      const text = newsSituationCount > 0
        ? `checked ${checked}`
        : (paused ? `checked ${checked} · 0 new stories · ${paused.text}` : `checked ${checked} · 0 new stories`);
      rows.push({ key: 'news', name: 'News desk', ok: newsSituationCount > 0, text });
    }
    if (world.generated_at) {
      rows.push({ key: 'map', name: 'Map file', ok: true, text: `updated ${fmtAgo(world.generated_at)} · next ${fmtIn(world.next_expected_at)}` });
    }
    return rows;
  }, [world, newsSituationCount, paused]);

  const selected = useMemo(() => situations.find((s) => s.id === focus) || null, [situations, focus]);
  const focusMissing = focus && !selected;              // deep link to an expired/archived situation
  const ev = detail?.evidence || {};
  const isGdacs = selected?.source === 'gdacs';
  const m = selected ? metricsFor(selected, ev) : null;
  const affected = selected?.iso3_affected?.length ? selected.iso3_affected : [];

  // What the map focuses (fly + highlight) and what card it shows.
  const focusId = focus || tourStop?.id || null;
  const callout = focus ? null : (tourStop || hero);
  const tourProps = tourOn ? { index: Math.min(tourIdx, tourN - 1), total: tourN, onPrev: tourPrev, onNext: tourNext, onStop: stopTour } : null;

  // M4: the console has two modes, GLOBE and RADAR — the old deck.gl "flat" mode is gone (radar,
  // drawn with SVG/canvas, replaces it as both the phone default and the no-WebGL fallback: see
  // RadarMap.jsx and globeSpin.defaultMapView). Desktop opens on the spinning globe when WebGL
  // works; phones and no-WebGL devices open on radar. A stored prior choice (this browser only)
  // always wins over the computed default; a pre-M4 stored 'flat' migrates to 'radar'.
  const [view, setViewMode] = useState(() => {
    try {
      const norm = normalizeStoredView(localStorage.getItem('gp_map_view'));
      if (norm) return norm;
    } catch { /* storage blocked */ }
    return defaultMapView(typeof window !== 'undefined' ? window.innerWidth : 0, USE_3D);
  });
  const setView = (v) => { setViewMode(v); try { localStorage.setItem('gp_map_view', v); } catch { /* storage blocked */ } };
  const showGlobe = USE_3D && view === 'globe';

  // Radar's "◉ scanned" mark on the feed (M4): fired by RadarMap's sweep, cleared a few seconds
  // later. Never scrolls the feed or moves focus — it only toggles a class on an existing row.
  const [scannedIds, setScannedIds] = useState(() => new Set());
  const scanTimers = useRef(new Map());
  const markScanned = useCallback((id) => {
    setScannedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    const timers = scanTimers.current;
    if (timers.has(id)) clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
      setScannedIds((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
      timers.delete(id);
    }, 3000));
  }, []);
  useEffect(() => { const timers = scanTimers.current; return () => { for (const t of timers.values()) clearTimeout(t); }; }, []);

  // L2: the "Key" legend is collapsed by default and remembered per viewer (this browser only) —
  // it used to render as an always-visible block over the map's bottom-left corner.
  const [legendOpen, setLegendOpen] = useState(() => {
    try { return localStorage.getItem('gp_map_legend_open') === '1'; } catch { return false; }
  });
  const setLegendPersist = useCallback((next) => {
    setLegendOpen(next);
    try { localStorage.setItem('gp_map_legend_open', next ? '1' : '0'); } catch { /* storage blocked */ }
  }, []);
  const [mapH, setMapH] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 900 ? Math.round(window.innerHeight * 0.6) : 620));
  useEffect(() => {
    const onResize = () => setMapH(window.innerWidth <= 900 ? Math.round(window.innerHeight * 0.6) : 620);
    window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className={`sh-root gp-console${stale ? ' sh-stale' : ''}`}>
      <header className="sh-bar">
        <div>
          <div className="sh-lede">{error && !world ? 'The situation feed is unavailable right now.' : (world ? lede : 'Loading the world…')}</div>
          <div className="sh-sub">Global news intelligence, scored and mapped.{world?.next_expected_at ? ` Next update ${fmtIn(world.next_expected_at)}.` : ''}</div>
        </div>
        <div className="sh-live">
          <span className={`sh-dot${stale ? ' sh-dot-stale' : ''}`} />
          {stale ? 'Data delayed' : 'updated'} {asOf ? fmtAgo(asOf) : ''}
          {world?.next_expected_at && !stale ? <span className="sh-next"> · next {fmtIn(world.next_expected_at)}</span> : null}
        </div>
      </header>

      <OrientationBanner />

      <HudStatusLine paused={paused} />

      {stale ? <div className="sh-banner">The situation feed hasn’t updated recently — showing the last known state.</div> : null}

      {/* M6: brief + sensor status moved out of the map's top corners into a slim row above it —
          they used to overlay the globe/callout and crowd its left edge. */}
      {world || sensorRows.length ? (
        <div className="sh-hud-row">
          {world ? <HudBriefPanel counts={tierCounts} /> : null}
          {sensorRows.length ? <HudSensorPanel rows={sensorRows} /> : null}
        </div>
      ) : null}

      <div className="sh-stage">
        <div className="sh-mapwrap">
          <div className="sh-mapinner">
            {showGlobe ? (
              <Suspense fallback={<div className="sh-maploading" style={{ height: mapH }}>Loading map…</div>}>
                <SituationMap3D
                  situations={situations} focusId={focusId} callout={callout} tour={tourProps} newIds={newIds} view="globe"
                  onSelect={userSelect} onOpenCallout={userSelect} height={mapH}
                  shading={visibleShading} storyFocusIso3={storyFocusIso3}
                  onSelectCountry={selectStoryByCountry}
                  onHoverCountry={(iso3, anchor) => mapPeek.openOnHover(iso3, anchor)}
                  onFocusCountry={(iso3, anchor) => mapPeek.openOnFocus(iso3, anchor)}
                  onLeaveCountry={() => mapPeek.close()}
                />
              </Suspense>
            ) : (
              <RadarMap
                situations={situations} focusId={focusId} callout={callout} newIds={newIds}
                onSelect={userSelect} onOpenCallout={userSelect} onScan={markScanned} height={mapH}
                shading={visibleShading} storyFocusIso3={storyFocusIso3}
                onSelectCountry={selectStoryByCountry}
                onHoverCountry={(iso3, anchor) => mapPeek.openOnHover(iso3, anchor)}
                onFocusCountry={(iso3, anchor) => mapPeek.openOnFocus(iso3, anchor)}
                onLeaveCountry={() => mapPeek.close()}
              />
            )}
            {hoveredCountry ? (
              <StoryPeek
                id={`peek-country-${hoveredCountry.iso3}`}
                data={peekData(hoveredCountry.top, { asOf: topicsAsOf })}
                style={mapPeek.style}
              />
            ) : null}

            <div className="sh-controls">
              {ranked.length >= 2 && !tourOn ? (
                <button className="sh-ctl" onClick={startTour} title="Fly through today’s top situations">Walk me through today</button>
              ) : null}
              {USE_3D ? (
                <div className="sh-viewswitch" role="group" aria-label="Map mode">
                  <button className={`sh-ctl sh-seg${view === 'globe' ? ' sh-seg-on' : ''}`} aria-pressed={view === 'globe'} onClick={() => setView('globe')}>Globe</button>
                  <button className={`sh-ctl sh-seg${view === 'radar' ? ' sh-seg-on' : ''}`} aria-pressed={view === 'radar'} onClick={() => setView('radar')}>Radar</button>
                </div>
              ) : null}
              <button className="sh-ctl sh-key" onClick={() => setLegendPersist(!legendOpen)} aria-expanded={legendOpen}>
                {AXES.map((a) => <span key={a} className="sh-key-dot" style={{ background: AXIS_HUE[a] }} />)} Key
              </button>
            </div>

            {open.length === 0 && world ? (
              <div className="sh-quiet">Quiet day — no situations open right now.</div>
            ) : null}

            {legendOpen ? (
              <div className="sh-legend sh-legend-open" aria-label="How to read the map">
                <button className="sh-legend-close" onClick={() => setLegendPersist(false)} aria-label="Close">×</button>
                <div className="sh-legrow">
                  <b>Colour = crisis type</b>
                  {AXES.map((a) => (
                    <span key={a} className={`sh-leg${counts[a] ? '' : ' sh-leg-off'}`}>
                      <span className="sh-leg-dot" style={{ background: AXIS_HUE[a] }} />{AXIS_LABEL[a]}
                    </span>
                  ))}
                  {visibleShading.length ? (
                    <span className="sh-leg"><span className="sh-leg-dot" style={{ background: '#9aa4b2' }} />No crisis claim</span>
                  ) : null}
                </div>
                <div className="sh-legrow">
                  <b>Brightness + size = how serious</b>
                  {['low', 'moderate', 'elevated', 'high'].map((t) => {
                    const has = ranked.some((s) => s.tier === t);
                    return (
                      <span key={t} className={`sh-leg${has ? '' : ' sh-leg-off'}`}>
                        <span className={`sh-leg-pin sh-pin-${t}`} />{TIER_LABEL[t]}
                        <i>{t === 'high' && !has ? 'none today' : TIER_HINT[t]}</i>
                      </span>
                    );
                  })}
                  <span className="sh-leg"><i>white ring = high · brighter outline = selected</i></span>
                  <span className="sh-leg"><span className="sh-leg-esc">▲</span>escalating<i>worse in the last few hours</i></span>
                </div>
                <div className="sh-legrow">
                  <b>Motion</b>
                  <span className="sh-leg"><i>soft pulse = new or escalating in the last 24h (up to 8 shown)</i></span>
                </div>
                {visibleShading.length ? (
                  <div className="sh-legrow">
                    <b>Country wash = a story with no exact place</b>
                    <span className="sh-leg"><i>count badge = more than one story</i></span>
                    {topicsFreshness === 'older' && topicsAsOf ? (
                      <span className="sh-leg"><i>{olderLabel(topicsAsOf) || 'older'}</i></span>
                    ) : null}
                  </div>
                ) : null}
                <div className="sh-legrow">
                  <b>Freshness (stories)</b>
                  <span className="sh-leg"><i>live &lt;24h glows · 1–7d plain · 7–30d faded + “older · date” · 30d+ hidden</i></span>
                </div>
                <div className="sh-legrow">
                  <b>Disaster alerts</b>
                  <span className="sh-leg"><i>GDACS shows its own alert level as text (e.g. “ORANGE ALERT”) — colour still means crisis type, not the alert colour</i></span>
                </div>
              </div>
            ) : null}
          </div>
          {world && newsAxesEmpty ? (
            <p className="sh-coverage">Tracking severe natural disasters (UN/EU GDACS). Conflict, political and economic situations arrive with the news layer.</p>
          ) : null}
        </div>

        <aside className="sh-rail" aria-live="polite">
          {focusMissing ? (
            <div className="sh-detail sh-gone">
              <button className="sh-back" onClick={() => userSelect(null)}>← All situations{ranked.length ? ` (${ranked.length})` : ''}</button>
              <p className="sh-muted" style={{ padding: '16px 15px' }}>That situation is no longer being tracked — it may have closed since the link was shared. Browse the active situations instead.</p>
            </div>
          ) : selected ? (
            <div className="sh-detail">
              <button className="sh-back" onClick={() => userSelect(null)}>← All situations{ranked.length ? ` (${ranked.length})` : ''}</button>
              <div className="sh-detail-head">
                <span className="sh-meta-row">
                  <span className={`sh-badge sh-badge-${selected.tier}`}>{TIER_LABEL[selected.tier] || selected.tier}</span>
                  <span className="sh-axis" style={{ color: AXIS_HUE[selected.axis] }}>{AXIS_LABEL[selected.axis] || selected.axis}</span>
                  <span className="sh-statelbl">{STATE_LABEL[selected.state] || selected.state}</span>
                  {isGdacs ? <span className="sh-prov">UN/EU GDACS</span>
                    : (selected.escalating ? <span className="sh-esc">▲ escalating</span> : null)}
                </span>
                <h2 className="sh-detail-title">{selected.verb_label}</h2>
                <div className="sh-substamp">
                  {isGdacs && ev.gdacs_severity_text ? <span>{ev.gdacs_severity_text}</span> : (selected.what_changed ? <span>{selected.what_changed}</span> : null)}
                  <span className="sh-dim"> · first seen {fmtAgo(selected.opened_at)} · updated {fmtAgo(selected.last_change_at)}</span>
                </div>
              </div>

              {affected.length ? (
                <div className="sh-affected">
                  <span className="sh-lbl">Affected</span>
                  <span className="sh-chips">{affected.slice(0, 5).map((c) => <span key={c} className="sh-country">{iso3Name(c)}</span>)}
                    {affected.length > 5 ? <span className="sh-country sh-more">+{affected.length - 5}</span> : null}</span>
                </div>
              ) : null}

              {isGdacs ? (
                <>
                  <dl className="sh-metrics">
                    <div><dt>Alert level</dt><dd className="sh-alert">{gdacsLevelBadge(selected, ev) || ev.gdacs_level || '—'}</dd></div>
                    <div><dt>Severity</dt><dd>{ev.gdacs_severity_text ? ev.gdacs_severity_text.replace(/\s*\(.*\)$/, '') : '—'}</dd></div>
                    <div><dt>Type</dt><dd>{ev.category || selected.axis}</dd></div>
                  </dl>
                  <div className="sh-official">
                    <span className="sh-lbl">Official source</span>
                    {ev.gdacs_report_url
                      ? <a className="sh-report" href={ev.gdacs_report_url} target="_blank" rel="noreferrer">Official UN/EU GDACS report →</a>
                      : <span className="sh-report">UN/EU GDACS</span>}
                    <span className="sh-dim">Global Disaster Alert and Coordination System</span>
                  </div>
                  <p className="sh-note">This alert is passed through from the GDACS feed unchanged. The tier comes from the reported hazard values, not from coverage — no AI analysis is generated at this level.</p>
                </>
              ) : (
                <>
                  <dl className="sh-metrics">
                    <div><dt>Outlets</dt><dd>{m.outlets ?? '—'}</dd></div>
                    <div><dt>Spread</dt><dd>{m.spread != null ? `${m.spread} ${m.spread === 1 ? 'country' : 'countries'}` : '—'}</dd></div>
                    <div><dt>vs prior</dt><dd className={m.ratio && m.ratio >= 1.5 ? 'sh-hot' : ''}>{m.ratio ? `${m.ratio}×` : 'new'}</dd></div>
                  </dl>
                  {ev.headlines?.length ? (
                    <div className="sh-evidence">
                      <span className="sh-lbl">Evidence <i>{ev.headlines.length} shown</i></span>
                      <ul className="sh-heads">
                        {ev.headlines.slice(0, 6).map((h) => (
                          <li key={h.url}><a href={h.url} target="_blank" rel="noreferrer">{h.title}</a><span className="sh-src">{h.domain}</span></li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="sh-consolidating">Coverage is still consolidating; {m.outlets ?? 'few'} source{m.outlets === 1 ? '' : 's'} so far. Rechecked on the next cycle. The tier will move on its own if the count or the spread changes.</p>
                  )}
                </>
              )}

              {(selected.threadId || (isGdacs && ev.gdacs_report_url)) && (
                <div className="sh-detail-foot">
                  {selected.threadId
                    ? <Link to={`/weekly/thread/${encodeURIComponent(selected.threadId)}`}>Full analysis →</Link>
                    : <a href={ev.gdacs_report_url} target="_blank" rel="noreferrer">Official UN/EU GDACS report →</a>}
                </div>
              )}
            </div>
          ) : selectedStory ? (
            <StoryCard
              topic={selectedStory} asOf={topicsAsOf} activeCount={ranked.length}
              onBack={() => userSelectStory(null)}
            />
          ) : (
            <HudIntelFeed
              ranked={ranked} focusId={focusId} newIds={newIds} scannedIds={scannedIds} loading={loading} error={error} world={world}
              onSelect={userSelect}
              topics={topics} topicsAsOf={topicsAsOf} storyFocusId={storyFocusId}
              onSelectStory={userSelectStory} peek={mapPeek}
            />
          )}
        </aside>
      </div>

      {/* Mobile peek row — the top situation as the mobile lede+hero; tap opens detail. */}
      {hero && !focus ? (
        <button className="sh-peek" onClick={() => userSelect(hero.id)}>
          <span className={`sh-leg-pin sh-pin-${hero.tier}`} style={{ '--pin': AXIS_HUE[hero.axis] || '#9aa4b2' }} />
          <span className="sh-peek-main">
            <span className="sh-peek-tags"><span className={`sh-tierlbl sh-tierlbl-${hero.tier}`}>{TIER_LABEL[hero.tier]}</span>{hero.escalating ? <span className="sh-esc-sm">▲</span> : null}</span>
            <span className="sh-peek-title">{hero.verb_label}</span>
          </span>
          <span className="sh-peek-open">Open →</span>
        </button>
      ) : null}

      <section className="sh-fold">
        <div className="sh-fold-method">
          <h2>How we read the world</h2>
          <p className="sh-dim">The map is the output of a fixed pipeline, not an editor’s judgement call.</p>
          <div className="sh-fold-cols">
            <div><h4>What we track</h4><p>Every situation belongs to one of four axes — conflict, political, economic, humanitarian. A situation opens when independent outlets converge on the same event in the same place, and it stays open while coverage continues. Severe natural disasters come straight from the UN/EU GDACS feed.</p></div>
            <div><h4>How severity is scored</h4><p>The tier — low, moderate, elevated, high — is derived from how many outlets are covering a situation, how far it has spread, and how fast that is changing since the last run. Disaster tiers come from the reported hazard values. The inputs are shown on every situation.</p></div>
            <div><h4>How often it updates</h4><p>The feed is re-scored on a fixed cycle. The stamp in the header shows the age of the data you are looking at, not the age of the page. A situation marked escalating has moved up since the last run.</p></div>
          </div>
        </div>

        <div className="sh-fold-teasers">
          <h4 className="sh-lbl">Elsewhere on Global Perspectives</h4>
          <div className="sh-teasers">
            <Link to="/daily"><b>Daily Brief</b><span>The day’s developments, gathered and summarised each morning.</span></Link>
            <Link to="/weekly-brief"><b>Weekly</b><span>One long synthesis each week, with the reasoning shown.</span></Link>
            <Link to="/track-record"><b>Track Record</b><span>Every forecast scored against what happened, including the misses.</span></Link>
            <Link to="/analyze"><b>Analysis Studio</b><span>Bring a question and get a cited, structured analysis.</span></Link>
          </div>
        </div>

        {ranked.length ? (
          <div className="sh-fold-index">
            <h4 className="sh-lbl">Active situations · {ranked.length} open</h4>
            {AXES.map((a) => {
              const items = ranked.filter((s) => s.axis === a);
              if (!items.length) return null;
              return (
                <div key={a} className="sh-idx-group">
                  <h5><span className="sh-leg-dot" style={{ background: AXIS_HUE[a] }} />{AXIS_LABEL[a]} · {items.length}</h5>
                  <ul>
                    {items.map((s) => (
                      <li key={s.id}>
                        <button className="sh-idx-link" onClick={() => userSelect(s.id)}>{s.verb_label}</button>
                        <span className="sh-dim"> — {TIER_LABEL[s.tier]}{s.escalating ? ' · escalating' : ''}{affectedNames(s)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function affectedNames(s) {
  const codes = (s.iso3_affected || []).slice(0, 3);
  return codes.length ? ` · ${codes.map(iso3Name).join(', ')}` : '';
}
