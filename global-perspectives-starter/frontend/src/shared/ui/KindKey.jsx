import EntryRole from '@/shared/ui/EntryRole.jsx';
import '@/shared/ui/blocks.css';

// KindKey — each kind chip with its plain line (SPEC §2 Map banner, §5 "?" page). One place for the words.
const LINE = {
  move: 'a new step in a story we already follow.',
  start: 'the first step of a new story.',
  measure: 'an official figure or a major study.',
};

export default function KindKey({ kinds = ['move', 'start'], className = '' }) {
  return (
    <p className={`gp-kindkey ${className}`.trim()}>
      {kinds.map((k) => (
        <span key={k} className="gp-kindkey__item"><EntryRole role={k} />{LINE[k]}</span>
      ))}
    </p>
  );
}
