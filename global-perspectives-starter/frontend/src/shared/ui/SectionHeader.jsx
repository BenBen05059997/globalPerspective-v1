import { createElement } from 'react';
import '@/shared/ui/blocks.css';

// SectionHeader — mono uppercase label + optional hint + count (+ a right-hand slot for actions).
export default function SectionHeader({ label, hint = null, count = null, as: Tag = 'h2', id, children = null, className = '' }) {
  return (
    <div className={`gp-sec ${className}`.trim()}>
      {createElement(Tag, { className: 'gp-sec__label', id }, label, count != null ? <span className="gp-sec__count"> · {count}</span> : null)}
      {hint ? <span className="gp-sec__hint">{hint}</span> : null}
      {children ? <span className="gp-sec__actions">{children}</span> : null}
    </div>
  );
}
