import { useState } from 'react';
import { shortDate } from '@/features/threads/lib/storyMode.js';
import StoryLink from '@/shared/ui/StoryLink.jsx';

const CONF_DOTS = { strong: 3, medium: 2, weak: 1 };

// FedIntoList — the one rendering of a story-link row (STORY_WEB_RETHINK_PLAN §5.2b/c), shared by
// StoryMode's FED INTO slide, the Read-in-full Timeline "Show linked news" toggle, and the
// Read-in-full "Why" section, so the wording and fields never drift between the three surfaces.
// `direction`: 'into' (this story feeds the target — FedIntoSlide) or 'from' (the source story
// fed into this one — "earlier news judged to feed in"). Every field is read straight off the
// derived link record (storyLinks.js); nothing here invents a date, a headline or a confidence.
export default function FedIntoList({ links, direction = 'into' }) {
  if (!links?.length) return null;
  return (
    <ul className="fi-list">
      {links.map((link) => {
        const targetId = direction === 'into' ? link.targetThreadId : link.sourceThreadId;
        const targetTitle = direction === 'into' ? link.targetTitle : link.sourceTitle;
        return (
          <li key={`${targetId}-${link.country || ''}`} className={`fi-row${link.freshness === 'older' ? ' fi-older' : ''}`}>
            <div className="fi-head">
              <StoryLink
                threadId={targetId}
                target="_blank"
                rel="noreferrer"
                topic={targetTitle ? { title: targetTitle } : null}
                hint="Open in a new tab"
              >
                {targetTitle || targetId}
              </StoryLink>
              <span className={`fi-conf-badge fi-conf-${link.confidence || 'weak'}`}>
                {link.confidence ? `${'●'.repeat(CONF_DOTS[link.confidence] || 1)} ${link.confidence}` : 'unrated'} · model judgment
              </span>
            </div>
            <div className="fi-meta">
              {link.lagDays != null && <span>lag {link.lagDays}d (model)</span>}
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

export function FedIntoToggle({ label, links, direction, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!links?.length) return null;
  return (
    <div className="fi-toggle-wrap">
      <button type="button" className="fi-toggle-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} ({links.length}) {open ? '▴' : '▾'}
      </button>
      {open && <FedIntoList links={links} direction={direction} />}
    </div>
  );
}
