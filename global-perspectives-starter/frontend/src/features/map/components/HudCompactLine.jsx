// HudCompactLine — M7 phone MAP tab: the situation brief + sensor status collapse into one
// compact line above the map ("1 elevated · sensors: GDACS live · news paused since Sep 12"),
// expandable INLINE (tapping it opens the two full HUD panels underneath, in the page flow —
// P1's "no popovers" rule). Text comes from lib/hudCompact.js so the wording is unit-tested
// separately from this render shell.
export default function HudCompactLine({ summary, expanded, onToggle, children }) {
  return (
    <div className="sh-hud-compact">
      <button
        type="button"
        className="sh-hud-compact-btn"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="sh-hud-compact-text">{summary}</span>
        <span className="sh-hud-compact-caret" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded ? <div className="sh-hud-compact-body">{children}</div> : null}
    </div>
  );
}
