import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import LinkSign from '@/shared/ui/LinkSign.jsx';
import StrengthBars from '@/shared/ui/StrengthBars.jsx';
import { useStoryCategory } from '@/shared/api/storyCategory.js';
import { useStoryLinkLine } from '@/shared/hooks/useStoryLinkLine.js';
import '@/shared/ui/blocks.css';

// StoryLinkLine — the one link line of a story card, in the board's words: "→ feeds into" / "← fed by", the other story, its
// strength (the board's bars and word), the MODEL JUDGMENT tag, and "confirmed in our weekly review" only for a link the weekly
// review confirmed. No link, or still loading: nothing (no placeholder). `id` is the story, `aliasIds` the other records that stand for it (the survivor it is an alias of, the stories merged into it), `category` this story's category (its crisis colour in the sign).
// The sign (LinkSign) comes first: this story's places, the arrow, the other story's places.
export default function StoryLinkLine({ id, aliasIds = [], category = null, className = '' }) {
  const line = useStoryLinkLine(id, aliasIds);
  const otherCategory = useStoryCategory(line?.otherId);
  if (!line) return null;
  return (
    <p className={`gp-linkline ${className}`.trim()} data-testid="story-link-line">
      <span className="gp-linkline__sign"><LinkSign dir={line.dir} mineCategory={category} otherCategory={otherCategory} places={line.places} /></span>
      <span className="gp-linkline__dir">{line.dir === 'feeds' ? '→ feeds into' : '← fed by'}</span>
      <EntityLink kind="story" id={line.otherId} topic={{ title: line.title }} className="gp-linkline__story gp-hit">{line.title}</EntityLink>
      <StrengthBars strength={line.strength} />
      <ClaimTag kind="judgment" />
      {line.confirmed ? <span className="gp-linkline__note">confirmed in our weekly review</span> : null}
    </p>
  );
}
