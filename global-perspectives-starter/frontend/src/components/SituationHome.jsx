import { useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorld, useSituationDetail } from '../hooks/useWorld.js';
import SituationMap, { AXIS_HUE } from './SituationMap.jsx';
import './SituationHome.css';

const TIER_LABEL = { high: 'High', elevated: 'Elevated', moderate: 'Moderate', low: 'Low' };

function fmtAgo(iso) {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
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
  const selected = useMemo(() => situations.find((s) => s.id === focus) || null, [situations, focus]);

  return (
    <div className={`sh-root${stale ? ' sh-stale' : ''}`}>
      <header className="sh-bar">
        <div className="sh-live">
          <span className={`sh-dot${stale ? ' sh-dot-stale' : ''}`} />
          {stale ? 'Data delayed' : 'Updated'} {asOf ? fmtAgo(asOf) : ''}
          {world?.next_expected_at && !stale ? <span className="sh-next"> · next ~{fmtAgo(world.next_expected_at).replace(' ago', '')}</span> : null}
        </div>
        <div className="sh-title">What’s happening in the world right now</div>
      </header>

      {world?.lede ? <p className="sh-lede">{world.lede}</p> : null}

      {stale ? <div className="sh-banner">The situation feed hasn’t updated recently — showing the last known state.</div> : null}

      <SituationMap situations={situations} selectedId={focus} onSelect={select} />

      <div className="sh-cols">
        <section className="sh-list" aria-label="Situations being watched">
          <h2>{ranked.length ? `${ranked.length} situation${ranked.length === 1 ? '' : 's'} being watched` : 'Situations'}</h2>
          {loading && !world ? <p className="sh-muted">Loading…</p> : null}
          {error ? <p className="sh-muted">Couldn’t load the feed.</p> : null}
          {world && !ranked.length ? <p className="sh-muted">No critical situations being tracked right now.</p> : null}
          <ul>
            {ranked.map((r) => (
              <li key={r.id} className={r.id === focus ? 'sh-active' : ''}>
                <button onClick={() => select(r.id)}>
                  <span className="sh-chip" style={{ background: AXIS_HUE[situations.find((s) => s.id === r.id)?.axis] || '#9aa4b2' }} />
                  <span className="sh-rt">{TIER_LABEL[r.tier] || r.tier}{r.escalating ? ' ▲' : ''}</span>
                  <span className="sh-rl">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="sh-detail" aria-live="polite">
          {selected ? (
            <>
              <h3>{selected.verb_label}</h3>
              <div className="sh-meta">
                <span>{TIER_LABEL[selected.tier] || selected.tier}</span>
                <span>{selected.escalating ? 'escalating' : selected.state}</span>
                <span>{fmtAgo(selected.last_change_at)}</span>
              </div>
              {selected.what_changed ? <p className="sh-what">{selected.what_changed}</p> : null}
              {selected.iso3_affected?.length ? <p className="sh-muted">Affected: {selected.iso3_affected.join(', ')}</p> : null}
              {detail?.evidence?.gdacs_report_url ? <p><a href={detail.evidence.gdacs_report_url} target="_blank" rel="noreferrer">GDACS report →</a></p> : null}
              {selected.threadId ? <p><Link to={`/weekly/thread/${encodeURIComponent(selected.threadId)}`}>Full analysis →</Link></p> : <p className="sh-muted">Analysis: not generated for this event.</p>}
            </>
          ) : (
            <p className="sh-muted">Select a situation to see what changed and why.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
