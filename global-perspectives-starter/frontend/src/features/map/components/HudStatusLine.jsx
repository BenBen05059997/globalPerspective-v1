// HudStatusLine — the console's single honesty line under the page header. Rendered only when
// the newest analysis (the daily brief's own `generatedAt`, via useDailyBrief) is more than 36h
// old (freshness.js `pausedSince`); the date shown is computed from that timestamp, never typed.
// CLAUDE.md: never invent facts/dates; no placeholder UI — this renders nothing rather than guess.
export default function HudStatusLine({ paused }) {
  if (!paused) return null;
  return (
    <div className="hud-status-line" role="status">
      <span className="hud-status-dot" aria-hidden="true">●</span>
      <span className="hud-status-text">{paused.beyondLookback ? `NEW STORIES AND ANALYSIS PAUSED · ${paused.text.toUpperCase()}` : `NEW STORIES AND ANALYSIS PAUSED SINCE ${paused.label}`}</span>
    </div>
  );
}
