import { Fragment } from 'react';
import EntityLink from '@/shared/ui/EntityLink.jsx';

// PlaceLinks — the places a brief item names (top story regions, a signal's "A · B"), each an
// EntityLink to its country page; a region, bloc or sea renders as plain text.
//   names      place names as the brief carries them
//   className  per place (a tag style)
//   sep        text between places (none by default: tag styles space themselves)
export default function PlaceLinks({ names, className, sep = null }) {
  return (names || []).map((name, i) => (
    <Fragment key={name}>
      {sep && i > 0 ? sep : null}
      <EntityLink kind="country" id={name} className={className}>{name}</EntityLink>
    </Fragment>
  ));
}
