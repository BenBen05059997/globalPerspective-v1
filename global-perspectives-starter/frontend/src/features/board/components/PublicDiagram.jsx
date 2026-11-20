// PublicDiagram: a public board as a drawing ("Show as a diagram" or "Map", board look SPEC §2.10): the live BoardGraph
// or BoardMap, then the board's Pins and Strings lists as before. The SPEC drops those two lists from the public
// preview; that removal is not approved, so they stay here, under the drawing.
import BoardGraph from '@/features/board/components/BoardGraph.jsx';
import BoardMap from '@/features/board/components/BoardMap.jsx';
import RecordPinDetails from '@/features/board/components/RecordPinDetails.jsx';
import { stringLabel } from '@/features/board/lib/graphText.js';
import { pinLabel } from '@/features/board/lib/boardOps.js';
import { pairKey } from '@/shared/lib/board.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import Card from '@/shared/ui/Card.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';

export default function PublicDiagram({ pins, strings, view, stories, today }) {
  const info = Object.fromEntries(pins.map((pin) => [pin.pinId, {
    ...pinLabel(pin, { [pin.refId]: pin.title }, { [pin.refId]: pin.riskScore }),
    category: pin.category || stories[pin.refId]?.category,
  }]));
  const Drawing = view === 'map' ? BoardMap : BoardGraph;
  return (
    <>
      <Drawing pins={pins} strings={strings} info={info} stories={stories} today={today} />
      <Card as="section" aria-label="Board pins">
        <SectionHeader as="h2" label="Pins" count={pins.length} />
        <ul className="board-pinlist">
          {pins.map((pin) => {
            const { label, risk } = info[pin.pinId];
            return (
              <li key={pin.pinId}>
                <div className="board-pinrow">
                  <EntityLink kind="story" id={pin.refId}>{label}</EntityLink>
                  {risk != null ? <TierChip tier={tierFromScore(risk)} score={risk} /> : null}
                </div>
                <RecordPinDetails pin={pin} story={stories[pin.refId]} today={today} />
              </li>
            );
          })}
        </ul>
      </Card>
      {strings.length ? (
        <Card as="section" aria-label="Board strings">
          <SectionHeader as="h2" label="Strings" count={strings.length} />
          <ul className="board-pinlist">
            {strings.map((string) => {
              const { head, body } = stringLabel(string);
              return (
                <li key={pairKey(string.a, string.b)}>
                  <strong>{info[string.a]?.label} / {info[string.b]?.label}</strong>
                  <span className="board-note">{head}</span>
                  {body ? <p className="board-line">{body}</p> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
