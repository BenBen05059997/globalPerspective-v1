import { useState } from 'react';
import { threadPath } from '@/shared/lib/threadPath';
import { shortDate } from '@/features/threads/lib/storyMode.js';
import { usePeek } from '@/shared/hooks/usePeek';
import StoryPeek from '@/shared/ui/StoryPeek';

const CONF_DOTS = { strong: 3, medium: 2, weak: 1 };

// FedIntoList — the one rendering of a story-link row (STORY_WEB_RETHINK_PLAN §5.2b/c), shared by
// StoryMode's FED INTO slide, the Read-in-full Timeline "Show linked news" toggle, and the
// Read-in-full "Why" section, so the wording and fields never drift between the three surfaces.
// `direction`: 'into' (this story feeds the target — FedIntoSlide) or 'from' (the source story
// fed into this one — "earlier news judged to feed in"). Every field is read straight off the
// derived link record (storyLinks.js); nothing here invents a date, a headline or a confidence.
export default function FedIntoList({ links, direction = 'into' }) {
  const peek = usePeek();
  if (!links?.length) return null;
  return (
    <ul className="fi-list">
      {links.map((link) => {
        const targetId = direction === 'into' ? link.targetThreadId : link.sourceThreadId;
        const targetTitle = direction === 'into' ? link.targetTitle : link.sourceTitle;
        const peekTopic = targetTitle ? { title: targetTitle } : null;
        return (
          <li key={targetId} className={`fi-row${link.freshness === 'older' ? ' fi-older' : ''}`}>
            <div className="fi-head">
              <a
                href={threadPath(targetId)}
                target="_blank"
                rel="noreferrer"
                onMouseEnter={(e) => peekTopic && peek.openOnHover(targetId, e.currentTarget)}
                onMouseLeave={peek.close}
                onFocus={(e) => peekTopic && peek.openOnFocus(targetId, e.currentTarget)}
                onBlur={peek.close}
                aria-describedby={peek.openId === targetId ? `fi-peek-${targetId}` : undefined}
              >
                {targetTitle || targetId}
              </a>
              <span className={`fi-conf-badge fi-conf-${link.confidence || 'weak'}`}>
                {link.confidence ? `${'●'.repeat(CONF_DOTS[link.confidence] || 1)} ${link.confidence}` : 'unrated'} · model judgment
              </span>
              {peek.openId === targetId && peekTopic && (
                <StoryPeek id={`fi-peek-${targetId}`} data={{ headline: targetTitle, hint: 'Open in a new tab' }} style={peek.style} />
              )}
            </div>
            <div className="fi-meta">
              {link.lagDays != null && <span>lag {link.lagDays}d (model)</span>}
              {link.country && <span>from {link.country}&apos;s analysis{link.generatedAt ? `, as of ${shortDate(link.generatedAt)}` : ''}</span>}
              {link.freshness === 'older' && <span className="fi-older-tag">older analysis</span>}
            </div>
            {link.mechanism && <p className="fi-mechanism">&ldquo;{link.mechanism}&rdquo;</p>}
            {link.citedEntries?.length > 0 && (
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
