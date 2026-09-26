// AlertStack — the console's alert stack (Console.dc.html, R4a): open situations (GDACS alerts +
// news situations) as small cards at the map's edge, most severe / newest first
// (lib/alertStack.js). A card click selects the situation and the map flies to it. Replaces the
// need for /breaking on desktop (the route itself stays). The phone ALERTS tab reuses this same
// component full width. Empty = one honest, computed line — never "the map is quiet".
import { AXIS_HUE } from '@/features/map/components/SituationMap.jsx';
import { TIER_LABEL, iso3Name } from '@/features/map/lib/situationLabels.js';
import { gdacsLevelBadge } from '@/features/map/lib/gdacsLevel.js';
import { markerKind, kindLabel, statusGlyph, situationFreshness, markerHex } from '@/features/map/lib/legend.js';
import { ageShort } from '@/features/map/lib/alertStack.js';

const AXIS_LABEL = { conflict: 'Conflict', political: 'Political', economic: 'Economic', humanitarian: 'Humanitarian' };

function placeOf(s) {
  if (s.affected_names?.length) return s.affected_names[0];
  if (s.iso3_affected?.length) return iso3Name(s.iso3_affected[0]);
  return null;
}

export function AlertCard({ s, selected = false, onSelect, now = Date.now() }) {
  const kind = markerKind(s);
  const fresh = situationFreshness(s, now);
  const glyph = statusGlyph(s);
  const level = gdacsLevelBadge(s);
  const place = placeOf(s);
  const age = ageShort(s, now);
  const pin = markerHex(AXIS_HUE[s.axis] || '#9aa4b2', fresh);
  return (
    <li className={`al-item${selected ? ' al-item-on' : ''}`}>
      <button
        type="button"
        className={`al-card al-fresh-${fresh}`}
        aria-pressed={selected}
        onClick={() => onSelect && onSelect(s.id)}
        style={{ '--pin': pin }}
      >
        <span className={`al-mark al-mark-${kind}`} aria-hidden="true" />
        <span className="al-body">
          <span className="al-top">
            <span className="al-kind">{kind === 'alert' ? 'GDACS' : (AXIS_LABEL[s.axis] || s.axis)}</span>
            {place ? <span className="al-place">{place}</span> : null}
            <span className="al-age">{age}</span>
          </span>
          <span className="al-title">{s.verb_label}</span>
          <span className="al-tags">
            <span className={`al-tier al-tier-${s.tier}`}>{TIER_LABEL[s.tier] || s.tier}</span>
            {level ? <span className="sh-gdacs-badge sh-gdacs-badge-sm">{level}</span> : null}
            {glyph ? (
              <span className="al-glyph">
                <span aria-hidden="true">{glyph.glyph}</span> {glyph.label}
              </span>
            ) : null}
            {fresh === 'older' ? <span className="al-older">older</span> : null}
            <span className="sh-sr-only">{kindLabel(kind)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

export default function AlertStack({
  items = [], hiddenCount = 0, focusId = null, onSelect, emptyText, note = null, label = 'Alerts', className = '',
}) {
  const now = Date.now();
  return (
    <section className={`hud-panel al-stack ${className}`.trim()} role="region" aria-label={label}>
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <div className="hud-label al-head">
        {label}
        <span className="hud-feed-count"> · {items.length} open</span>
      </div>
      {items.length ? (
        <ul className="al-list">
          {items.map((s) => (
            <AlertCard key={s.id} s={s} selected={s.id === focusId} onSelect={onSelect} now={now} />
          ))}
        </ul>
      ) : (
        <p className="al-empty">{emptyText}</p>
      )}
      {note ? <p className="al-note">{note}</p> : null}
      {hiddenCount ? (
        <p className="al-note">
          {hiddenCount} open situation{hiddenCount === 1 ? '' : 's'} not updated in 30+ days — hidden from the map.
        </p>
      ) : null}
    </section>
  );
}
