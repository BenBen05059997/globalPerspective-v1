// StoryLinkCard: one story on a public board (SPEC §3.1): its crisis-hue edge, category, link count and change mark;
// the title as a link to the story page; the facts line; then what it feeds, what feeds it, and the names it only
// shares with another story (a note, never a line). Facts a story view did not supply are left out, never dashed.
import Card from '@/shared/ui/Card.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import EntryRole from '@/shared/ui/EntryRole.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import { shortDay } from '@/shared/ui/StoryCard.jsx';
import { crisisHueForCategory } from '@/shared/lib/crisisHue.js';
import { tierFromScore } from '@/shared/lib/riskTiers.js';
import StrengthBars from '@/features/board/components/StrengthBars.jsx';
import { linkCountText, markText, stripEvidence } from '@/features/board/lib/linkedBoard.js';

export const cardDomId = (id) => `bl-${id}`;
export const cardHref = (id) => `#bl-${id}`; // the in-page link to a card

function StoryRef({ story }) {
  return <a className="bl-row__story" href={cardHref(story.id)} title={story.title}>{story.title}</a>;
}

export default function StoryLinkCard({ story, rows, storyOf, mark, mode }) {
  const count = linkCountText(rows);
  const tier = story.tier || (story.riskScore != null ? tierFromScore(story.riskScore) : null);
  const role = story.newest?.role && story.newest.role !== 'move' ? story.newest.role : null;
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
        {story.stepCount || story.born ? (
          <span className="bl-card__date">
            {[story.stepCount && `${story.stepCount} ${story.stepCount === 1 ? 'step' : 'steps'}`, story.born && `began ${shortDay(story.born)}`].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        <span className="bl-card__serious">
          How serious:{' '}
          {tier ? <TierChip tier={tier} score={story.riskScore} /> : <span className="bl-card__unrated">not rated yet</span>}
        </span>
      </div>
      {rows.feeds.map((l) => (
        <div key={`f-${l.to}`} className="bl-row">
          <span className="bl-row__dir">→ feeds into</span>
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
