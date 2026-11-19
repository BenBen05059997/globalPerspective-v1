// AlertStack — the console's alert stack (R4a): open situations (GDACS alerts +
// news situations) as small cards at the map's edge, most severe / newest first
// (lib/alertStack.js). A card click selects the situation and the map flies to it. Replaces the
// need for the retired /breaking feed (that route now redirects). The phone ALERTS tab reuses this same
// component full width. This is the ONE list of situations: every plotted situation is a real <button>
// here (keyboard-reachable twin of the map pins, with the "new" and radar "scanned" marks); the Intel
// feed lists only stories. Alerts of one story are one row (SPEC §2) with a fold listing each alert (each selects its pin). Empty = one honest, computed line — never "the map is quiet".
import { CRISIS_HUE } from '@/shared/lib/crisisHue.js';
import { iso3Name } from '@/shared/lib/situationLabels.js';
import { useState } from 'react';
import { AXIS_LABELS, TIER_ORDER } from '@/shared/lib/riskTiers.js';
import { statusGlyph } from '@/shared/lib/statusGlyph.js';
import TierChip from '@/shared/ui/TierChip.jsx';
import { NewestStepLine, StoryName, storyName } from '@/shared/ui/StoryCard.jsx';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { gdacsLevelBadge } from '@/shared/map/gdacsLevel.js';
import { markerKind, kindLabel, situationFreshness, markerHex } from '@/shared/map/legend.js';
import { ageShort, alertRows, alertStoryId, lastActivity } from '@/features/map/lib/alertStack.js';


function placeOf(s) {
  if (s.affected_names?.length) return s.affected_names[0];
  if (s.iso3_affected?.length) return iso3Name(s.iso3_affected[0]);
  return null;
}

// The row's story line (SPEC §2): the kind of the story's newest step, its date and the story's step count, from the builder's
// stamp; an official disaster alert with no story says so. No stamp: no chip and no step text (the age still shows).
function StoryLine({ s, story, kind, age }) {
  return (
    <span className="al-story">
      {!story && kind === 'alert' && !alertStoryId(s) ? <span className="gp-kind" data-kind="alert">Official alert</span> : <NewestStepLine story={story} />}
      {age ? <span className="al-age">{age}</span> : null}
    </span>
  );
}

const placesOf = (alerts) => [...new Set(alerts.map(placeOf).filter(Boolean))];

// One row per story (SPEC §2). Headline = the story title (stamp), else the best-ranked alert's label. Tier = the highest
// among the alerts; trend = escalating if any is; age = the newest activity. Row click selects the best-ranked pin, as before.
function AlertRow({ row, story = null, focusId = null, newIds = null, scannedIds = null, onSelect, now = Date.now() }) {
  const [open, setOpen] = useState(false);
  const { alerts } = row;
  const s = alerts[0];
  const kind = markerKind(s);
  const fresh = situationFreshness(s, now);
  const top = alerts.reduce((a, b) => ((TIER_ORDER[b.tier] ?? 9) < (TIER_ORDER[a.tier] ?? 9) ? b : a));
  const glyph = statusGlyph(alerts.find((a) => statusGlyph(a)?.key === 'escalating') || s);
  const newest = alerts.reduce((a, b) => (lastActivity(b) > lastActivity(a) ? b : a));
  const level = gdacsLevelBadge(s);
  const places = placesOf(alerts);
  const pin = markerHex(CRISIS_HUE[s.axis] || CRISIS_HUE.neutral, fresh);
  const selected = alerts.some((a) => a.id === focusId);
  const many = alerts.length > 1;
  // Row text (SPEC §6b): the story's name with its tag, else the story title, else the alert's own label.
  const headline = story?.title || s.verb_label;
  const name = storyName(story?.name, headline);
  return (
    <li className={`al-item${selected ? ' al-item-on' : ''}`} style={{ '--pin': pin }}>
      <button
        type="button"
        className={`al-card al-fresh-${fresh}`}
        aria-pressed={selected}
        data-situation-id={s.id}
        onClick={() => onSelect && onSelect(s.id)}
      >
        <span className={`al-mark al-mark-${kind}`} aria-hidden="true" />
        <span className="al-body">
          <StoryLine s={s} story={story} kind={kind} age={ageShort(newest, now)} />
          <span className="al-title">{name ? <StoryName name={name} interactive={false} small /> : headline}</span>
          <span className="al-top">
            <span className="al-kind">{kind === 'alert' ? 'GDACS' : (AXIS_LABELS[s.axis] || s.axis)}</span>
            {places.length ? <span className="al-place" title={places.join(' · ')}>{places.join(' · ')}</span> : null}
          </span>
          <span className="al-tags">
            <TierChip tier={top.tier} />
            {level ? <span className="sh-gdacs-badge">{level}</span> : null}
            {glyph ? (
              <span className="al-glyph">
                <span aria-hidden="true">{glyph.glyph}</span> {glyph.label}
              </span>
            ) : null}
            {fresh === 'older' ? <span className="sh-older">older</span> : null}
            {alerts.some((a) => newIds?.has(a.id)) ? <span className="sh-new">◇ new</span> : null}
            {alerts.some((a) => scannedIds?.has(a.id)) ? <span className="hud-scanned" aria-label="just scanned by the radar sweep">◉ scanned</span> : null}
            <span className="sh-sr-only">{kindLabel(kind)}</span>
          </span>
        </span>
      </button>
      {many ? (
        <>
          <button type="button" className="al-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {alerts.length} alerts on the map {open ? '▴' : '▾'}
          </button>
          {open ? (
            <ul className="al-sub">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button type="button" className="al-sub-btn" aria-pressed={a.id === focusId} data-situation-id={a.id} onClick={() => onSelect && onSelect(a.id)}>
                    <span className="al-sub-label">{a.verb_label}</span>
                    {placeOf(a) ? <span className="al-sub-place">{placeOf(a)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export default function AlertStack({
  items = [], hiddenCount = 0, focusId = null, newIds = null, scannedIds = null, onSelect, emptyText, note = null, label = 'Alerts', className = '',
  storyOf = null,
}) {
  const now = Date.now();
  return (
    <Card as="section" level="hud" pad="sm" className={`hud-panel al-stack ${className}`.trim()} role="region" aria-label={label}>
      <div className="hud-panel-corner hud-panel-corner-tl" aria-hidden="true" />
      <div className="hud-panel-corner hud-panel-corner-br" aria-hidden="true" />
      <SectionHeader className="al-head" label={label} count={`${items.length} open`} />
      <p className="al-note">Stories that are developing, and official disaster alerts.</p>
      {items.length ? (
        <ul className="al-list">
          {alertRows(items).map((row) => (
            <AlertRow key={row.key} row={row} story={storyOf ? storyOf(row.alerts[0]) : null} focusId={focusId} newIds={newIds} scannedIds={scannedIds} onSelect={onSelect} now={now} />
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
    </Card>
  );
}
