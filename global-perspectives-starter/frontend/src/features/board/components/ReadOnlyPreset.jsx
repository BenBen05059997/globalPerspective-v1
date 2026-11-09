import { useState } from 'react';
import { Link } from 'react-router';
import BoardGraph from '@/features/board/components/BoardGraph.jsx';
import BoardMap from '@/features/board/components/BoardMap.jsx';
import RecordPinDetails from '@/features/board/components/RecordPinDetails.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import { stringLabel } from '@/features/board/lib/graphText.js';
import { pinLabel } from '@/features/board/lib/boardOps.js';
import { pairKey } from '@/shared/lib/board.js';
import { boardHref } from '@/shared/lib/links.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';

export default function ReadOnlyPreset({ preset, today }) {
  const [view, setView] = useState('graph');
  const { pins, strings } = preset;
  const { stories } = useStoryViews(pins);
  const info = Object.fromEntries(pins.map((pin) => [pin.pinId, {
    ...pinLabel(pin, { [pin.refId]: pin.title }, { [pin.refId]: pin.riskScore }),
    category: pin.category || stories[pin.refId]?.category,
  }]));
  const Drawing = view === 'graph' ? BoardGraph : BoardMap;

  return (
    <>
      <Link className="board-link" to={boardHref()}>← All region presets</Link>
      <Card as="section" aria-label={preset.name}>
        <SectionHeader as="h2" label={preset.name} hint="Read-only preview" />
        <div className="board-pinrow" role="group" aria-label="Preset view">
          <Button compact selected={view === 'graph'} onClick={() => setView('graph')}>Graph</Button>
          <Button compact selected={view === 'map'} onClick={() => setView('map')}>Map</Button>
        </div>
        <Drawing pins={pins} strings={strings} info={info} stories={stories} today={today} />
      </Card>
      <Card as="section" aria-label="Preset pins">
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
        <Card as="section" aria-label="Preset strings">
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
