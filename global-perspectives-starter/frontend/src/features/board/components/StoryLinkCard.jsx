// StoryLinkCard: one story on a public board (SPEC §3.1): its crisis-hue edge, category, link count and change mark;
// the title as a link to the story page; the facts line; then what it feeds, what feeds it, and the names it only
// shares with another story (a note, never a line). Facts a story view did not supply are left out, never dashed.
import Card from '@/shared/ui/Card.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import EntryRole from '@/shared/ui/EntryRole.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import { shortDay, sinceText } from '@/shared/ui/StoryCard.jsx';
import { crisisHueForCategory } from '@/shared/lib/crisisHue.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import LinkSign from '@/shared/ui/LinkSign.jsx';
import { signEligible } from '@/shared/lib/linkLine.js';
import StrengthBars from '@/shared/ui/StrengthBars.jsx';
import { linkCountText, markText, stripEvidence } from '@/features/board/lib/linkedBoard.js';

export const cardDomId = (id) => `bl-${id}`;
export const cardHref = (id) => `#bl-${id}`; // the in-page link to a card

// The board row's sign: the other story's striped square and its places not already this card's (the card is this story). The
// places are the story page's (`placesOf` reads the same links views); none known: "places not given". As on every other page, only
// a medium or strong link carries the sign (`signEligible`); a weak link keeps its row, wording and bars.
function RowSign({ other, places, strength }) {
  return signEligible(strength) ? <LinkSign showMine={false} otherCategory={other.category} places={places} /> : null;
}

function StoryRef({ story }) {
  return <a className="bl-row__story" href={cardHref(story.id)} title={story.title}>{story.title}</a>;
}

export default function StoryLinkCard({ story, rows, storyOf, placesOf = () => null, mark, mode }) {
  const count = linkCountText(rows);
  const tier = story.tier || (story.riskScore != null ? tierFromScore(story.riskScore) : null);
  const role = story.newest?.role || null;
  const since = story.stepCount > 1 ? sinceText(story) : '';
  return (
    <Card as="article" className="bl-card" id={cardDomId(story.id)} style={{ '--edge': crisisHueForCategory(story.category) }} data-story={story.id}>
      <div className="bl-card__top">
        <CategoryTag category={story.category} />
        {count ? <span className="bl-card__count">{count}</span> : null}
        {mark ? <span className="bl-card__mark">{markText(mark, mode)}</span> : null}
      </div>
      <h3 className="bl-card__title"><EntityLink kind="story" id={story.id}>{story.title}</EntityLink></h3>
      <div className="bl-card__facts">
        {role ? <EntryRole role={role} /> : null}
        {story.newest ? <span className={`bl-card__date${mark === 'stepped' ? ' is-moved' : ''}`}>newest step {shortDay(story.newest.date)}</span> : null}
        {since ? <span className="bl-card__date">{since}</span> : null}
        <span className="bl-card__serious">
          How serious:{' '}
          {tier ? <TierChip tier={tier} score={story.riskScore} /> : <span className="bl-card__unrated">not rated yet</span>}
        </span>
      </div>
      {rows.feeds.map((l) => (
        <div key={`f-${l.to}`} className="bl-row">
          <span className="bl-row__dir">→ feeds into</span>
          <RowSign other={storyOf(l.to)} places={placesOf(story.id, l.to)} strength={l.strength} />
          <StoryRef story={storyOf(l.to)} />
          <StrengthBars strength={l.strength} />
          {l.reason ? (
            <details className="bl-why">
              <summary>why <span aria-hidden="true">▸</span></summary>
              <p className="bl-why__text"><ClaimTag kind="judgment" /> {stripEvidence(l.reason)}</p>
            </details>
          ) : null}
        </div>
      ))}
      {rows.fedBy.map((l) => (
        <div key={`b-${l.from}`} className="bl-row">
          <span className="bl-row__dir">← fed by</span>
          <RowSign other={storyOf(l.from)} places={placesOf(story.id, l.from)} strength={l.strength} />
          <StoryRef story={storyOf(l.from)} />
          <StrengthBars strength={l.strength} />
        </div>
      ))}
      {rows.notes.map((n) => (
        <p key={`n-${n.other}`} className="bl-note">
          <span aria-hidden="true">⋯ </span>Also named in both with <StoryRef story={storyOf(n.other)} />: {n.names.join(', ')}. Not a judged link.
        </p>
      ))}
    </Card>
  );
}
