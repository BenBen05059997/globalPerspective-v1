import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import StrengthBars from '@/shared/ui/StrengthBars.jsx';
import { useStoryLinkLine } from '@/shared/hooks/useStoryLinkLine.js';
import '@/shared/ui/blocks.css';

// StoryLinkLine — the one link line of a story card, in the board's words: "→ feeds into" / "← fed by", the other story, its
// strength (the board's bars and word), the MODEL JUDGMENT tag, and "confirmed in our weekly review" only for a link the weekly
// review confirmed. No link, or still loading: nothing (no placeholder). `id` is the story, `aliasId` the story it is an alias of.
export default function StoryLinkLine({ id, aliasId = null, className = '' }) {
  const line = useStoryLinkLine(id, aliasId);
  if (!line) return null;
  return (
    <p className={`gp-linkline ${className}`.trim()} data-testid="story-link-line">
      <span className="gp-linkline__dir">{line.dir === 'feeds' ? '→ feeds into' : '← fed by'}</span>
      <EntityLink kind="story" id={line.otherId} topic={{ title: line.title }} className="gp-linkline__story gp-hit">{line.title}</EntityLink>
      <StrengthBars strength={line.strength} />
      <ClaimTag kind="judgment" />
      {line.confirmed ? <span className="gp-linkline__note">confirmed in our weekly review</span> : null}
    </p>
  );
}
