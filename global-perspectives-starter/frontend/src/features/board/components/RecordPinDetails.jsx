import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { AXES } from '@/shared/lib/riskTiers.js';
import { pinCountParts } from '@/features/board/lib/graphText.js';
// The pin's line and counts as text, for the pin list (screen readers and keyboard; the graph card shows them too).
// Readings (line, chapters, confirmed links) are null until the first weekly review; a missing reading is simply
// not listed (operator rule: show only what exists).
// A preset pin's `lead` is the analysis's worst-scoring risk axis (conflict, humanitarian, economic, political), not the
// story's category: shown bare it read as a second category beside the card's own, so it is labelled.
const leadText = (lead) => (AXES.includes(String(lead).toLowerCase()) ? `Most serious for: ${String(lead).toLowerCase()}` : lead);

export default function RecordPinDetails({ pin, story, today }) {
  const parts = pinCountParts(pin, story, today);
  const line = pin.recordAvailable ? pin.line : null;
  return <>{line ? <p className="board-line"><ClaimTag kind="judgment" /> {line}</p> : pin.lead ? <p className="board-line">{leadText(pin.lead)}</p> : null}
    {parts.length ? <p className="board-note">{parts.join(' · ')}</p> : null}</>;
}
