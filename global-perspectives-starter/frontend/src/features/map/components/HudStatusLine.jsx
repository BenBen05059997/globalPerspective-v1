// HudStatusLine — the console's single honesty line under the page header. Rendered only when
// the newest analysis (the daily brief's own `generatedAt`, via useDailyBrief) is more than 36h
// old (freshness.js `pausedSince`); every date shown is computed from a real timestamp, never
// typed. CLAUDE.md: never invent facts/dates; no placeholder UI — this renders nothing rather
// than guess.
//
// F2.19 (review R2): one consistent line everywhere it appears — site-wide (Layout.jsx) and on
// /map (SituationHome.jsx) — "ANALYSIS PAUSED SINCE <date> · LAST STORIES <date> · DISASTER
// ALERTS LIVE". `storiesAsOf` and `gdacsFresh` are optional: Layout.jsx (which has no topics/world
// data loaded) omits them rather than claim a state it hasn't checked; /map, which has both,
// supplies them.
import '@/features/map/components/HudStatusLine.css';
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function HudStatusLine({ paused, storiesAsOf, gdacsFresh }) {
  if (!paused) return null;

  const parts = [
    paused.beyondLookback
      ? `ANALYSIS PAUSED · ${paused.text.toUpperCase()}`
      : `ANALYSIS PAUSED SINCE ${paused.label}`,
  ];

  const storiesLabel = storiesAsOf ? fmtDate(storiesAsOf) : null;
  if (storiesLabel) parts.push(`LAST STORIES ${storiesLabel}`);

  if (gdacsFresh) parts.push('DISASTER ALERTS LIVE');

  return (
    <div className="hud-status-line" role="status">
      <span className="hud-status-dot" aria-hidden="true">●</span>
      <span className="hud-status-text">{parts.join(' · ')}</span>
    </div>
  );
}
