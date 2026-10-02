import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import { usePeek } from '@/shared/hooks/usePeek.js';
import { peekData } from '@/shared/lib/peekData.js';
import { threadPath } from '@/shared/lib/threadPath.js';

// StoryLink — the one link for "a story is named here" (REDESIGN_MASTER_PLAN §3.2): a normal router
// link to the story page that also opens the shared StoryPeek on hover (after a short delay) and on
// keyboard focus, and closes on leave / blur / Esc. Built once on usePeek + peekData + StoryPeek.
//   threadId   the story id (builds the path with threadPath unless `to` is given)
//   to         explicit target (use when the caller already built the path, e.g. with ?from=country)
//   pathOpts   threadPath options ({ tab, from, country })
//   topic      what the peek shows, read straight off the record the page already has:
//              { title, category?, regions?, sources? }. Without a title there is nothing to preview
//              and the link is a plain link (never a placeholder peek).
//   asOf       real timestamp for "updated <date>" (omitted when not passed)
//   hint       what a click does; default "Open the full story"
//   inline     in-text mention style (underline in the story's crisis hue)
// Phones (`(hover: none)`): usePeek never opens a popover for touch, so a tap just navigates.
export default function StoryLink({
  threadId, to, pathOpts, topic, asOf, hint = 'Open the full story', inline = false,
  className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest
}) {
  const peek = usePeek();
  const uid = useId();
  const href = to || threadPath(threadId, pathOpts);
  const data = topic ? peekData(topic, { asOf }) : null;
  if (data) data.hint = hint;
  const open = !!data && peek.openId === uid;
  const cls = ['gp-storylink', inline ? 'gp-storylink--text' : '', className || ''].filter(Boolean).join(' ');
  const style = inline && data?.hue ? { '--story-hue': data.hue, ...(rest.style || {}) } : rest.style;
  return (
    <>
      <Link
        {...rest}
        style={style}
        to={href}
        className={cls}
        aria-describedby={open ? `peek-${uid}` : undefined}
        onMouseEnter={(e) => { if (data) peek.openOnHover(uid, e.currentTarget); onMouseEnter?.(e); }}
        onMouseLeave={(e) => { peek.close(); onMouseLeave?.(e); }}
        onFocus={(e) => { if (data) peek.openOnFocus(uid, e.currentTarget); onFocus?.(e); }}
        onBlur={(e) => { peek.close(); onBlur?.(e); }}
      >
        {children}
      </Link>
      {open && typeof document !== 'undefined'
        ? createPortal(<StoryPeek id={`peek-${uid}`} data={data} style={peek.style} />, document.body)
        : null}
    </>
  );
}
