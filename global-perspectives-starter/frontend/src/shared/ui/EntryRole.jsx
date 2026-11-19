import JudgmentTip, { MEASURE_NOTE } from '@/shared/ui/JudgmentTip.jsx';
import '@/shared/ui/blocks.css';

// EntryRole — the kind chip: a step's place in its story, as the builder stamped it (`role`, decision 0058: pages show it, never
// compute it). Reader words from decision 0064; look from SPEC §0 (a label, not a button: no border on the filled kinds, no hover).
// "Measured change" is the model's call, so it carries the MODEL JUDGMENT tag (0012); the other two come from the order of our
// record and carry none. The tag says what was judged (SPEC §0): a tooltip, or, with `interactive={false}` inside a row that is one
// control, a title. A null or unknown role renders nothing.
export const KIND_WORD = { start: 'Starts a story', move: 'Moves a story', measure: 'Measured change' };

export default function EntryRole({ role, className = '', interactive = false }) {
  if (!KIND_WORD[role]) return null;
  return (
    <>
      <span className={`gp-kind ${className}`.trim()} data-kind={role}>{KIND_WORD[role]}</span>{' '}
      {role === 'measure' && <><JudgmentTip text={MEASURE_NOTE} interactive={interactive} small={!interactive} />{' '}</>}
    </>
  );
}
