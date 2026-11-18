import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import '@/shared/ui/blocks.css';

// EntryRole — an entry's place in our record, as the builder stamped it (`role`, decision 0058: pages show it, never compute it):
// START opens the story, MOVE is a later development, MEASURED CHANGE an official figure or major study. The last is the model's
// call, so it carries the MODEL JUDGMENT tag (0012); START and MOVE come from the order of our record and carry none.
// The neutral outlined word of CategoryTag without its dot; a null or unknown role renders nothing.
const WORD = { start: 'START', move: 'MOVE', measure: 'MEASURED CHANGE' };

export default function EntryRole({ role, className = '' }) {
  if (!WORD[role]) return null;
  return (
    <>
      <span className={`gp-cat ${className}`.trim()} data-dot="off">{WORD[role]}</span>{' '}
      {role === 'measure' && <ClaimTag kind="judgment" />}
    </>
  );
}
