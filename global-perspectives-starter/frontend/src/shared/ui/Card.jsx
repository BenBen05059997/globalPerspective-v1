import { createElement } from 'react';
import '@/shared/ui/primitives.css';

// Card — one surface of the panel ladder (tokens.css): the page is --bg, a card is --panel-2, a card
// inside a card is --panel-3, a panel floating over the map is the translucent --panel. Hairline
// border, --r-md corners, no shadow. A card is not a control: make the card's title a link (or put a
// Button in it) instead of making the whole box clickable.
//   level     1 (default, --panel-2) | 2 (nested, --panel-3) | 'hud' (over the map, --panel)
//   selected  the one "selected" style: accent outline
//   pad       'md' (default, 16px) | 'sm' (12px) | 'none'
//   as        element, default 'div' (use 'section' / 'article' / 'li' where it fits)
//   ...rest   passed to the element (id, aria-*, ...)
export default function Card({ level = 1, selected = false, pad = 'md', as = 'div', className = '', children, ...rest }) {
  const cls = [
    'gp-card', `gp-card--${level}`, pad !== 'md' ? `gp-card--pad-${pad}` : '', selected ? 'gp-card--selected' : '', className,
  ].filter(Boolean).join(' ');
  return createElement(as, { className: cls, ...rest }, children);
}
