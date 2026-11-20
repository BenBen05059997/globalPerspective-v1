// WhatMoved: the board's "what moved" box (SPEC §3.6). A returning reader sees what changed since their last visit (the
// date this browser last opened a board); a first visit sees this week. Native <details>: open on desktop, closed on phone.
import { useState } from 'react';
import { shortDay } from '@/shared/ui/StoryCard.jsx';
import { movedSummary } from '@/features/board/lib/linkedBoard.js';
import { cardHref } from '@/features/board/components/StoryLinkCard.jsx';

export default function WhatMoved({ moved, storyOf, startOpen }) {
  const [open, setOpen] = useState(startOpen);
  const any = moved.stepped.length + moved.joined.length > 0;
  const since = moved.mode === 'since';
  const rows = [
    ...moved.joined.map((r) => ({ ...r, glyph: '✦', text: since ? 'is new since your visit' : `began this week (${shortDay(r.date)})` })),
    ...moved.stepped.map((r) => ({ ...r, glyph: '●', text: `took a new step on ${shortDay(r.date)}` })),
  ];
  return (
    <details className="bl-moved" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="bl-moved__sum">
        {any ? <span className="bl-moved__glyph" aria-hidden="true">●</span> : null}
        <span>{movedSummary(moved, shortDay)}</span>
      </summary>
      {rows.length ? (
        <ul className="bl-moved__rows">
          {rows.map((r) => (
            <li key={r.id} className="bl-moved__row">
              <span className="bl-moved__glyph" aria-hidden="true">{r.glyph}</span>
              <a href={cardHref(r.id)} className="bl-moved__story">{storyOf(r.id).title}</a>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
