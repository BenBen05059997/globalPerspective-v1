// AnalysisVisuals — the visual atoms for Analysis Studio's optional ```gp-struct block
// (parsed + sanitized by utils/analysisStruct.js). These are a compact SUMMARY DASHBOARD
// layered on top of the prose, never a replacement for it — every component renders null
// on missing/empty input (the honest fallback: no struct → no extra UI, prose stands alone).
// Pure CSS (no d3, no new deps) — see AnalysisVisuals.css, built from the existing design
// tokens (var(--accent), var(--ink*), var(--risk-*), var(--line)).

import './AnalysisVisuals.css';

// ScenarioBars — one horizontal range-bar per scenario: filled segment from pLow→pHigh
// on a 0–100 track, name on the left, "pLow–pHigh%" on the right.
export function ScenarioBars({ scenarios }) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) return null;
  return (
    <div className="av-block av-scenarios">
      <div className="av-label">Scenario probabilities</div>
      <div className="av-sbar-list">
        {scenarios.map((s, i) => (
          <div className="av-sbar-row" key={i}>
            <span className="av-sbar-name">{s.name}</span>
            <span className="av-sbar-track">
              <span
                className="av-sbar-fill"
                style={{ left: `${s.pLow}%`, width: `${Math.max(1, s.pHigh - s.pLow)}%` }}
              />
            </span>
            <span className="av-sbar-range">{s.pLow}–{s.pHigh}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// IndicatorMatrix — the Indicators & Warnings table (§P1.4) as a styled 3-col table.
export function IndicatorMatrix({ indicators }) {
  if (!Array.isArray(indicators) || indicators.length === 0) return null;
  return (
    <div className="av-block av-indicators">
      <div className="av-label">Indicators &amp; warnings</div>
      <table className="av-itable">
        <thead>
          <tr>
            <th>Indicator to watch</th>
            <th>Confirms</th>
            <th>Kills</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((ind, i) => (
            <tr key={i}>
              <td className="av-isignal">{ind.signal}</td>
              <td className="av-iconfirm">{ind.confirms ? `✓ ${ind.confirms}` : '—'}</td>
              <td className="av-ikill">{ind.kills ? `✗ ${ind.kills}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DIR_GLYPH = { up: '▲', down: '▼', mixed: '◆' };
const MAG_DOTS = { small: '●', moderate: '●●', large: '●●●' };

// RippleTable — instrument | direction glyph | magnitude dots.
export function RippleTable({ ripples }) {
  if (!Array.isArray(ripples) || ripples.length === 0) return null;
  return (
    <div className="av-block av-ripples">
      <div className="av-label">Economic ripple</div>
      <ul className="av-rlist">
        {ripples.map((r, i) => (
          <li className="av-rrow" key={i}>
            <span className="av-rinst">{r.instrument}</span>
            <span className={`av-rdir av-rdir-${r.direction}`} aria-hidden>{DIR_GLYPH[r.direction] || '—'}</span>
            <span className="av-rmag">{MAG_DOTS[r.magnitude] || ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
