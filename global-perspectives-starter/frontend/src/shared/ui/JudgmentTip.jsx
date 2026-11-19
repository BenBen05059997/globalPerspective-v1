import { useId } from 'react';
import { createPortal } from 'react-dom';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import Tooltip from '@/shared/ui/Tooltip.jsx';
import { usePeek } from '@/shared/hooks/usePeek.js';
import '@/shared/ui/blocks.css';

// JudgmentTip — the MODEL JUDGMENT tag (0012) with one line saying what the model judged (SPEC §0 measured change, §6b story name).
// Interactive (default): a button that shows the shared Tooltip on hover and focus, and toggles it on a tap (phone; 44 px target).
// `interactive={false}` is for a tag inside a control that is already one link or button (a Map or Stories row): the tag, with the
// line as its title and accessible description, since a control cannot hold another. `small`: the row size (SPEC §6b).
export const NAME_NOTE = 'This name is our model’s summary of the story. The headlines are the reporting.';
export const MEASURE_NOTE = 'The figure is official. That it belongs to this story is our model’s judgment.';

export default function JudgmentTip({ text, interactive = true, small = false }) {
  const id = useId();
  const peek = usePeek();
  const cls = `gp-jtip${small ? ' gp-jtip--sm' : ''}`;
  if (!interactive) return <span className={cls} title={text} aria-label={`Model judgment: ${text}`}><ClaimTag kind="judgment" /></span>;
  const open = peek.openId === id;
  return (
    <>
      <button
        type="button"
        className={cls}
        aria-describedby={open ? `tip-${id}` : undefined}
        aria-expanded={open}
        aria-label={`Model judgment: ${text}`}
        onMouseEnter={(e) => peek.openOnHover(id, e.currentTarget)}
        onMouseLeave={peek.close}
        onFocus={(e) => peek.openOnFocus(id, e.currentTarget)}
        onBlur={peek.close}
        onClick={(e) => (open ? peek.close() : peek.openNow(id, e.currentTarget))}
      >
        <ClaimTag kind="judgment" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(<Tooltip id={`tip-${id}`} title={text} style={peek.style} />, document.body)
        : null}
    </>
  );
}
