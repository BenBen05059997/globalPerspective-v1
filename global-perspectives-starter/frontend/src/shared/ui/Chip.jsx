import '@/shared/ui/primitives.css';

// Chip — a filter chip: a toggle <button> with aria-pressed. Selected = the one "selected" style
// (accent outline + accent text), never a fill. 32px visual on a mouse, 44px on touch.
//   selected  bool
//   onClick   toggle handler
//   count     optional dim number after the label
//   dot       optional CSS colour for a leading dot. ONLY a crisis hue (var(--hue-*)) for a crisis-type
//             filter — never a tier or status colour (tier is a word, status is a state).
//   ...rest   passed to the <button> (title, aria-*, disabled, ...)
export default function Chip({ selected = false, onClick, count = null, dot = null, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`gp-chip${selected ? ' gp-chip--selected' : ''} ${className}`.trim()}
      aria-pressed={!!selected}
      onClick={onClick}
      style={dot ? { '--chip-dot': dot } : undefined}
      {...rest}
    >
      {dot ? <span className="gp-chip__dot" aria-hidden="true" /> : null}
      {children}
      {count != null ? <span className="gp-chip__count">{count}</span> : null}
    </button>
  );
}
