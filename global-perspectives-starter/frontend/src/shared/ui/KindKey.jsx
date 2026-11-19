import EntryRole from '@/shared/ui/EntryRole.jsx';
import '@/shared/ui/blocks.css';

// KindKey — each kind chip with its plain line (SPEC §2 Map banner, §5 "?" page). One place for the words.
const LINE = {
  move: 'a new step in a story we already follow.',
  start: 'the first step of a new story.',
  measure: 'an official figure or a major study.',
};

// `oneLine`: the kinds side by side, joined by " · " and without the closing full stops (desktop Map box, design round 8).
export default function KindKey({ kinds = ['move', 'start'], className = '', oneLine = false }) {
  return (
    <p className={`gp-kindkey${oneLine ? ' gp-kindkey--line' : ''} ${className}`.trim()}>
      {kinds.map((k, i) => (
        <span key={k} className="gp-kindkey__item">
          <EntryRole role={k} />{oneLine ? LINE[k].replace(/\.$/, '') : LINE[k]}
          {/* The dot closes the item, so a narrow box that wraps never starts a line with it. */}
          {oneLine && i < kinds.length - 1 ? <span className="gp-kindkey__sep" aria-hidden="true">·</span> : null}
        </span>
      ))}
    </p>
  );
}
