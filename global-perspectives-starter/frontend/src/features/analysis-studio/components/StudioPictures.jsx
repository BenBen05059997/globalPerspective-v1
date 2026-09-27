// StudioPictures — the ONE picture per lens (S5c F1 §2, TRACK_RECORD_AND_STUDIO_RULING.md
// "one picture per lens") + the "our data vs this run" place strip (D4) + a real-dates-only
// time bar. Pure CSS/DOM, same approach as AnalysisVisuals.jsx (no d3, no new deps) — these
// render from the pure lib/ builders (scenarioBands.js, comparePicture.js,
// whatChangedPicture.js, freeformPicture.js, oursVsRun.js), never from raw model output
// directly, so every number/date/place drawn already passed the anti-invention gates.

import { useState } from 'react';
import { formatCiteDate } from '@/features/analysis-studio/lib/formatDate';
import '@/features/analysis-studio/components/StudioPictures.css';

// OursVsRunStrip — "our data vs this run": OUR DATA (solid accent border, backed by a
// selected story's own region) vs THIS RUN (sand hatching — named by the run, not backed
// by any source region). D4: places the model named but no source backs are already
// dropped upstream (oursVsRun.dropUnbackedPlaces) — `dropped` is passed through only so
// the reader sees an honest note, never a re-added place.
export function OursVsRunStrip({ ours = [], runOnly = [], dropped = [] }) {
  if (ours.length === 0 && runOnly.length === 0 && dropped.length === 0) return null;
  return (
    <div className="sp-block">
      <div className="sp-label">Our data vs this run</div>
      <div className="sp-legend">
        <span><span className="sp-legend-dot ours" /> Our data (backed by a selected story)</span>
        <span><span className="sp-legend-dot run" /> This run (named by the analysis only)</span>
      </div>
      <div className="sp-places">
        {ours.map((p) => <span key={`o-${p}`} className="sp-place-chip sp-place-ours">{p}</span>)}
        {runOnly.map((p) => <span key={`r-${p}`} className="sp-place-chip sp-place-run">{p}</span>)}
      </div>
      {dropped.length > 0 && (
        <div className="sp-dropped-note">
          Dropped from the picture (named by the analysis but not backed by any selected story's region): {dropped.map((d) => d.place).join(', ')}.
        </div>
      )}
    </div>
  );
}

// StudioTimeBar — real dates only: the earliest/latest dates actually carried by the
// citations, plus any scenario `by` dates, plotted on one axis. Never a manufactured date.
export function StudioTimeBar({ dates = [], today }) {
  const clean = [...new Set((Array.isArray(dates) ? dates : []).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)))].sort();
  if (clean.length === 0) return null;
  const min = Date.parse(`${clean[0].slice(0, 10)}T00:00:00Z`);
  const max = Date.parse(`${clean[clean.length - 1].slice(0, 10)}T00:00:00Z`);
  const span = Math.max(1, max - min);
  const pct = (d) => ((Date.parse(`${d.slice(0, 10)}T00:00:00Z`) - min) / span) * 100;
  const todayPct = today && Date.parse(`${today}T00:00:00Z`) >= min && Date.parse(`${today}T00:00:00Z`) <= max
    ? pct(today) : null;
  return (
    <div className="sp-timebar" role="img" aria-label={`Timeline from ${clean[0].slice(0, 10)} to ${clean[clean.length - 1].slice(0, 10)}`}>
      <div className="sp-timebar-track" />
      {clean.map((d) => (
        <div key={d} className="sp-timebar-tick" style={{ left: `${pct(d)}%` }} title={d.slice(0, 10)} />
      ))}
      {/* Labels only at the ends — intermediate ticks sit too close together on a narrow
          (phone) width for their labels not to overlap; the ticks themselves still mark
          every real date. */}
      {[clean[0], clean[clean.length - 1]].filter((d, i, arr) => arr.indexOf(d) === i).map((d) => (
        <div key={`l-${d}`} className="sp-timebar-label" style={{ left: `${pct(d)}%` }}>{d.slice(5, 10)}</div>
      ))}
      {todayPct != null && <div className="sp-timebar-tick today" style={{ left: `${todayPct}%` }} title={`Today · ${today}`} />}
    </div>
  );
}

// ScenarioBandPicture — Scenario lens: bands from today to each dated trigger.
export function ScenarioBandPicture({ bands = [], undated = [] }) {
  if (bands.length === 0 && undated.length === 0) return null;
  const maxDays = Math.max(1, ...bands.map((b) => b.days));
  return (
    <div className="sp-block">
      <div className="sp-label">Scenario timeline — today → dated trigger</div>
      {bands.map((b, i) => (
        <div className="sp-band-row" key={i}>
          <span className="sp-band-name">{b.name}</span>
          <span className="sp-band-track">
            <span className="sp-band-fill" style={{ width: `${Math.max(2, (b.days / maxDays) * 100)}%` }} />
          </span>
          <span className="sp-band-by"><time dateTime={b.by}>{formatCiteDate(b.by)}</time> · {b.days}d</span>
        </div>
      ))}
      {undated.length > 0 && (
        <div className="sp-band-undated">Timing unclear: {undated.map((s) => s.name).join(', ')}</div>
      )}
    </div>
  );
}

