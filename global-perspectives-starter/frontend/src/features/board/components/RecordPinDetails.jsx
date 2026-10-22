import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { NO_READING } from '@/features/board/lib/recordText.js';
// Facts from the index row. Readings (line, chapters, confirmed links) are null until the first weekly review.
export default function RecordPinDetails({ pin }) {
  if (!pin.recordAvailable) return null;
  const count = (key, label) => (pin.counts?.[key] === null ? `${label}: ${NO_READING}` : Number.isInteger(pin.counts?.[key]) && pin.counts[key] >= 0 ? `${pin.counts[key]} ${label}` : null);
  const parts = [count('chapters', 'chapters'), count('liveBranches', 'live branches'), count('confirmedLinks', 'confirmed links')].filter(Boolean);
  return <>{pin.line === null ? <p className="board-line">{NO_READING}</p> : pin.line ? <p className="board-line"><ClaimTag kind="judgment" /> {pin.line}</p> : null}
    {parts.length ? <p className="board-note">{parts.join(' · ')}</p> : null}</>;
}
