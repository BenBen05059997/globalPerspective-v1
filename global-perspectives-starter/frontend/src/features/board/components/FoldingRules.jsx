import { FOLD_AFTER_DAYS, DEAD_BRANCH_P, ARRIVALS_SHOWN } from '@/features/board/lib/folding.js';
import '@/features/board/presets.css';

// "How the board folds": what folds, what is written when, the three promises, and where the ideas came from.
// The thresholds come from lib/folding.js, so this page and the code cannot disagree. Folding by cluster of
// pins and by multiple changes on a string is not built, so it is not listed.
const FOLDS = [
  [`Older than ${FOLD_AFTER_DAYS / 7} weeks`, 'One node with a count'],
  [`A branch under ${DEAD_BRANCH_P}%`, 'Folded from the start'],
  ['Many arrivals', `A count on the pin; the strip shows at most ${ARRIVALS_SHOWN}, strongest first`],
];
const WRITTEN = [
  ['One-line chapter and fork summaries', 'Written by the weekly run at the time, dated, never rewritten'],
  ['Paragraph summaries', 'Rewritten weekly and versioned; you can edit yours on your board'],
  ['Counts', 'Computed, never written'],
];
const PROMISES = [
  ['A later run rewrites a dated line', 'The line stays as written'],
  ['Anything is deleted', 'It is only greyed, with its date'],
  ['Anything shown unfolded unless you opened it', 'Folded is the default at every level'],
];
const BORROWED = [
  ['Linkurious / Ogma', 'Groups start collapsed, count badge, group on zoom, summary edges'],
  ['Google News Full Coverage', 'Shared timeline, not personalised'],
  ['Metaculus', 'Forecast as a line over time, hover for any date'],
  ['Kialo / Arguman critique', 'Dense trees hide what matters; context lost on descent'],
  ['i2 Analyst’s Notebook', 'Time view and link view are different charts'],
];

function Rules({ title, note, rows }) {
  return (
    <section className="folding__block" aria-label={title}>
      <h3 className="folding__title">{title}</h3>
      {note ? <p className="board-note">{note}</p> : null}
      <dl className="folding__rows">
        {rows.map(([a, b]) => <div key={a} className="folding__row"><dt>{a}</dt><dd>{b}</dd></div>)}
      </dl>
    </section>
  );
}

export default function FoldingRules() {
  return (
    <div className="folding">
      <Rules title="What folds" note="Folded nodes carry a count; unfolding is your act." rows={FOLDS} />
      <Rules title="What is written when" note="Who writes a line, and when it is fixed." rows={WRITTEN} />
      <Rules title="What never happens" note="Three promises the board keeps." rows={PROMISES} />
      <Rules title="Borrowed from" rows={BORROWED} />
    </div>
  );
}
