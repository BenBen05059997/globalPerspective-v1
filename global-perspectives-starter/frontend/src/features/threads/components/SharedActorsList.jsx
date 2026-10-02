import { useState } from 'react';
import StoryLink from '@/shared/ui/StoryLink.jsx';
import { shortDate } from '@/features/threads/lib/storyMode.js';

// SharedActorsList — "Shares actors with" (STORY_WEB_RETHINK_PLAN §5.2d), the Read-in-full Why
// section's FACT line: other stories whose analyses name the same actors. Rows come from
// webIndexLinks.deriveFromIndex().shared (web_index.shared[], ambient actors already removed by the
// backend; analyses over 30 days old already dropped). Two or more shared actors are shown; a single
// shared actor is collapsed behind a toggle (weak overlap). Nothing here is a causal claim.
export default function SharedActorsList({ rows }) {
  const [showWeak, setShowWeak] = useState(false);
  if (!rows?.length) return null;
  const strong = rows.filter((r) => r.weight >= 2);
  const weak = rows.filter((r) => r.weight < 2);
  const shown = showWeak ? [...strong, ...weak] : strong;
  return (
    <div className="sa" data-testid="shared-actors">
      <p className="sa-caption">
        <span className="sa-badge">FACT</span> named actors that both stories&apos; analyses list. Shared actors do not mean one
        story caused the other.
      </p>
      {shown.length > 0 ? (
        <ul className="sa-list">
          {shown.map((r) => (
            <li key={r.otherThreadId} className="sa-row" data-thread={r.otherThreadId}>
              <StoryLink className="sa-story" threadId={r.otherThreadId} topic={r.otherTitle ? { title: r.otherTitle } : null} target="_blank" rel="noreferrer" hint="Open in a new tab">
                {r.otherTitle || r.otherThreadId}
              </StoryLink>
              <span className="sa-actors">{r.actors.join(' · ')}</span>
              <span className="sa-meta">
                {r.weight} shared {r.weight === 1 ? 'actor' : 'actors'}
                {r.webs.length ? ` · ${r.webs.map((w) => `${w.country || 'analysis'}${w.generatedAt ? `, ${shortDate(w.generatedAt)}` : ''}`).join(' · ')}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {weak.length > 0 ? (
        <button type="button" className="sa-more" aria-expanded={showWeak} onClick={() => setShowWeak((v) => !v)}>
          {showWeak ? 'Hide' : 'Show'} {weak.length} weaker {weak.length === 1 ? 'overlap' : 'overlaps'} (one shared actor)
        </button>
      ) : null}
    </div>
  );
}
