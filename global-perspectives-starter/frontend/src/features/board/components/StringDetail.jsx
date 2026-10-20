import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';

// One string on the board: who drew it, its line or mechanism, and cut / restore. A cut string is faint, kept,
// and can be restored; nothing is deleted.
export default function StringDetail({ string, labelA, labelB, onCut, onRestore, onClose }) {
  const ours = string.owner === 'ours';
  return (
    <div className="board-verdict">
      <p className="board-verdict__pair">{labelA} <span aria-hidden="true">/</span> {labelB}</p>
      <p className="board-verdict__strength">
        <ClaimTag kind={ours ? 'inference' : 'yours'} />
        {ours ? ' Drawn by us from the story web; inferred.' : ' Drawn by you.'}
      </p>
      {string.line ? <p className="board-line">{string.line}</p> : null}
      {string.mechanism ? <p className="board-verdict__note">{string.mechanism}</p> : null}
      {string.cutAt ? <p className="board-line">Cut. It stays on the board, faint.</p> : null}
      <div className="board-actions">
        {string.cutAt ? <Button onClick={onRestore}>Restore string</Button> : <Button onClick={onCut}>Cut string</Button>}
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
