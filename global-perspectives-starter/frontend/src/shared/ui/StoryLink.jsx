import EntityLink from '@/shared/ui/EntityLink.jsx';
import { storyHref } from '@/shared/lib/links.js';

// StoryLink — the story case of EntityLink (kept for its callers): a router link to the story page with the
// shared StoryPeek on hover / keyboard focus. Without a thread id it links to the stories list, as before.
//   threadId   the story id          to        explicit target (wins)
//   pathOpts   storyHref options     topic     what the peek shows ({ title, category?, regions?, sources? })
//   asOf       real timestamp        hint      what a click does (default "Open the full story")
//   inline     in-text mention style (underline in the story's crisis hue)
export default function StoryLink({ threadId, to, pathOpts, ...rest }) {
  return <EntityLink kind="story" id={threadId} to={to || storyHref(threadId, pathOpts)} {...rest} />;
}
