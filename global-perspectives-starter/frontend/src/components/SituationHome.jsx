import { useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorld, useSituationDetail } from '../hooks/useWorld.js';
import SituationMap, { AXIS_HUE } from './SituationMap.jsx';
import './SituationHome.css';

// deck.gl is heavy — code-split so it loads only on this route.
const SituationMap3D = lazy(() => import('./SituationMap3D.jsx'));

function canUse3D() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
const USE_3D = typeof window !== 'undefined' && canUse3D();

const TIER_LABEL = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };
const STATE_LABEL = { emerging: 'New', escalating: 'Getting worse', peak: 'Ongoing', cooling: 'Easing', closed: 'Ended' };
const AXES = [
  { key: 'conflict', label: 'Conflict' },
  { key: 'political', label: 'Political' },
  { key: 'economic', label: 'Economic' },
  { key: 'humanitarian', label: 'Humanitarian' },
];

function fmtAgo(iso) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
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

export default function SituationHome() {
  const { world, situations, loading, error, asOf, stale } = useWorld();
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const { detail } = useSituationDetail(focus);

  const select = useCallback((id) => {
    setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('focus', id); else n.delete('focus'); return n; }, { replace: true });
  }, [setParams]);

  const ranked = world?.ranked || [];
  const open = useMemo(() => situations.filter((s) => s.state !== 'closed'), [situations]);
  const counts = useMemo(() => {
    const c = { conflict: 0, political: 0, economic: 0, humanitarian: 0 };
    for (const s of open) if (c[s.axis] != null) c[s.axis]++;
    return c;
  }, [open]);
  const newsAxesEmpty = counts.conflict + counts.political + counts.economic === 0;
  const selected = useMemo(() => situations.find((s) => s.id === focus) || null, [situations, focus]);
  const ev = detail?.evidence || {};

  return (
    <div className={`sh-root${stale ? ' sh-stale' : ''}`}>
      <header className="sh-bar">
        <div className="sh-live">
          <span className={`sh-dot${stale ? ' sh-dot-stale' : ''}`} />
          {stale ? 'Data delayed' : 'Updated'} {asOf ? fmtAgo(asOf) : ''}
          {world?.next_expected_at && !stale ? <span className="sh-next"> · next {fmtIn(world.next_expected_at)}</span> : null}
        </div>
        <div className="sh-title">What’s happening in the world right now</div>
      </header>

      {world?.lede ? <p className="sh-lede">{world.lede}</p> : null}
      {stale ? <div className="sh-banner">The situation feed hasn’t updated recently — showing the last known state.</div> : null}

      <div className="sh-mapwrap">
        <div className="sh-mapinner">
          {USE_3D ? (
            <Suspense fallback={<div className="sh-maploading">Loading map…</div>}>
              <SituationMap3D situations={situations} selectedId={focus} onSelect={select} />
            </Suspense>
          ) : (
            <SituationMap situations={situations} selectedId={focus} onSelect={select} />
          )}
          <div className="sh-legend" aria-label="What the map watches">
            {AXES.map((a) => (
              <span key={a.key} className={`sh-leg${counts[a.key] ? '' : ' sh-leg-off'}`}>
                <span className="sh-leg-dot" style={{ background: AXIS_HUE[a.key] }} />
                {a.label} <b>{counts[a.key] ? `${counts[a.key]} active` : 'none'}</b>
              </span>
            ))}
          </div>
        </div>
        {world && newsAxesEmpty ? (
          <p className="sh-coverage">Tracking severe natural disasters (UN/EU GDACS). Conflict, political and economic situations arrive with the news layer.</p>
        ) : null}
      </div>

      <div className="sh-cols">
        <section className="sh-list" aria-label="Situations being watched">
          <h2>{ranked.length ? `${ranked.length} situation${ranked.length === 1 ? '' : 's'} being watched` : 'Situations'}</h2>
          {loading && !world ? <p className="sh-muted">Loading…</p> : null}
          {error ? <p className="sh-muted">Couldn’t load the feed.</p> : null}
          {world && !ranked.length ? <p className="sh-muted">No critical situations being tracked right now — the map is quiet.</p> : null}
          <ul>
            {ranked.map((r) => {
              const s = situations.find((x) => x.id === r.id);
              return (
                <li key={r.id} className={r.id === focus ? 'sh-active' : ''}>
                  <button onClick={() => select(r.id)}>
                    <span className="sh-chip" style={{ background: AXIS_HUE[s?.axis] || '#9aa4b2' }} />
                    <span className="sh-rt">{TIER_LABEL[r.tier] || r.tier}{r.escalating ? ' ▲' : ''}</span>
                    <span className="sh-rl">{r.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="sh-detail" aria-live="polite">
          {selected ? (
            <>
              <h3>{selected.verb_label}</h3>
              <div className="sh-meta">
                <span className={`sh-badge sh-badge-${selected.tier}`}>{TIER_LABEL[selected.tier] || selected.tier}</span>
                <span>{STATE_LABEL[selected.state] || selected.state}</span>
                <span>updated {fmtAgo(selected.last_change_at)}</span>
              </div>
              {ev.gdacs_report_url ? <p><a className="sh-report" href={ev.gdacs_report_url} target="_blank" rel="noreferrer">Official UN/EU GDACS report →</a></p> : null}
              {ev.gdacs_description ? <p className="sh-desc">{ev.gdacs_description}</p> : (selected.what_changed ? <p className="sh-desc">{selected.what_changed}</p> : null)}
              <dl className="sh-facts">
                {ev.gdacs_severity_text ? <><dt>Severity</dt><dd>{ev.gdacs_severity_text}</dd></> : null}
                {(selected.affected_names?.length || selected.iso3_affected?.length)
                  ? <><dt>Affected</dt><dd>{selected.affected_names?.length ? selected.affected_names.join(', ') : selected.iso3_affected.join(', ')}</dd></> : null}
                <dt>First seen</dt><dd>{fmtAgo(selected.opened_at)}</dd>
              </dl>
              {selected.threadId
                ? <p><Link to={`/weekly/thread/${encodeURIComponent(selected.threadId)}`}>Full analysis →</Link></p>
                : <p className="sh-note">Deterministic alert from UN/EU GDACS — no AI analysis is generated at this level.</p>}
            </>
          ) : (
            <p className="sh-muted">Select a situation to see what changed and why.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
