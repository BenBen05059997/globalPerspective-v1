import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { pinCountParts } from '@/features/board/lib/graphText.js';
// The pin's line and counts as text, for the pin list (screen readers and keyboard; the graph card shows them too).
// Readings (line, chapters, confirmed links) are null until the first weekly review; a missing reading is simply
// not listed (operator rule: show only what exists).
export default function RecordPinDetails({ pin }) {
  const parts = pinCountParts(pin);
  if (!pin.recordAvailable) return null;
  return <>{pin.line ? <p className="board-line"><ClaimTag kind="judgment" /> {pin.line}</p> : null}
    {parts.length ? <p className="board-note">{parts.join(' · ')}</p> : null}</>;
}