// ComparePicturePanel — Compare lens: lanes, shared places, one judged link, a cited grid.
export function ComparePicturePanel({ picture }) {
  if (!picture || !Array.isArray(picture.lanes) || picture.lanes.length === 0) return null;
  const { lanes, judgedLink, grid } = picture;
  const kinds = ['NEWS', 'ANALYSIS', 'DRIFT', 'FORECAST'];
  return (
    <div className="sp-block">
      <div className="sp-label">Compare — lanes &amp; shared coverage</div>
      <div className="sp-lanes">
        {lanes.map((l) => (
          <div className="sp-lane" key={l.title}>
            <div className="sp-lane-title">{l.title}</div>
            {l.regions.length > 0 && <div className="sp-lane-regions">{l.regions.join(', ')}</div>}
          </div>
        ))}
      </div>
      {judgedLink && (
        <div className="sp-judged-link">
          <span>{judgedLink.from}</span>
          <span className="sp-judged-link-dash" aria-hidden />
          <span>{judgedLink.to}</span>
          <span>— {judgedLink.label} (via {judgedLink.via})</span>
        </div>
      )}
      {Array.isArray(grid) && grid.length > 0 && (
        <table className="sp-grid">
          <thead>
            <tr><th>Story</th>{kinds.map((k) => <th key={k}>{k}</th>)}</tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.title}>
                <td>{row.title}</td>
                {kinds.map((k) => <td key={k}>{row.counts[k] || 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// WhatChangedChart — a risk trend WITH GAPS (never bridged) + the dated change log, each
// entry carrying direction-check flags (directionCheck.js) — a flag, never a rewrite. Renders
// one block per country actually named by the selected stories (real `country_history` data,
// countryDriftPicture.js) — never merges two countries' scores into one line.
export function WhatChangedChart({ countries = [] }) {
  const withData = countries.filter((c) => c.series?.points?.length > 0 || c.changeLog?.length > 0);
  if (withData.length === 0) return null;
  return (
    <div className="sp-block">
      <div className="sp-label">What changed — risk trend &amp; change log</div>
      {withData.map((c) => (
        <CountryChangeBlock key={c.name} country={c} />
      ))}
    </div>
  );
}

function CountryChangeBlock({ country }) {
  const points = country.series?.points || [];
  const gaps = country.series?.gaps || [];
  const changeLog = country.changeLog || [];
  const scores = points.map((p) => p.score);
  const maxScore = Math.max(1, ...scores);
  return (
    <div className="sp-country-block">
      <div className="sp-country-name">{country.name}</div>
      {points.length > 0 && (
        <div className="sp-series">
          {points.map((p) => (
            <div className="sp-series-point" key={p.date}>
              {/* Capped at 70% of the row's height (not 100%) — .sp-series-point's date
                  label sits below it in the same fixed-height flex column, so the tallest
                  bar needs headroom left under it rather than filling the whole row. */}
              <div className="sp-series-bar" style={{ height: `${Math.max(6, (p.score / maxScore) * 70)}%` }} title={`${formatCiteDate(p.date)}: ${p.score}`} />
              <time className="sp-series-date" dateTime={p.date}>{p.date.slice(5)}</time>
            </div>
          ))}
        </div>
      )}
      {gaps.length > 0 && (
        <div className="sp-series-gap">
          {gaps.map((g, i) => (
            <div key={i}>
              Gap: no reading between <time dateTime={g.from}>{formatCiteDate(g.from)}</time> and <time dateTime={g.to}>{formatCiteDate(g.to)}</time> ({g.days} days).
            </div>
          ))}
        </div>
      )}
      {changeLog.length > 0 && (
        <ul className="sp-changelog">
          {changeLog.map((c, i) => (
            <li className="sp-changelog-row" key={i}>
              {c.date && <time className="sp-changelog-date" dateTime={c.date}>{formatCiteDate(c.date)}</time>}
              {c.text}
              {(c.flags || []).map((f, j) => (
                <span key={j} className="sp-flag" title={f.reason}>⚠ {f.axis} wording/direction mismatch</span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// FreeformHighlighter — Free-form lens: clicking a sentence lights the sources it cites.
export function FreeformHighlighter({ sentences = [] }) {
  const [active, setActive] = useState(null);
  const withCites = sentences.filter((s) => s.citations.length > 0);
  if (withCites.length === 0) return null;
  return (
    <div className="sp-block">
      <div className="sp-label">Click a sentence to light its sources</div>
      <div className="sp-freeform">
        {sentences.map((s, i) => {
          const has = s.citations.length > 0;
          const isActive = active === i;
          const dim = active != null && !isActive && has;
          return (
            <span
              key={i}
              className={`sp-sentence${has ? '' : ''}${isActive ? ' lit' : ''}${dim ? ' dim' : ''}`}
              role={has ? 'button' : undefined}
              tabIndex={has ? 0 : undefined}
              onClick={has ? () => setActive(isActive ? null : i) : undefined}
              onKeyDown={has ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(isActive ? null : i); } } : undefined}
            >
              {s.sentence.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, '')}
              {has && isActive && (
                <span className="sp-cite-marker"> [{s.citations.map((c) => (c.startsWith('W') ? `W${c.slice(1)}` : c)).join(', ')}]</span>
              )}
              {' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}
