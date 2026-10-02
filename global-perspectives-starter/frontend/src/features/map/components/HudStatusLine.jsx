// HudStatusLine — the one honesty line, site-wide (Layout.jsx) and on the map (SituationHome.jsx):
// "New stories and analysis paused since <date> · disaster alerts live". Rendered ONLY when the
// newest AI-generated content anywhere on the site (daily brief / stories feed / country briefings,
// see shared/lib/analysisFreshness.js) is older than the pause threshold (freshness.js
// `pausedSince`); every date is computed from a real timestamp, never typed. The disaster-alert
// part is also computed: "live" only when the GDACS source was checked within 2 hours, "last
// checked <date>" when it was not, and left out when it is unknown. CLAUDE.md: never invent
// facts/dates; no placeholder UI: it renders nothing rather than guess.
import '@/features/map/components/HudStatusLine.css';

function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** statusLineText(paused, gdacs) -> the one line, or null when not paused. Pure (tested). */
export function statusLineText(paused, gdacs) {
  if (!paused) return null;
  const parts = [
    paused.beyondLookback
      ? `New stories and analysis paused · ${paused.text}`
      : `New stories and analysis paused since ${paused.label}`,
  ];
  if (gdacs?.state === 'live') parts.push('disaster alerts live');
  else if (gdacs?.state === 'stale' && gdacs.checkedAt && fmtDate(gdacs.checkedAt)) parts.push(`disaster alerts last checked ${fmtDate(gdacs.checkedAt)}`);
  return parts.join(' · ');
}

export default function HudStatusLine({ paused, gdacs }) {
  const text = statusLineText(paused, gdacs);
  if (!text) return null;
  return (
    <div className="hud-status-line" role="status">
      <span className="hud-status-dot" aria-hidden="true">●</span>
      <span className="hud-status-text" title={text}>{text}</span>
    </div>
  );
}
