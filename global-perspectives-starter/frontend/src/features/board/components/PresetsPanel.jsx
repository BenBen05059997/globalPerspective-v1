import Button from '@/shared/ui/Button.jsx';
import { Link } from 'react-router';
import { layoutPins } from '@/features/board/lib/boardOps.js';
import '@/features/board/presets.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const W = 96;
const H = 56;

// A small picture of the preset: its pins on the board's circle, its strings between them.
function MiniGraph({ pins, strings }) {
  const at = layoutPins(pins, W, H);
  return (
    <svg className="preset-card__mini" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {strings.filter((s) => at[s.a] && at[s.b]).map((s) => <line key={`${s.a}-${s.b}`} x1={at[s.a].x} y1={at[s.a].y} x2={at[s.b].x} y2={at[s.b].y} className="preset-card__line" />)}
      {pins.map((p) => <circle key={p.pinId} cx={at[p.pinId].x} cy={at[p.pinId].y} r="3" className="preset-card__pin" />)}
    </svg>
  );
}

// Region presets: a starting board of the region's highest-risk stories with the strings we infer between
// them. Listing is public; forking needs a member. Only region presets exist, so there is one group.
export default function PresetsPanel({ presets, loading, canFork, signInHref, onFork }) {
  if (loading && !presets.length) return <p className="board-line">Loading presets.</p>;
  if (!presets.length) return <p className="board-line">No region presets are available right now.</p>;
  return (
    <div className="presets">
      <h3 className="presets__group">By region</h3>
      <ul className="presets__grid">
        {presets.map((p) => (
          <li key={p.presetId} className="preset-card">
            <span className="preset-card__tag">Ours · read-only</span>
            <strong className="preset-card__name">{p.name}</strong>
            <MiniGraph pins={p.pins} strings={p.strings} />
            <span className="preset-card__foot">
              <span className="board-note">{plural(p.pins.length, 'pin')} · {plural(p.strings.length, 'string')}</span>
              {canFork
                ? <Button compact onClick={() => onFork(p)} aria-label={`Fork ${p.name}`}>Fork →</Button>
                : <Link className="board-link" to={signInHref}>Sign in to fork</Link>}
            </span>
          </li>
        ))}
      </ul>
      <p className="board-note">Presets are ours and read-only. Forking makes a copy that is yours.</p>
    </div>
  );
}
