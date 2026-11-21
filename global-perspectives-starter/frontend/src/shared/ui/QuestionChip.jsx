import { chipFor } from '@/shared/lib/questionChips.js';
import '@/shared/ui/QuestionChip.css';

// QuestionChip — "64% · source: Reuters or AP wire report · awaiting". Renders nothing for a trigger
// without a probability of its own (see lib/questionChips.js).
// `part` splits the chip around the question's sentence (the story page's forecast board puts the chance BEFORE the sentence):
// 'pct' is the chance alone, 'rest' is the source and state that follow the sentence. Default: the whole chip.
export default function QuestionChip({ trigger, part = 'all' }) {
  const c = chipFor(trigger);
  if (!c) return null;
  const pct = <b className="qchip-pct">{c.pct}</b>;
  const state = <span className="qchip-state">{c.text}</span>;
  return (
    <span className={`qchip ${c.kind}${part === 'pct' ? ' qchip--lead' : ''}`} data-testid="question-chip">
      {part !== 'rest' ? pct : null}
      {part === 'pct' ? null : (
        <>
          {c.source ? <span className="qchip-src">{part === 'all' ? ' · ' : ''}source: {c.source}</span> : null}
          {part === 'all' || c.source ? ' · ' : ''}{state}
        </>
      )}
    </span>
  );
}
