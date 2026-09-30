import { chipFor } from '@/features/threads/lib/questionChips.js';
import '@/features/threads/components/QuestionChip.css';

// QuestionChip — "64% · source: Reuters or AP wire report · awaiting". Renders nothing for a trigger
// without a probability of its own (see lib/questionChips.js).
export default function QuestionChip({ trigger }) {
  const c = chipFor(trigger);
  if (!c) return null;
  return (
    <span className={`qchip ${c.kind}`} data-testid="question-chip">
      <b className="qchip-pct">{c.pct}</b>
      {c.source ? <span className="qchip-src"> · source: {c.source}</span> : null}
      <span className="qchip-state"> · {c.text}</span>
    </span>
  );
}
