import { useId } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import Tooltip from '@/shared/ui/Tooltip.jsx';
import { usePeek } from '@/shared/hooks/usePeek.js';
import { peekData } from '@/shared/lib/peekData.js';
import { entityHref, storyHref } from '@/shared/lib/links.js';
import { normKey, parentCountry } from '@/shared/lib/countries.js';
import '@/shared/ui/blocks.css';

// EntityLink — the one link for "a thing is named here" (PLAN_2026-10-19_linking_and_pages.md): a router link
// to the entity's canonical address (shared/lib/links.js) that opens the shared hover/focus preview after a
// short delay, closes on leave / blur / Esc, and never opens a popover on touch (a tap navigates).
//   kind      'story' | 'country' | 'situation' | 'forecast'
//   id        threadId | country name, alias or ISO3 | situation id | qid
//   to        explicit target (wins over the id; e.g. a story path the caller built with options)
//   pathOpts  story only: storyHref options ({ tab, from, country })
//   topic     story only: what the peek shows ({ title, category?, regions?, sources? }) via peekData
//   peek      other kinds: { kicker?, title, meta?, note? } read off the record the page already has
//   asOf      story only: real timestamp for "updated <date>"
//   hint      what a click does (a default per kind)
//   inline    in-text mention style (stories: underline in the crisis hue)
// When the id cannot be addressed (no id, or a "country" that is not one: Strait of Hormuz, Europe, NATO)
// it renders plain text, never a dead link. A sub-national place (West Bank) links to its country and its
// peek names that country. Without preview data the link is a plain link (never a placeholder peek).
const HINT = {
  story: 'Open the full story',
  country: 'Open the country page',
  situation: 'Show on the map',
  forecast: 'Open in the track record',
};

function previewFor(kind, { id, topic, peek, asOf, shown }) {
  if (kind === 'story') return topic ? peekData(topic, { asOf }) : null;
  if (peek?.title) return { ...peek };
  if (kind === 'country') {
    const c = parentCountry(id);
    if (c && normKey(shown) !== normKey(c.name)) return { kicker: 'Country', title: c.name };
  }
  return null;
}

export default function EntityLink({
  kind, id, to, pathOpts, topic, peek: peekProp, asOf, hint, inline = false,
  className, children, onMouseEnter, onMouseLeave, onFocus, onBlur, ...rest
}) {
  const peek = usePeek();
  const uid = useId();
  const href = to || (kind === 'story' && id ? storyHref(id, pathOpts) : entityHref(kind, id));
  const label = children ?? id;
  if (!href) return <span className={className} style={rest.style}>{label}</span>;

  const data = previewFor(kind, { id, topic, peek: peekProp, asOf, shown: typeof label === 'string' ? label : id });
  if (data) data.hint = hint || HINT[kind];
  const open = !!data && peek.openId === uid;
  const base = kind === 'story' ? 'gp-storylink' : 'gp-entitylink';
  const cls = [base, inline ? `${base}--text` : '', className || ''].filter(Boolean).join(' ');
  const style = inline && data?.hue ? { '--story-hue': data.hue, ...(rest.style || {}) } : rest.style;
  const tip = !open || typeof document === 'undefined' ? null
    : kind === 'story'
      ? <StoryPeek id={`peek-${uid}`} data={data} style={peek.style} />
      : <Tooltip id={`peek-${uid}`} style={peek.style} kicker={data.kicker} title={data.title} meta={data.meta} note={data.note} hint={data.hint} />;
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
        {label}
      </Link>
      {tip ? createPortal(tip, document.body) : null}
    </>
  );
}
