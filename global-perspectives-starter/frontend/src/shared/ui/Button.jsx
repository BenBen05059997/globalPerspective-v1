import { Link } from 'react-router';
import '@/shared/ui/primitives.css';

// Button — the one button. A router <Link> (`to`), a plain <a> (`href`) or a <button> (default),
// all drawn the same way. 44px tap target; `compact` draws 32px on a mouse and keeps 44px on touch.
//   variant   'quiet' (default: outline, for most actions) | 'primary' (accent fill: ONE per view)
//             | 'icon' (square, no outline; `label` is required and becomes the aria-label)
//   selected  draws the one "selected" style (accent outline) and sets aria-pressed on a <button>
//   compact   32px visual height on fine pointers (dense HUD rows); still 44px on touch
//   label     accessible name (required for variant="icon")
//   ...rest   passed to the element (onClick, disabled, title, target, aria-*, ...)
export default function Button({
  variant = 'quiet', selected, compact = false, to = null, href = null, label,
  type = 'button', className = '', children, ...rest
}) {
  const cls = [
    'gp-btn', `gp-btn--${variant}`, compact ? 'gp-btn--compact' : '', selected ? 'gp-btn--selected' : '', className,
  ].filter(Boolean).join(' ');
  const a11y = { 'aria-label': label };
  if (to) return <Link to={to} className={cls} {...a11y} {...rest}>{children}</Link>;
  if (href) return <a href={href} className={cls} {...a11y} {...rest}>{children}</a>;
  return (
    <button type={type} className={cls} aria-pressed={selected === undefined ? undefined : !!selected} {...a11y} {...rest}>
      {children}
    </button>
  );
}
