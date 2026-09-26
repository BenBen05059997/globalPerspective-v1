// StoryPeek — the one shared hover/focus preview for a story mention (M5a). Pure presentational:
// all data comes from `peekData()` (src/shared/lib/peekData.js). Nothing inside is clickable —
// the whole card is `role="tooltip"`, described by the trigger via `aria-describedby`. Rendered
// only while `usePeek()` says it should be open.
export default function StoryPeek({ id, data, style }) {
  if (!data) return null;
  const { category, hue, headline, primaryCountry, sourcesLabel, updatedLabel, hint } = data;
  return (
    <div id={id} role="tooltip" className="gp-story-peek" style={style}>
      {category ? (
        <div className="gp-story-peek-cat">
          <span className="gp-story-peek-dot" style={{ background: hue || '#9aa4b2' }} aria-hidden="true" />
          {category}
        </div>
      ) : null}
      <div className="gp-story-peek-title">{headline}</div>
      {(primaryCountry || sourcesLabel) ? (
        <div className="gp-story-peek-meta">
          {primaryCountry ? <span>{primaryCountry}</span> : null}
          {sourcesLabel ? <span>{sourcesLabel}</span> : null}
        </div>
      ) : null}
      {updatedLabel ? <div className="gp-story-peek-updated">{updatedLabel}</div> : null}
      <div className="gp-story-peek-hint">{hint}</div>
    </div>
  );
}
