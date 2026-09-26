import { useMemo, useCallback, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorld, useSituationDetail } from '@/features/map/hooks/useWorld.js';
import { useDailyBrief, MAX_LOOKBACK_DAYS } from '@/features/daily/hooks/useDailyBrief.js';
import { useWeeklyBrief } from '@/features/weekly-brief/hooks/useWeeklyBrief.js';
import { useGeminiTopics } from '@/shared/data/useGeminiTopics.js';
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import HudStatusLine from '@/features/map/components/HudStatusLine.jsx';
import HudBriefPanel from '@/features/map/components/HudBriefPanel.jsx';
import HudSensorPanel from '@/features/map/components/HudSensorPanel.jsx';
import HudIntelFeed from '@/features/map/components/HudIntelFeed.jsx';
import HudCompactLine from '@/features/map/components/HudCompactLine.jsx';
import MapPhoneTabs from '@/features/map/components/MapPhoneTabs.jsx';
import BottomSheet from '@/features/map/components/BottomSheet.jsx';
import { useIsPhone, PHONE_BREAKPOINT } from '@/shared/hooks/useIsPhone.js';
import { hudCompactSummary } from '@/features/map/lib/hudCompact.js';
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
import AlertStack from '@/features/map/components/AlertStack.jsx';
import MapLegend from '@/features/map/components/MapLegend.jsx';
import MapAbout from '@/features/map/components/MapAbout.jsx';
import { alertStackItems, alertEmptyText, alertStackNote } from '@/features/map/lib/alertStack.js';
import { markerKind, statusGlyph, situationFreshness } from '@/features/map/lib/legend.js';
import { threadPath } from '@/shared/lib/threadPath';
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
const TOUR_MAX = 6;
const GDACS_FRESH_MS = 2 * 60 * 60 * 1000;

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
function fmtShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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

