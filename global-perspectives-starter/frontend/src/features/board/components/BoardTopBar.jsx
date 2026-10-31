import { useState } from 'react';
import PinBudget from '@/features/board/components/PinBudget.jsx';
import { dayMonth } from '@/shared/lib/branchWording.js';
import Button from '@/shared/ui/Button.jsx';
import { MAX_NAME } from '@/features/board/lib/boardOps.js';

const VIEW_LABEL = { map: 'Map', graph: 'Graph' };

function NameField({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  if (!editing) {
    return (
      <h1 className="board-title">
        <button type="button" className="board-title__btn" onClick={() => { setDraft(name); setEditing(true); }} title="Rename this board" aria-label={`Board name: ${name}. Rename`}>{name}</button>
      </h1>
    );
  }
  return (
    <h1 className="board-title">
      <input
        className="board-input board-input--title"
        autoFocus
        value={draft}
        maxLength={MAX_NAME}
        aria-label="Board name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(name); setEditing(false); } }}
      />
    </h1>
  );
}

// The board's top bar: "Studio board", the board's name (click to rename), the view switch (only when the board has
// more than one view), the pin count, the week the board reads to, and the Add pin button.
export default function BoardTopBar({ board, pinCount, saving, views, view, onView, weekEnd, addOpen, onAdd, onRename }) {
  return (
    <div className="board-head">
      <span className="board-head__eyebrow">Studio board</span>
      {board ? <NameField key={board.boardId} name={board.name} onRename={onRename} /> : <h1 className="board-title">Board</h1>}
      {views.length > 1 ? (
        <div className="board-views" role="group" aria-label="Board view">
          {views.map((v) => <Button key={v} compact selected={v === view} onClick={() => onView(v)}>{VIEW_LABEL[v]}</Button>)}
        </div>
      ) : null}
      {board ? <PinBudget used={pinCount} /> : null}
      {saving ? <span className="board-save" role="status">Saving</span> : null}
      <span className="board-head__fill" />
      {board && weekEnd ? <span className="board-head__week">Week ending {dayMonth(weekEnd)} {weekEnd.slice(0, 4)}</span> : null}
      {board ? <Button selected={addOpen} onClick={onAdd}>+ Add pin</Button> : null}
    </div>
  );
}
