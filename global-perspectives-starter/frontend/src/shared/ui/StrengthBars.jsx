// StrengthBars: a judged link's strength as three small bars, filled 1, 2 or 3, and always its word (SPEC §3.2).
// Shared by the board cards and the story-link line (story page, Home). No lag, ever. A link with no stamped strength shows nothing here.
import '@/shared/ui/blocks.css';

const FILLED = { weak: 1, medium: 2, strong: 3 };

export default function StrengthBars({ strength }) {
  const n = FILLED[strength];
  if (!n) return null;
  return (
    <span className="gp-strength">
      <span className="gp-strength__bars" aria-hidden="true">
        {[1, 2, 3].map((i) => <span key={i} className={`gp-strength__bar${i <= n ? ' is-on' : ''}`} />)}
      </span>
      <span className="gp-strength__word">{strength}</span>
    </span>
  );
}
