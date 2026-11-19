import { createElement } from 'react';
import '@/shared/ui/blocks.css';

// ReaderPromise — the one promise sentence (decision 0064 item 1). Written once here; every page that carries it
// (Today, the "?" About content, later the Map) renders this block, so the words never drift.
export const PROMISE = 'We follow the world’s stories day by day: how each began, what moved it today, and what to watch next.';

export default function ReaderPromise({ as: Tag = 'p', className = '' }) {
  return createElement(Tag, { className: `gp-promise ${className}`.trim() }, PROMISE);
}