// SituationDetail — the situation half of the rail (M2–M6), factored out in M7 so the exact same
// markup can render inside the phone bottom sheet (showBack=false there — the sheet's own
// Collapse/Close buttons replace the "back" affordance) without duplicating it.
function SituationDetail({ selected, ev, isGdacs, m, affected, activeCount = 0, onBack, showBack = true }) {
  return (
    <div className="sh-detail">
      {showBack ? (
        <button className="sh-back" onClick={onBack}>← All situations{activeCount ? ` (${activeCount})` : ''}</button>
      ) : null}
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
            {(gdacsLevelBadge(selected, ev) || ev.gdacs_level) ? <div><dt>Alert level</dt><dd className="sh-alert">{gdacsLevelBadge(selected, ev) || ev.gdacs_level}</dd></div> : null}
            {ev.gdacs_severity_text ? <div><dt>Severity</dt><dd>{ev.gdacs_severity_text.replace(/\s*\(.*\)$/, '')}</dd></div> : null}
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
            {m.outlets != null ? <div><dt>Outlets</dt><dd>{m.outlets}</dd></div> : null}
            {m.spread != null ? <div><dt>Spread</dt><dd>{`${m.spread} ${m.spread === 1 ? 'country' : 'countries'}`}</dd></div> : null}
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
  );
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

  // R4a: brightness = freshness — a situation not updated in 30+ days is hidden from the map and
  // every list that mirrors it, and counted instead (alertStack.hiddenCount), never dropped silently.
  const open = useMemo(
    () => situations.filter((s) => s.state !== 'closed' && s.centroid && situationFreshness(s) !== 'hidden'),
    [situations],
  );
  const alertStack = useMemo(() => alertStackItems(situations), [situations]);
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

  // F4 (review R2): the "Elsewhere" teasers below used to claim a fixed cadence ("summarised each
  // morning", "each week") regardless of whether the pipeline is actually running. Show the real
  // latest-edition date (computed, never typed) and a paused note when applicable instead.
  const { brief: latestWeeklyBrief } = useWeeklyBrief();
  const latestDailyEditionLabel = fmtShortDate(latestBrief?.generatedAt);
  const latestWeeklyEditionLabel = latestWeeklyBrief?.weekOf ? fmtShortDate(latestWeeklyBrief.weekOf + 'T00:00:00Z') : null;

  // F4 (review R2): "the map is quiet" used to show even while GDACS is live and only the news
  // layer is paused — say precisely what's true instead (no disaster alerts open, news paused
  // since a computed date) rather than the blanket "quiet" claim.
  const emptyLede = useMemo(() => (paused ? alertEmptyText(paused) : null), [paused]);
  const ledeBase = useMemo(() => buildLede(open, hero, emptyLede), [open, hero, emptyLede]);
  const lede = newCount && lastSeen ? `${ledeBase} · ${newCount} new since ${fmtSince(lastSeen)}` : ledeBase;

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

  // F2.19: "DISASTER ALERTS LIVE" only when the world file's GDACS source was actually checked
  // recently (< 2h) — never a standing claim independent of the data.
  const gdacsFresh = useMemo(() => {
    const ts = world?.sources?.gdacs;
    if (!ts) return false;
    const age = Date.now() - new Date(ts).getTime();
    return Number.isFinite(age) && age >= 0 && age < GDACS_FRESH_MS;
  }, [world]);

  const selected = useMemo(() => situations.find((s) => s.id === focus) || null, [situations, focus]);
  const focusMissing = focus && !selected;              // deep link to an expired/archived situation
  const ev = detail?.evidence || {};
  const isGdacs = selected?.source === 'gdacs';
  const m = selected ? metricsFor(selected, ev) : null;
  const affected = selected?.iso3_affected?.length ? selected.iso3_affected : [];

  // F2.12: a single, one-line polite live region for selection changes — replaces the old
  // aria-live="polite" on the whole rail, which used to read out the entire ~1,400-char detail
  // panel on every selection.
  const [announcement, setAnnouncement] = useState('');
  const hadSelectionRef = useRef(false);
  useEffect(() => {
    const title = selected ? selected.verb_label : (selectedStory ? selectedStory.title : null);
    if (title) {
      setAnnouncement(`Selected: ${title}`);
      hadSelectionRef.current = true;
    } else if (hadSelectionRef.current) {
      setAnnouncement('Selection cleared');
      hadSelectionRef.current = false;
    }
  }, [selected, selectedStory]);

  // What the map focuses (fly + highlight) and what card it shows.
  const focusId = focus || tourStop?.id || null;
  // R4a: the lead situation now lives in the brief panel, so the map's anchored callout only
  // shows the current guided-tour stop (see consoleCallout below).
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
  // F2.14: Esc closes the Key legend and returns focus to the button that opened it.
  const legendBtnRef = useRef(null);
  useEffect(() => {
    if (!legendOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setLegendPersist(false);
        legendBtnRef.current?.focus?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [legendOpen, setLegendPersist]);
  // F2.5: one breakpoint rule everywhere (useIsPhone's PHONE_BREAKPOINT, `< 900`) — this used to
  // switch at `<= 900` while useIsPhone and the CSS switched at `< 900` (i.e. `max-width: 900px`),
  // so at exactly 900px this panel sized itself for phone while the phone tab bar/CSS still
  // thought it was desktop, and neither nav rendered.
  const [phoneMapH, setPhoneMapH] = useState(() => (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.6) : 500));
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < PHONE_BREAKPOINT) setPhoneMapH(Math.round(window.innerHeight * 0.6)); };
    window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize);
  }, []);
  // R4a desktop console: the map fills the band between the HUD columns, so its size is measured
  // from that band (ResizeObserver) instead of a fixed 620px.
  const bandRef = useRef(null);
  const [band, setBand] = useState(() => ({
    w: typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 740) : 700,
    h: typeof window !== 'undefined' ? Math.max(360, window.innerHeight - 52) : 620,
  }));

  // M7: phone layout (< 900px) — MAP (default) · LIST · ALERTS tabs, one screen at a time (P1).
  // On MAP, a selection opens as a bottom sheet instead of the desktop rail.
  const isPhone = useIsPhone();
  useEffect(() => {
    if (isPhone || !bandRef.current || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) setBand((b) => (b.w === Math.round(r.width) && b.h === Math.round(r.height) ? b : { w: Math.round(r.width), h: Math.round(r.height) }));
    });
    ro.observe(bandRef.current);
    return () => ro.disconnect();
  }, [isPhone]);
  const mapH = isPhone ? phoneMapH : band.h;

  // The honesty status line sits in the console top bar on desktop /map (Layout renders an empty
  // slot there, #gp-console-status); rendered inline when no slot exists (phone, tests).
  const [statusSlot, setStatusSlot] = useState(null);
  useEffect(() => {
    setStatusSlot(isPhone ? null : (typeof document !== 'undefined' ? document.getElementById('gp-console-status') : null));
  }, [isPhone]);

  // "About this map" drawer (desktop): the old below-the-fold content, reachable without a page
  // scroll. Esc closes it and focus returns to the button that opened it.
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutBtnRef = useRef(null);
  const aboutPanelRef = useRef(null);
  useEffect(() => {
    if (!aboutOpen) return undefined;
    aboutPanelRef.current?.focus?.();
    const onKey = (e) => { if (e.key === 'Escape') { setAboutOpen(false); aboutBtnRef.current?.focus?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aboutOpen]);
  const [phoneTab, setPhoneTab] = useState('map');
  const [sheetStop, setSheetStop] = useState('half');
  const [hudExpanded, setHudExpanded] = useState(false);
  const selectionId = focus || storyParam || null;
  const prevSelectionRef = useRef(null);
  useEffect(() => {
    // Selecting anything (from LIST, ALERTS, or the map itself) always lands on the MAP tab with
    // the sheet at half — "list-select → map + half" from the M7 spec.
    if (isPhone && selectionId && selectionId !== prevSelectionRef.current) {
      setPhoneTab('map');
      setSheetStop('half');
    }
    prevSelectionRef.current = selectionId;
  }, [isPhone, selectionId]);
  const closeSelection = useCallback(() => {
    if (focus) userSelect(null);
    else if (storyParam) userSelectStory(null);
  }, [focus, storyParam, userSelect, userSelectStory]);
  const sheetTitle = selected ? selected.verb_label : (selectedStory ? selectedStory.title : null);
  const sheetSubtitle = selected
    ? (AXIS_LABEL[selected.axis] || selected.axis)
    : (selectedStory ? (selectedStory.category || null) : null);
  // F2.3: a stale `?story=` link resolves to no topic (selectedStory stays null) but `selectionId`
  // was still truthy, so the sheet used to open empty. Only open once the selection actually
  // resolves to something the sheet has content for — a live situation, a live story, or the
  // honest "no longer tracked" message for an expired `?focus=`.
  const phoneSheetOpen = isPhone && phoneTab === 'map' && !!(selected || selectedStory || focusMissing);
  const hudSummary = useMemo(() => hudCompactSummary(tierCounts, sensorRows, paused), [tierCounts, sensorRows, paused]);

  // Legend "present" flags: which token items are actually on the map right now (the Key dims the
  // rest with "none now" instead of describing things that aren't drawn).
  const legendPresent = useMemo(() => {
    const kinds = new Set(); const tiers = new Set(); const glyphs = new Set(); const fresh = new Set(); const axes = new Set();
    for (const s of open) {
      kinds.add(markerKind(s)); tiers.add(s.tier); axes.add(s.axis); fresh.add(situationFreshness(s));
      const g = statusGlyph(s); if (g) glyphs.add(g.key);
    }
    let neutral = false;
    if (visibleShading.length) {
      kinds.add('story');
      if (topicsFreshness) fresh.add(topicsFreshness);
      for (const e of visibleShading) { if (e.crisisType === 'neutral') neutral = true; else axes.add(e.crisisType); }
    }
    return { kinds, tiers, glyphs, fresh, axes, neutral };
  }, [open, visibleShading, topicsFreshness]);

  // Situation brief's LEAD line (Console.dc.html): the top-ranked open situation; else the first
  // story in the latest stories feed, labelled as exactly that and dated (never "lead by severity"
  // — the stories feed carries no rank). A story page link when one exists, else select it here.
  const storiesDateLabel = fmtShortDate(topicsAsOf);
  const lead = useMemo(() => {
    if (hero) {
      const place = hero.affected_names?.[0] || (hero.iso3_affected?.[0] ? iso3Name(hero.iso3_affected[0]) : null);
      return {
        kicker: `Lead situation · ${TIER_LABEL[hero.tier] || hero.tier}${place ? ` · ${place}` : ''}`,
        title: hero.verb_label,
        href: hero.threadId ? threadPath(hero.threadId) : null,
        onOpen: hero.threadId ? null : () => userSelect(hero.id),
        openLabel: hero.threadId ? 'open story →' : 'show on map →',
      };
    }
    if (topicsFreshness === 'hidden') return null;
    const t = topics.find((x) => x && x.title);
    if (!t) return null;
    return {
      kicker: `First in the latest stories${storiesDateLabel ? ` · ${storiesDateLabel}` : ''}`,
      title: t.title,
      older: topicsFreshness === 'older',
      href: t.threadId ? threadPath(t.threadId) : null,
      onOpen: t.threadId ? null : () => userSelectStory(t),
      openLabel: 'open story →',
    };
  }, [hero, topics, topicsFreshness, storiesDateLabel, userSelect, userSelectStory]);

  const alertNote = alertStackNote(alertStack.items, paused);
  const alertEmpty = alertEmptyText(paused);
  const coverageNote = world && newsAxesEmpty
    ? 'Tracking severe natural disasters (UN/EU GDACS). Conflict, political and economic situations arrive with the news layer.'
    : null;
  const worldDateLabel = fmtShortDate(world?.generated_at);

  // Map controls: GLOBE | RADAR, Key, and the tour entry. On the phone they float over the map's
  // top-right corner; on the desktop console they sit in the bottom view bar with "About".
  const controls = (
    <>
      {/* F1.9: hide the tour entry point while a selection is active — a situation or story
          already showing its own detail isn't the moment to invite a tour that would fly the
          map away from it. */}
      {ranked.length >= 2 && !tourOn && !focus && !selectedStory ? (
        <button className="sh-ctl" onClick={startTour} title="Fly through today’s top situations">Walk me through today</button>
      ) : null}
      {USE_3D ? (
        <div className="sh-viewswitch" role="group" aria-label="Map mode">
          <button className={`sh-ctl sh-seg${view === 'globe' ? ' sh-seg-on' : ''}`} aria-pressed={view === 'globe'} onClick={() => setView('globe')}>Globe</button>
          <button className={`sh-ctl sh-seg${view === 'radar' ? ' sh-seg-on' : ''}`} aria-pressed={view === 'radar'} onClick={() => setView('radar')}>Radar</button>
        </div>
      ) : null}
      <button
        ref={legendBtnRef}
        className="sh-ctl sh-key"
        onClick={() => setLegendPersist(!legendOpen)}
        aria-expanded={legendOpen}
        aria-controls="sh-legend-panel"
      >
        {AXES.map((a) => <span key={a} className="sh-key-dot" style={{ background: AXIS_HUE[a] }} />)} Key
      </button>
    </>
  );

  // The map itself (globe/radar + legend) is identical on desktop and the phone MAP tab — built
  // once here so neither copy can drift from the other.
  const consoleCallout = isPhone || focus ? null : (tourStop || null);
  const mapPane = (
    <>
      <div className="sh-mapinner">
        {/* Focus order (low, review): on the phone the controls render before the map itself so
            Tab reaches them before the map's own focusable content. */}
        {isPhone ? <div className="sh-controls">{controls}</div> : null}

        {showGlobe ? (
          <Suspense fallback={<div className="sh-maploading" style={{ height: mapH }}>Loading map…</div>}>
            <SituationMap3D
              situations={situations} focusId={focusId} callout={consoleCallout} tour={tourProps} newIds={newIds} view="globe"
              onSelect={userSelect} onOpenCallout={userSelect} height={mapH} width={isPhone ? (typeof window !== 'undefined' ? window.innerWidth - 24 : null) : band.w}
              shading={visibleShading} storyFocusIso3={storyFocusIso3}
              onSelectCountry={selectStoryByCountry}
              onHoverCountry={(iso3, anchor) => mapPeek.openOnHover(iso3, anchor)}
              onFocusCountry={(iso3, anchor) => mapPeek.openOnFocus(iso3, anchor)}
              onLeaveCountry={() => mapPeek.close()}
            />
          </Suspense>
        ) : (
          <RadarMap
            situations={situations} focusId={focusId} callout={consoleCallout} newIds={newIds}
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

        {isPhone && open.length === 0 && world ? (
          <div className="sh-quiet">{emptyLede || 'No situations open right now.'}</div>
        ) : null}

        {legendOpen ? (
          <MapLegend
            present={legendPresent}
            hiddenCount={alertStack.hiddenCount}
            storiesOlderLabel={topicsFreshness === 'older' && topicsAsOf ? olderLabel(topicsAsOf) : null}
            onClose={() => setLegendPersist(false)}
          />
        ) : null}
      </div>
      {isPhone && coverageNote ? <p className="sh-coverage">{coverageNote}</p> : null}
    </>
  );

  // The rail's content (desktop) and the sheet's body (phone) share the exact same branches —
  // only the situation/story detail's "back" affordance differs (the sheet has Collapse/Close).
  const railContent = focusMissing ? (
    <div className="sh-detail sh-gone">
      <button className="sh-back" onClick={() => userSelect(null)}>← All situations{ranked.length ? ` (${ranked.length})` : ''}</button>
      <p className="sh-muted" style={{ padding: '16px 15px' }}>That situation is no longer being tracked — it may have closed since the link was shared. Browse the active situations instead.</p>
    </div>
  ) : selected ? (
    <SituationDetail selected={selected} ev={ev} isGdacs={isGdacs} m={m} affected={affected} activeCount={ranked.length} onBack={() => userSelect(null)} />
  ) : selectedStory ? (
    <StoryCard key={storyFocusId} topic={selectedStory} asOf={topicsAsOf} activeCount={ranked.length} onBack={() => userSelectStory(null)} />
  ) : (
    <HudIntelFeed
      ranked={ranked} focusId={focusId} newIds={newIds} scannedIds={scannedIds} loading={loading} error={error} world={world}
      onSelect={userSelect}
      topics={topics} topicsAsOf={topicsAsOf} storyFocusId={storyFocusId}
      onSelectStory={userSelectStory} peek={mapPeek} emptyMessage={emptyLede}
    />
  );

  const sheetBody = focusMissing ? (
    <p className="sh-muted" style={{ padding: '16px 15px' }}>That situation is no longer being tracked — it may have closed since the link was shared.</p>
  ) : selected ? (
    <SituationDetail selected={selected} ev={ev} isGdacs={isGdacs} m={m} affected={affected} activeCount={ranked.length} onBack={closeSelection} showBack={false} />
  ) : selectedStory ? (
    <StoryCard key={storyFocusId} topic={selectedStory} asOf={topicsAsOf} activeCount={ranked.length} onBack={closeSelection} />
  ) : null;

  const statusLine = <HudStatusLine paused={paused} storiesAsOf={topicsAsOf} gdacsFresh={gdacsFresh} />;
  const aboutContent = (
    <MapAbout
      paused={paused} latestDailyEditionLabel={latestDailyEditionLabel} latestWeeklyEditionLabel={latestWeeklyEditionLabel}
      ranked={ranked} onSelect={userSelect} coverageNote={isPhone ? null : coverageNote}
    />
  );
  // F1.9: a tour bar at the page level (not nested inside the globe's callout, which never
  // renders on the phone MAP tab and doesn't exist at all in radar) — this works the same way in
  // globe, radar and on the phone. Esc still stops the tour (handled above).
  const tourBar = tourOn && tourStop ? (
    <div className="sh-tourbar-global" role="group" aria-label="Guided tour">
      <span className="sh-tourbar-status">Tour <b>{Math.min(tourIdx, tourN - 1) + 1}</b> of {tourN} · {tourStop.verb_label}</span>
      <span className="sh-tourbar-btns">
        <button onClick={tourPrev} aria-label="Previous situation">← Prev</button>
        <button onClick={tourNext} aria-label="Next situation">Next →</button>
        <button onClick={stopTour}>Stop</button>
      </span>
    </div>
  ) : null;
  const staleBanner = stale ? <div className="sh-banner">The situation feed hasn’t updated recently — showing the last known state.</div> : null;

  if (!isPhone) {
    // R4a · desktop full-bleed console (Console.dc.html): the map is the page. HUD panels float
    // over it — brief + alert stack on the left, sensor status + intel feed (or the selected
    // card) on the right, the orientation/tour line at the top of the free band, view controls
    // at its bottom. Nothing below the fold: "About this map" opens the old fold as a drawer.
    return (
      <div className={`sh-root gp-console sh-console${stale ? ' sh-stale' : ''}`}>
        <h1 className="sh-sr-only">Situation map — Global Perspectives</h1>
        <div className="sh-sr-only" role="status" aria-live="polite">{announcement}</div>
        {statusSlot ? createPortal(statusLine, statusSlot) : <div className="sh-status-inline">{statusLine}</div>}

        <div className="sh-band" ref={bandRef}>
          <div className="sh-mapwrap">{mapPane}</div>
        </div>

        <div className="sh-topline">
          <OrientationBanner />
          {staleBanner}
          {tourBar}
        </div>

        <div className="sh-col sh-col-left">
          <HudBriefPanel
            heading={worldDateLabel ? `Situation brief · ${worldDateLabel}` : 'Situation brief'}
            counts={world ? tierCounts : null}
            lede={error && !world ? 'The situation feed is unavailable right now.' : (world ? lede : 'Loading the world…')}
            lead={world ? lead : null}
          />
          {world ? (
            <AlertStack
              className="sh-alertstack"
              items={alertStack.items} hiddenCount={alertStack.hiddenCount} focusId={focus}
              onSelect={userSelect} emptyText={alertEmpty} note={alertNote}
            />
          ) : null}
        </div>

        <div className="sh-col sh-col-right">
          {sensorRows.length ? <HudSensorPanel rows={sensorRows} /> : null}
          <aside className="sh-rail">{railContent}</aside>
        </div>

        <div className="sh-viewbar" role="toolbar" aria-label="Map controls">
          {controls}
          <button
            ref={aboutBtnRef} className="sh-ctl" onClick={() => setAboutOpen((v) => !v)}
            aria-expanded={aboutOpen} aria-controls="sh-about-panel"
          >
            About this map
          </button>
        </div>

        {aboutOpen ? (
          <section id="sh-about-panel" className="sh-about" role="region" aria-label="About this map" tabIndex={-1} ref={aboutPanelRef}>
            <button className="sh-about-close" onClick={() => { setAboutOpen(false); aboutBtnRef.current?.focus?.(); }} aria-label="Close about this map">×</button>
            <div className="sh-fold sh-fold-drawer">{aboutContent}</div>
            <nav className="sh-about-links" aria-label="Site">
              <Link to="/about">About</Link>
              <Link to="/membership">Membership</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/disclosures">Disclosures</Link>
              <Link to="/contact">Contact</Link>
            </nav>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`sh-root gp-console${stale ? ' sh-stale' : ''}`}>
      {/* Review (low): /map had no <h1> — visually-hidden, the visible lede above already carries
          the page's heading look. */}
      <h1 className="sh-sr-only">Situation map — Global Perspectives</h1>
      <div className="sh-sr-only" role="status" aria-live="polite">{announcement}</div>
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

      {statusLine}

      {staleBanner}

      {tourBar}

      {/* M7 phone pattern (P1): one tab switch — MAP (default, radar) · LIST · ALERTS. */}
      <MapPhoneTabs active={phoneTab} onChange={setPhoneTab} alertCount={tierCounts.high + tierCounts.elevated} />

      {phoneTab === 'map' ? (
        <div id="sh-panel-map" role="tabpanel" aria-labelledby="sh-tab-map" className="sh-phone-panel">
          {world || sensorRows.length ? (
            <HudCompactLine summary={hudSummary} expanded={hudExpanded} onToggle={() => setHudExpanded((v) => !v)}>
              <div className="sh-hud-row">
                {world ? <HudBriefPanel counts={tierCounts} lead={lead} /> : null}
                {sensorRows.length ? <HudSensorPanel rows={sensorRows} /> : null}
              </div>
            </HudCompactLine>
          ) : null}
          <div className="sh-mapwrap">{mapPane}</div>
          {phoneSheetOpen ? (
            <BottomSheet
              stop={sheetStop}
              onStopChange={setSheetStop}
              onClose={closeSelection}
              title={sheetTitle}
              subtitle={sheetSubtitle}
            >
              {sheetBody}
            </BottomSheet>
          ) : null}
        </div>
      ) : phoneTab === 'list' ? (
        <div id="sh-panel-list" role="tabpanel" aria-labelledby="sh-tab-list" className="sh-phone-panel">
          <HudIntelFeed
            ranked={ranked} focusId={focusId} newIds={newIds} scannedIds={scannedIds} loading={loading} error={error} world={world}
            onSelect={userSelect}
            topics={topics} topicsAsOf={topicsAsOf} storyFocusId={storyFocusId}
            onSelectStory={userSelectStory} peek={mapPeek} emptyMessage={emptyLede}
          />
        </div>
      ) : (
        <div id="sh-panel-alerts" role="tabpanel" aria-labelledby="sh-tab-alerts" className="sh-phone-panel">
          {/* R4a: the ALERTS tab reuses the desktop alert stack's cards. */}
          {world ? (
            <AlertStack
              items={alertStack.items} hiddenCount={alertStack.hiddenCount} focusId={focus}
              onSelect={userSelect} emptyText={alertEmpty} note={alertNote}
            />
          ) : (
            <p className="sh-muted">{error ? 'Couldn’t load the feed. Retrying automatically.' : 'Loading…'}</p>
          )}
        </div>
      )}

      <section className="sh-fold">{aboutContent}</section>
    </div>
  );
}
