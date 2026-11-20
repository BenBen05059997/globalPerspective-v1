// StrengthBars: a judged link's strength as three small bars, filled 1, 2 or 3, and always its word (SPEC §3.2).
// No lag, ever. A link with no stamped strength shows nothing here.
const FILLED = { weak: 1, medium: 2, strong: 3 };

export default function StrengthBars({ strength }) {
  const n = FILLED[strength];
  if (!n) return null;
  return (
    <span className="bl-strength">
      <span className="bl-strength__bars" aria-hidden="true">
        {[1, 2, 3].map((i) => <span key={i} className={`bl-strength__bar${i <= n ? ' is-on' : ''}`} />)}
      </span>
      <span className="bl-strength__word">{strength}</span>
    </span>
  );
}
