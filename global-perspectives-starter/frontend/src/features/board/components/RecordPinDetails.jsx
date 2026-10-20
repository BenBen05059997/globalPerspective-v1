import ClaimTag from '@/shared/ui/ClaimTag.jsx';
export default function RecordPinDetails({ pin }) {
  const counts = [['chapters', 'chapters'], ['liveBranches', 'live branches'], ['confirmedLinks', 'confirmed links']]
    .filter(([key]) => Number.isInteger(pin.counts?.[key]) && pin.counts[key] >= 0)
    .map(([key, label]) => `${pin.counts[key]} ${label}`);
  return <>{pin.line ? <p className="board-line"><ClaimTag kind="judgment" /> {pin.line}</p> : null}
    {counts.length ? <p className="board-note">{counts.join(' · ')}</p> : null}</>;
}
