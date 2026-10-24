import Button from '@/shared/ui/Button.jsx';
import { Link } from 'react-router';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Region presets: a starting board of the region's highest-risk stories with the strings we infer between
// them. Listing is public; forking needs a member.
export default function PresetsPanel({ presets, loading, canFork, signInHref, onFork }) {
  if (loading && !presets.length) return <p className="board-line">Loading presets.</p>;
  if (!presets.length) return <p className="board-line">No region presets are available right now.</p>;
  return (
    <ul className="board-list">
      {presets.map((p) => (
        <li key={p.presetId} className="board-list__row">
          <span className="board-list__label">
            <strong>{p.name}</strong>
            <span className="board-note"> {plural(p.pins.length, 'pin')}, {plural(p.strings.length, 'string')}</span>
          </span>
          {canFork
            ? <Button compact onClick={() => onFork(p)} aria-label={`Fork ${p.name}`}>Fork</Button>
            : <Link className="board-link" to={signInHref}>Sign in to fork</Link>}
        </li>
      ))}
    </ul>
  );
}
