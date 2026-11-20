import Button from '@/shared/ui/Button.jsx';
import { Link } from 'react-router';
import { boardHref } from '@/shared/lib/links.js';
import { layoutPins } from '@/features/board/lib/boardOps.js';
import '@/features/board/presets.css';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// '{n} stories · {j} links' from the preset's judged links (newsBoard since the board look); with none judged, says so.
// A preset from before then has no `links`: only the story count.
function presetCount(p) {
  const n = plural(p.pins.length, 'story', 'stories');
  if (!Array.isArray(p.links)) return n;
  return p.links.length ? `${n} · ${plural(p.links.length, 'link', 'links')}` : `${n} · no links judged`;
}
const W = 96;
const H = 56;

// A small picture of the preset: its pins on the board's circle, its strings between them.
function MiniGraph({ pins, strings }) {
  const at = layoutPins(pins, W, H, strings, { x: 4, y: 4 }); // inset by a dot (r 3) so no pin is cut at the edge
  return (
    <svg className="preset-card__mini" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {strings.filter((s) => at[s.a] && at[s.b]).map((s) => <line key={`${s.a}-${s.b}`} x1={at[s.a].x} y1={at[s.a].y} x2={at[s.b].x} y2={at[s.b].y} className="preset-card__line" />)}
      {pins.map((p) => <circle key={p.pinId} cx={at[p.pinId].x} cy={at[p.pinId].y} r="3" className="preset-card__pin" />)}
    </svg>
  );
}

// Region presets: a starting board of the region's highest-risk stories with the strings we infer between
// them. Listing is public; forking needs a member. Only region presets exist, so there is one group.
export default function PresetsPanel({ presets, loading, canFork, onFork }) {
  if (loading && !presets.length) return null; // no placeholder while the list loads
  if (!presets.length) return <p className="board-line">No region presets are available right now.</p>;
  return (
    <div className="presets">
      <ul className="presets__grid">
        {presets.map((p) => {
          const content = (
            <>
              <span className="preset-card__tag">Ours · read-only</span>
              <strong className="preset-card__name">{p.name}</strong>
              <MiniGraph pins={p.pins} strings={p.strings} />
              <span className="preset-card__foot">
                <span className="board-note">{presetCount(p)}</span>
                {canFork
                  ? <Button compact onClick={() => onFork(p)} aria-label={`Fork ${p.name}`}>Fork →</Button>
                  : <span className="board-link">Open preview →</span>}
              </span>
            </>
          );
          return canFork
            ? <li key={p.presetId} className="preset-card">{content}</li>
            : <li key={p.presetId}>
                <Link className="preset-card" to={`${boardHref()}?preset=${encodeURIComponent(p.presetId)}`} aria-label={`Open preview: ${p.name}`}>{content}</Link>
              </li>;
        })}
      </ul>
      <p className="board-note">Presets are ours and read-only. Forking makes a copy that is yours.</p>
    </div>
  );
}
