import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { isLate, uniqueStories } from '@/features/board/lib/branchDays.js';
import { openFork, openForkBranches } from '@/features/board/lib/storyTree.js';
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';

const MAX_STORIES = 2;

/** The open branches of the open fork (newest with any) of each pinned story: [{ threadId, forkId, title, branches }]. */
function railForks(stories, labelOf) {
  const out = [];
  for (const { key, story } of uniqueStories(stories)) {
    const branches = openForkBranches(story.forks);
    if (branches.length) out.push({ threadId: key, forkId: openFork(story.forks).forkId, title: labelOf(key), branches });
  }
  return out.slice(0, MAX_STORIES);
}

// The branches of your pinned stories in the right rail: label, our percentage and the trigger line. A reading by
// the model, so it carries the model-judgment tag. No open branch -> absent.
export default function RailBranches({ stories, labelOf, today }) {
  const forks = railForks(stories, labelOf);
  if (!forks.length) return null;
  return (
    <section className="board-rail__branches" aria-label="Branches on your board">
      {forks.map((f) => (
        <div key={`${f.threadId}:${f.forkId}`} className="board-rail__fork">
          <h3 className="board-eyebrow">{f.title} branches <ClaimTag kind="judgment" /></h3>
          <ul>
            {f.branches.map((b) => (
              <li key={b.branchId}>
                <span className="board-rail__branch"><span>{branchScenario(b) || branchLine(b)}</span>{branchPercent(b) != null ? <span className="board-rail__p">{branchPercent(b)}%</span> : null}</span>
                {b.trigger ? <span className="board-note">trigger: {b.trigger}</span> : null}
                {isLate(b, today) ? <span className="board-note">late · past {dayMonth(b.due)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
