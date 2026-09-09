import { useMemo, useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorld, useSituationDetail } from '../hooks/useWorld.js';
import SituationMap, { AXIS_HUE } from './SituationMap.jsx';
import { iso3Name, buildLede, TIER_LABEL } from '../utils/situationLabels.js';
import './SituationHome.css';

// deck.gl is heavy — code-split so it loads only on this route.
const SituationMap3D = lazy(() => import('./SituationMap3D.jsx'));

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
const TIER_HINT = {
  high: 'read this first', elevated: 'worth watching today', moderate: 'developing', low: 'on the record',
};

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
  const { detail } = useSituationDetail(focus);

  // Selection writes the URL (shareable deep link). The tour NEVER writes the URL.
  const select = useCallback((id) => {
    setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('focus', id); else n.delete('focus'); return n; }, { replace: true });
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

  // Guided tour: cycle the top situations with a gentle fly-to. DEFAULT OFF — nothing moves on
  // load, and the tour NEVER writes the URL (it drives a local tourId, not the ?focus param).
  const [tourOn, setTourOn] = useState(false);
  const [tourId, setTourId] = useState(null);
  useEffect(() => {
    if (!tourOn || ranked.length < 2) return undefined;
    const top = ranked.slice(0, 6);
    let i = 0; setTourId(top[0].id);
    const iv = setInterval(() => { i = (i + 1) % top.length; setTourId(top[i].id); }, 6000);
    return () => clearInterval(iv);
  }, [tourOn, ranked]);
  const startTour = () => setTourOn(true);
  const stopTour = () => { setTourOn(false); setTourId(null); };
  const userSelect = useCallback((id) => { setTourOn(false); setTourId(null); select(id); }, [select]);
  const flyId = focus || tourId;

  const counts = useMemo(() => {
    const c = { conflict: 0, political: 0, economic: 0, humanitarian: 0 };
    for (const s of open) if (c[s.axis] != null) c[s.axis]++;
    return c;
  }, [open]);
  const newsAxesEmpty = counts.conflict + counts.political + counts.economic === 0;
  const lede = useMemo(() => buildLede(open, hero), [open, hero]);
  const selected = useMemo(() => situations.find((s) => s.id === focus) || null, [situations, focus]);
  const ev = detail?.evidence || {};
  const isGdacs = selected?.source === 'gdacs';
  const m = selected ? metricsFor(selected, ev) : null;
  const affected = selected?.iso3_affected?.length ? selected.iso3_affected : [];

  return (
    <div className={`sh-root${stale ? ' sh-stale' : ''}`}>
      <header className="sh-bar">
        <div>
          <div className="sh-lede">{world ? lede : 'Loading the world…'}</div>
          <div className="sh-sub">Global news intelligence, scored and mapped. Refreshed every 30 minutes.</div>
        </div>
        <div className="sh-live">
          <span className={`sh-dot${stale ? ' sh-dot-stale' : ''}`} />
          {stale ? 'Data delayed' : 'updated'} {asOf ? fmtAgo(asOf) : ''}
          {world?.next_expected_at && !stale ? <span className="sh-next"> · next {fmtIn(world.next_expected_at)}</span> : null}
        </div>
      </header>

      {stale ? <div className="sh-banner">The situation feed hasn’t updated recently — showing the last known state.</div> : null}

      <div className="sh-stage">
        <div className="sh-mapwrap">
          <div className="sh-mapinner">
            {USE_3D ? (
              <Suspense fallback={<div className="sh-maploading">Loading map…</div>}>
                <SituationMap3D situations={situations} selectedId={flyId} hero={hero} onSelect={userSelect} height={620} />
              </Suspense>
            ) : (
              <SituationMap situations={situations} selectedId={focus} onSelect={userSelect} />
            )}

            <div className="sh-controls">
              {ranked.length >= 2 ? (
                tourOn
                  ? <button className="sh-ctl" onClick={stopTour}>Stop tour</button>
                  : <button className="sh-ctl" onClick={startTour} title="Fly through today’s top situations">Walk me through today</button>
              ) : null}
            </div>

            {open.length === 0 && world ? (
              <div className="sh-quiet">Quiet day — no situations open right now.</div>
            ) : null}

            <div className="sh-legend" aria-label="How to read the map">
              <div className="sh-legrow">
                <b>Colour = type</b>
                {AXES.map((a) => (
                  <span key={a} className={`sh-leg${counts[a] ? '' : ' sh-leg-off'}`}>
                    <span className="sh-leg-dot" style={{ background: AXIS_HUE[a] }} />{AXIS_LABEL[a]}
                  </span>
                ))}
              </div>
              <div className="sh-legrow">
                <b>Glow = how serious</b>
                {['low', 'moderate', 'elevated', 'high'].map((t) => {
                  const has = ranked.some((s) => s.tier === t);
                  return (
                    <span key={t} className={`sh-leg${has ? '' : ' sh-leg-off'}`}>
                      <span className={`sh-leg-pin sh-pin-${t}`} />{TIER_LABEL[t]}
                      <i>{t === 'high' && !has ? 'none today' : TIER_HINT[t]}</i>
                    </span>
                  );
                })}
                <span className="sh-leg"><span className="sh-leg-esc">▲</span>escalating<i>worse in the last few hours</i></span>
              </div>
            </div>
          </div>
          {world && newsAxesEmpty ? (
            <p className="sh-coverage">Tracking severe natural disasters (UN/EU GDACS). Conflict, political and economic situations arrive with the news layer.</p>
          ) : null}
        </div>

        <aside className="sh-rail" aria-live="polite">
          {selected ? (
            <div className="sh-detail">
              <button className="sh-back" onClick={() => userSelect(null)}>← All situations{ranked.length ? ` (${ranked.length})` : ''}</button>
              <div className="sh-detail-head">
                <span className="sh-meta-row">
                  <span className={`sh-badge sh-badge-${selected.tier}`}>{TIER_LABEL[selected.tier] || selected.tier}</span>
                  <span className="sh-axis" style={{ color: AXIS_HUE[selected.axis] }}>{AXIS_LABEL[selected.axis] || selected.axis}</span>
                  {isGdacs ? <span className="sh-prov">UN/EU GDACS</span>
                    : (selected.escalating ? <span className="sh-esc">▲ escalating</span> : null)}
                </span>
                <h3>{selected.verb_label}</h3>
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
                    <div><dt>Alert level</dt><dd className="sh-alert">{ev.gdacs_level || '—'}</dd></div>
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
                    <p className="sh-consolidating">Coverage is still consolidating; {m.outlets || 'few'} source{m.outlets === 1 ? '' : 's'} so far. Rechecked every 30 minutes. The tier will move on its own if the count or the spread changes.</p>
                  )}
                </>
              )}

              <div className="sh-detail-foot">
                {selected.threadId
                  ? <Link to={`/weekly/thread/${encodeURIComponent(selected.threadId)}`}>Full analysis →</Link>
                  : (isGdacs && ev.gdacs_report_url
                      ? <a href={ev.gdacs_report_url} target="_blank" rel="noreferrer">Official UN/EU GDACS report →</a>
                      : <span className="sh-nopage">No dedicated situation page yet</span>)}
              </div>
            </div>
          ) : (
            <div className="sh-list">
              <h2>{ranked.length ? `${ranked.length} active situation${ranked.length === 1 ? '' : 's'}` : 'Situations'}<i> ranked by severity</i></h2>
              {loading && !world ? <p className="sh-muted">Loading…</p> : null}
              {error ? <p className="sh-muted">Couldn’t load the feed.</p> : null}
              {world && !ranked.length ? <p className="sh-muted">No situations open right now — the map is quiet.</p> : null}
              <ul>
                {ranked.map((s) => (
                  <li key={s.id} className={s.id === focus ? 'sh-active' : ''}>
                    <button onClick={() => userSelect(s.id)}>
                      <span className={`sh-leg-pin sh-pin-${s.tier}`} style={{ '--pin': AXIS_HUE[s.axis] || '#9aa4b2' }} />
                      <span className="sh-row-main">
                        <span className="sh-row-tags">
                          <span className={`sh-tierlbl sh-tierlbl-${s.tier}`}>{TIER_LABEL[s.tier]}</span>
                          {s.escalating ? <span className="sh-esc-sm">▲ escalating</span> : null}
                        </span>
                        <span className="sh-row-title">{s.verb_label}</span>
                        {s.what_changed ? <span className="sh-row-what">{s.what_changed}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

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
            <Link to="/economy"><b>Economy</b><span>Rates, currencies, energy and trade, tied to the politics that move them.</span></Link>
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
