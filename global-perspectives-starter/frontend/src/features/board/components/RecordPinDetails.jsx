import ClaimTag from '@/shared/ui/ClaimTag.jsx';
// Facts from the index row. Readings (line, chapters, confirmed links) are null until the first weekly review;
// a missing reading is simply not listed (operator rule: show only what exists).
export default function RecordPinDetails({ pin }) {
  if (!pin.recordAvailable) return null;
  const count = (key, label) => (Number.isInteger(pin.counts?.[key]) && pin.counts[key] >= 0 ? `${pin.counts[key]} ${label}` : null);
  const parts = [count('chapters', 'chapters'), count('liveBranches', 'live branches'), count('confirmedLinks', 'confirmed links')].filter(Boolean);
  return <>{pin.line ? <p className="board-line"><ClaimTag kind="judgment" /> {pin.line}</p> : null}
    {parts.length ? <p className="board-note">{parts.join(' · ')}</p> : null}</>;
}
