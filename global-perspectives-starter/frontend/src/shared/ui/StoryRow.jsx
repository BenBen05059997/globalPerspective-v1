import { createElement } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import StoryPeek from '@/shared/ui/StoryPeek.jsx';
import StatusGlyph from '@/shared/ui/StatusGlyph.jsx';
import TierChip from '@/shared/ui/TierChip.jsx';
import { ageDaysFrom, ageShortFrom } from '@/shared/lib/age.js';
import '@/shared/ui/blocks.css';

// StoryRow — the one list row for a story / situation: crisis-hue bar · tier chip · status glyph ·
// title · place · last-change age. The WHOLE row is one control: a real <a> (`to` router link or
// `href`) or a <button> (`onClick`). Age text turns amber once the last change is older than 7
// days (the legend's "older" band) — it is read from `changedAt`, a real ISO timestamp, and shown
// only when there is one.
//
// Props
//   title, place            text
//   crisis                  'conflict' | 'political' | 'economic' | 'humanitarian' -> bar colour token
//   hue                     explicit CSS colour for the bar (wins over `crisis`; the map passes its axis hue)
//   tier, score             TierChip inputs (no tier = "not scored"); `tierHue` tints the chip ring
//   chip                    a node that REPLACES the TierChip (e.g. a category chip on unscored stories)
//   status | situation      StatusGlyph input (key, or a tracker record)
//   changedAt, now         ISO timestamp of the last change; `now` is for tests
//   meta                    extra inline nodes in the meta line (e.g. a GDACS badge)
//   to | href | onClick     the one action (Link / <a> / <button>)
//   active                  highlights the row (selected)
//   dim                     de-emphasise (older stories)
//   id, peek, peekData      StoryPeek on hover/focus: `peek` is the usePeek() result, `peekData` the peekData() record
//   as                      wrapper element, default 'li'
export default function StoryRow({
  title, place = null, crisis = null, hue = null, tier = null, score = null, tierHue = null, chip = null,
  status = null, situation = null, changedAt = null, now = Date.now(), meta = null,
  to = null, href = null, onClick = null, active = false, dim = false,
  id = null, peek = null, peekData = null, as: Wrapper = 'li', className = '',
}) {
  const days = ageDaysFrom(changedAt, now);
  const age = ageShortFrom(changedAt, now);
  const older = days != null && days > 7;
  const barColor = hue || (crisis ? `var(--hue-${crisis})` : 'var(--text-dim)');
  const peekOpen = !!(peek && id != null && peek.openId === id);

  const common = {
    className: 'gp-row__link',
    'aria-describedby': peekOpen ? `peek-${id}` : undefined,
    onMouseEnter: peek && id != null ? (e) => peek.openOnHover(id, e.currentTarget) : undefined,
    onMouseLeave: peek ? () => peek.close() : undefined,
    onFocus: peek && id != null ? (e) => peek.openOnFocus(id, e.currentTarget) : undefined,
    onBlur: peek ? () => peek.close() : undefined,
    'aria-current': active ? 'true' : undefined,
  };

  const body = (
    <>
      {chip || <TierChip tier={tier} score={score} hue={tierHue} />}
      <span className="gp-row__main">
        <span className="gp-row__meta">
          <StatusGlyph status={status} situation={situation} />
          {meta}
          {place ? <span className="gp-row__place">{place}</span> : null}
          {age ? (
            <span className="gp-row__age" data-fresh={older ? 'older' : 'ok'}>
              {age}{older ? <span className="gp-row__older"> older</span> : null}
            </span>
          ) : null}
        </span>
        <span className="gp-row__title">{title}</span>
      </span>
    </>
  );

  let control;
  if (to) control = <Link to={to} {...common}>{body}</Link>;
  else if (href) control = <a href={href} {...common}>{body}</a>;
  else control = <button type="button" onClick={onClick || undefined} {...common}>{body}</button>;

  return createElement(
    Wrapper,
    {
      className: `gp-row${active ? ' gp-row--active' : ''}${dim ? ' gp-row--dim' : ''} ${className}`.trim(),
      style: { '--row-hue': barColor },
    },
    control,
    // Portalled to <body>: the peek is position:fixed, and a feed panel with backdrop-filter becomes
    // its containing block (the peek landed thousands of px off-screen inside the map's feed).
    peekOpen && typeof document !== 'undefined'
      ? createPortal(<StoryPeek id={`peek-${id}`} data={peekData} style={peek.style} />, document.body)
      : null,
  );
}
