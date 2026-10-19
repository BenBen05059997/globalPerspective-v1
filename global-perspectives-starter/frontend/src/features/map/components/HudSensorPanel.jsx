// HudSensorPanel — top-right HUD panel: one row per data source, in plain words, with a
// freshness dot. Never says "live"/"updated" for a source that hasn't actually produced
// anything fresh — CLAUDE.md: no placeholder/misleading UI, fail honest.
//
// Rows are pre-computed by the caller (SituationHome, which already owns fmtAgo/fmtIn and the
// world bundle) and passed in as plain { text, ok } descriptors, so this component stays a pure
// renderer and there is exactly one place in the app that turns timestamps into "N min ago".
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

export default function HudSensorPanel({ rows }) {
  if (!rows?.length) return null;
  return (
    <Card level="hud" pad="sm" className="hud-panel hud-sensor" role="region" aria-label="Sensor status">
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <SectionHeader label="Sensor status" />
      <ul className="hud-sensor-list">
        {rows.map((row) => (
          <li key={row.key} className="hud-sensor-row">
            <span className={`hud-sensor-dot${row.ok ? '' : ' hud-sensor-dot-warn'}`} aria-hidden="true" />
            <span className="hud-sensor-name">{row.name}</span>
            <span className="hud-sensor-text">{row.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
