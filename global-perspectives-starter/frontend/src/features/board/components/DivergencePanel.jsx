import Button from '@/shared/ui/Button.jsx';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { cutByYou, writtenByYou, forkWeights, weightGap } from '@/features/board/lib/divergence.js';
import '@/features/board/presets.css';

// "Where you differ from us": the reader's own board against ours. Private to the reader.
//   board     the reader's board
//   stories   record story views by thread id (for our branch percentages)
//   labelOf   pinId -> readable name
//   onRestore (a, b) clears a cut      onWeight (forkId, branchId, percent|null) sets the reader's weight
// A part with nothing to show is absent; with no differences at all the panel is absent.
export default function DivergencePanel({ board, stories, labelOf, onRestore, onWeight }) {
  const cuts = cutByYou(board);
  const lines = writtenByYou(board);
  const forks = forkWeights(board, stories);
  if (!cuts.length && !lines.length && !forks.length) return null;
  const pair = (s) => `${labelOf(s.a)} — ${labelOf(s.b)}`;
  let n = 0;
  return (
    <section className="divergence" aria-label="Where you differ from us">
      <p className="divergence__kicker">Private · your board vs ours</p>
      <h2 className="divergence__title">Where you differ from us</h2>
      <p className="board-note">Private. Nobody else sees this view.</p>
      {cuts.length ? <div className="divergence__item">
        <h3 className="divergence__head">{n += 1} · {cuts.length === 1 ? 'A string you cut' : 'Strings you cut'}</h3>
        {cuts.map((s) => <p key={`${s.a}-${s.b}`} className="divergence__row">
          <span>{pair(s)} · cut by you {dayMonth(s.cutAt)}</span>
          <Button compact onClick={() => onRestore(s.a, s.b)} aria-label={`Restore ${pair(s)}`}>Restore?</Button>
        </p>)}
      </div> : null}
      {forks.length ? <div className="divergence__item">
        <h3 className="divergence__head">{n += 1} · Your branch weights</h3>
        {forks.map((f) => <fieldset key={f.forkId} className="divergence__fork">
          <legend>{labelOf(f.pinId)}</legend>
          {f.branches.map((b) => <label key={b.branchId} className="divergence__branch">
            <span>{b.line}{b.text !== b.line ? <span className="board-note"> {b.text}</span> : null}</span>
            <span className="divergence__nums">
              <input type="number" min="0" max="100" inputMode="numeric" value={b.yours ?? ''} placeholder="-"
                aria-label={`Your weight for ${b.line}, percent`}
                onChange={(e) => onWeight(f.forkId, b.branchId, e.target.value === '' ? null : Number(e.target.value))} />
              <span className="board-note">vs {b.ours}</span>
            </span>
          </label>)}
          {weightGap(f) > 0 ? <p className="board-note">Largest gap {weightGap(f)} points. Yours / ours, %.</p> : <p className="board-note">Yours / ours, %. Leave a box empty to follow ours.</p>}
        </fieldset>)}
      </div> : null}
      {lines.length ? <div className="divergence__item">
        <h3 className="divergence__head">{n += 1} · {lines.length === 1 ? 'A line you wrote' : 'Lines you wrote'}</h3>
        {lines.map((s) => <p key={`${s.a}-${s.b}`} className="divergence__row"><span>&ldquo;{s.line}&rdquo;<br /><span className="board-note">{pair(s)}</span></span></p>)}
      </div> : null}
    </section>
  );
}
