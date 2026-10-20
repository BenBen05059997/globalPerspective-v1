import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';

// "What is missing": actors that appear on two or more of your pins and that you do not follow. Built only from
// the connect tests already run this session, so it fills as you test pairs; with none it says so.
export default function MissingCard({ actors, onFollow }) {
  return (
    <Card as="section" aria-label="What is missing">
      <SectionHeader label="What is missing" hint="Actors on two or more of your pins that you do not follow" as="h2" />
      {actors.length ? (
        <ul className="board-list">
          {actors.map((a) => (
            <li key={a.name} className="board-list__row">
              <span className="board-list__label">{a.name} <span className="board-note">on {a.pins.length} pins</span></span>
              <Button compact onClick={() => onFollow(a.name)} aria-label={`Follow ${a.name}`}>Follow</Button>
            </li>
          ))}
        </ul>
      ) : <p className="board-line">Nothing yet. Test pairs of pins; shared actors you do not follow show up here.</p>}
    </Card>
  );
}
