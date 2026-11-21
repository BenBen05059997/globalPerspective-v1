import { useState } from 'react';
import { shortDate } from '@/features/threads/lib/storyMode.js';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import { distinctTargets } from '@/features/threads/lib/webIndexLinks.js';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import StrengthBars from '@/shared/ui/StrengthBars.jsx';
import LinkSign from '@/shared/ui/LinkSign.jsx';
import { useLinksView } from '@/shared/api/linksView.js';
import { pairPlaces, signEligible } from '@/shared/lib/linkLine.js';
import { useWebIndex } from '@/features/threads/hooks/useWebIndex.js';
import '@/features/threads/components/FedIntoList.css';

// FedIntoList — the one rendering of a story-link row, shared by
// StoryMode's FED INTO slide, the Read-in-full Timeline "Show linked news" toggle, and the
// Read-in-full "Why" section, so the wording and fields never drift between the three surfaces.
// `direction`: 'into' (this story feeds the target — FedIntoSlide) or 'from' (the source story
// fed into this one — "← fed by"). Every field is read straight off the
// derived link record (webIndexLinks.js); nothing here invents a date, a headline or a confidence. The words are the board's:
// "→ feeds into" / "← fed by", the strength as the board's bars and word, the MODEL JUDGMENT tag. A lag below zero is a wrong
// value (an effect dated before its cause) and is not shown; a lag of zero or more stays as it was.
//
// The link sign (LinkSign) heads a row when the caller passes `story` ({ id, category }: the story this list belongs to) and the
// row's link is medium or strong: this story = solid square, the other = striped, the arrow by `direction`. A weak or unrated
// row keeps its words and gets no sign. Places: the story's own links view (the one the page already reads, no new request);
// the other story's colour: the story-web index (one shared read). Without `story` no sign is drawn.
export default function FedIntoList({ links, direction = 'into', story = null }) {
  const view = useLinksView(story?.id || null).data;
  const { index } = useWebIndex(Boolean(story?.id));
  if (!links?.length) return null;
  return (
    <ul className="fi-list">
      {links.map((link) => {
        const targetId = direction === 'into' ? link.targetThreadId : link.sourceThreadId;
        const targetTitle = direction === 'into' ? link.targetTitle : link.sourceTitle;
        return (
          <li key={`${targetId}-${link.country || ''}`} className={`fi-row${link.freshness === 'older' ? ' fi-older' : ''}`}>
            <div className="fi-head">
              {story?.id && signEligible(link.confidence) ? (
                <span className="gp-linkline__sign">
                  <LinkSign dir={direction === 'into' ? 'feeds' : 'fed'} mineCategory={story.category || null} otherCategory={index?.threads?.[targetId]?.category || null} places={pairPlaces([story.id], [view], targetId)} />
                </span>
              ) : null}
              <span className="fi-dir">{direction === 'into' ? '→ feeds into' : '← fed by'}</span>
              <EntityLink
                kind="story" id={targetId}
                target="_blank"
                rel="noreferrer"
                topic={targetTitle ? { title: targetTitle } : null}
                hint="Open in a new tab"
              >
                {targetTitle || targetId}
              </EntityLink>
              {link.confidence ? <StrengthBars strength={link.confidence} /> : <span className="fi-unrated">unrated</span>}
              <ClaimTag kind="judgment" />
            </div>
            <div className="fi-meta">
              {link.lagDays != null && link.lagDays >= 0 && <span>lag {link.lagDays}d (model)</span>}
              {link.country && <span>from {link.country}&apos;s analysis{link.generatedAt ? `, as of ${shortDate(link.generatedAt)}` : ''}</span>}
              {link.freshness === 'older' && <span className="fi-older-tag">older analysis</span>}
            </div>
            {link.mechanism && <p className="fi-mechanism">&ldquo;{link.mechanism}&rdquo;</p>}
            {link.cited?.length > 0 ? (
              <ul className="fi-cited-list" aria-label="Cited headlines">
                {link.cited.slice(0, 3).map((c) => (
                  <li key={c.topicId}>{c.date ? <span className="fi-cited-date">{shortDate(c.date)} </span> : null}{c.title}</li>
                ))}
                {link.cited.length > 3 && <li className="fi-cited-more">+{link.cited.length - 3} more cited headline{link.cited.length - 3 !== 1 ? 's' : ''}</li>}
              </ul>
            ) : link.citedEntries?.length > 0 && (
              <div className="fi-cited">{link.citedEntries.length} cited headline{link.citedEntries.length !== 1 ? 's' : ''} in this story&apos;s own analysis</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FedIntoToggle({ label, links, direction, story = null, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!links?.length) return null;
  return (
    <div className="fi-toggle-wrap">
      <Button compact aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} ({distinctTargets(links, direction === 'into' ? 'targetThreadId' : 'sourceThreadId')}) {open ? '▴' : '▾'}
      </Button>
      {open && <FedIntoList links={links} direction={direction} story={story} />}
    </div>
  );
}
