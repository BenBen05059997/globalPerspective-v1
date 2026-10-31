import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

// "What is missing": actors that appear on two or more of your pins and that you do not follow. Built only from
// the connect tests already run this session, so it fills as you test pairs; with none it is absent. The same
// actors are drawn on the graph as suggested pins.
export default function MissingCard({ actors, full = false, onFollow, onAdd }) {
  if (!actors.length) return null;
  return (
    <Card as="section" className="board-missing" aria-label="What is missing">
      <SectionHeader label="What is missing" as="h2" />
      <ul className="board-list">
        {actors.map((a) => (
          <li key={a.name} className="board-list__row">
            <span className="board-list__label">{a.pins.length} of your pins touch {a.name}. You do not follow it.</span>
            <span className="board-actions">
              {!full ? <Button compact onClick={() => onAdd(a.name)} aria-label={`Add pin ${a.name}`}>Add pin</Button> : null}
              <Button compact onClick={() => onFollow(a.name)} aria-label={`Follow ${a.name}`}>Follow</Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
