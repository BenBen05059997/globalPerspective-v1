import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useGeminiTopics } from '@/shared/data/useGeminiTopics';
import { reportFetchError } from '@/shared/api/errorSink';
import { useIsPhone } from '@/shared/hooks/useIsPhone.js';
import { useNoIndex } from '@/shared/hooks/useNoIndex.js';
import { boardHref } from '@/shared/lib/links.js';
import { PIN_BUDGET, pairKey } from '@/shared/lib/board.js';
import BottomSheet from '@/shared/ui/BottomSheet.jsx';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import Chip from '@/shared/ui/Chip.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { useMember } from '@/features/board/hooks/useMember.js';
import { useBoards } from '@/features/board/hooks/useBoards.js';
import { useBoard } from '@/features/board/hooks/useBoard.js';
import { useFollows } from '@/features/board/hooks/useFollows.js';
import { usePresets } from '@/features/board/hooks/usePresets.js';
import { usePinInfo } from '@/features/board/hooks/usePinInfo.js';
import { boardAvailable, callBoard } from '@/features/board/lib/boardApi.js';
import {
  addPin, removePin, keepString, cutString, restoreString, findString, missingActors, pinRef, MAX_NAME, KIND_WORD,
} from '@/features/board/lib/boardOps.js';
import RecordPinDetails from '@/features/board/components/RecordPinDetails.jsx';
import ArrivalsTray from '@/features/board/components/ArrivalsTray.jsx';
import StoryTree from '@/features/board/components/StoryTree.jsx';
import BoardWeekly from '@/features/board/components/BoardWeekly.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import BoardGraph from '@/features/board/components/BoardGraph.jsx';
import VerdictCard from '@/features/board/components/VerdictCard.jsx';
import StringDetail from '@/features/board/components/StringDetail.jsx';
import AddPinPanel from '@/features/board/components/AddPinPanel.jsx';
import PresetsPanel from '@/features/board/components/PresetsPanel.jsx';
import MissingCard from '@/features/board/components/MissingCard.jsx';
import '@/features/board/board.css';

const SHEET_TITLE = { add: 'Add a pin', presets: 'From a preset', verdict: 'Connection verdict', string: 'String', pin: 'Pin' };

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

export default function BoardPage() {
  useNoIndex();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const member = useMember();
  const available = boardAvailable();
  const live = available && member.signedIn;

  const boards = useBoards(live);
  const refreshBoards = boards.refresh;
  const onSaved = useCallback((out) => { if (out?.name) refreshBoards(); }, [refreshBoards]);
  const state = useBoard(boardId, live, onSaved);
  const follows = useFollows(live);
  const { topics } = useGeminiTopics();

  const [panel, setPanel] = useState(null);
  const [stop, setStop] = useState('half');
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const presets = usePresets(available && (panel?.type === 'presets' || (member.signedIn && boards.settled && !boards.boards.length) || !member.signedIn));

  const board = state.board;
  const pins = useMemo(() => board?.pins || [], [board]);
  const info = usePinInfo(pins, topics);
  const records = useStoryViews(pins);
  const full = pins.length >= PIN_BUDGET;
  const pinById = useMemo(() => Object.fromEntries(pins.map((p) => [p.pinId, p])), [pins]);
  const labelOf = (id) => info[id]?.label || pinById[id]?.refId || id;

  // With no board in the address, open the newest one.
  useEffect(() => {
    if (live && !boardId && boards.settled && boards.boards.length) navigate(boardHref(boards.boards[0].boardId), { replace: true });
  }, [live, boardId, boards.settled, boards.boards, navigate]);

  // A different board starts with a clean selection and no open panel.
  useEffect(() => { setPanel(null); setSelected([]); setResults([]); setNotice(''); setConfirmDelete(false); }, [boardId]);

  const connectSeq = useRef(0);
  const connect = useCallback(async (idA, idB) => {
    const a = pinById[idA];
    const b = pinById[idB];
    if (!a || !b || idA === idB) return;
    const seq = ++connectSeq.current;
    setPanel({ type: 'verdict', a: idA, b: idB, loading: true });
    setStop('half');
    try {
      const result = await callBoard('connect', { a: pinRef(a), b: pinRef(b) });
      if (seq !== connectSeq.current) return;
      setResults((prev) => [...prev.filter((r) => r.pairKey !== result.pairKey), result]);
      setPanel({ type: 'verdict', a: idA, b: idB, result });
    } catch (err) {
      if (seq !== connectSeq.current) return;
      reportFetchError('board-connect', err);
      setPanel({ type: 'verdict', a: idA, b: idB, error: 'This pair could not be tested just now.' });
    }
  }, [pinById]);

  const selectPin = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]));
  };
  const connectSelected = () => { if (selected.length === 2) connect(selected[0], selected[1]); };

  const onKeyDown = (e) => {
    if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    connectSelected();
  };

  const addToBoard = (ref) => {
    const r = addPin(board, ref);
    if (r.status === 'full') { setNotice(`Pin budget reached: a board holds at most ${PIN_BUDGET} pins.`); return; }
    if (r.status === 'duplicate') { setNotice('That pin is already on this board.'); return; }
    setNotice('');
    state.edit((b) => addPin(b, ref).board);
  };

  const keep = (line) => {
    state.edit((b) => keepString(b, panel.a, panel.b, line));
    setPanel(null);
    setSelected([]);
  };

  const createBoard = async () => {
    try {
      const b = await boards.create(`Board ${boards.boards.length + 1}`);
      navigate(boardHref(b.boardId));
    } catch (err) { reportFetchError('board-create', err); setNotice('The board could not be created.'); }
  };
  const forkPreset = async (p) => {
    try {
      const b = await boards.fork(p.presetId);
      setPanel(null);
      navigate(boardHref(b.boardId));
    } catch (err) { reportFetchError('board-fork', err); setNotice('The preset could not be forked.'); }
  };
  const deleteBoard = async () => {
    try {
      await boards.remove(boardId);
      setConfirmDelete(false);
      navigate(boardHref(), { replace: true });
    } catch (err) { reportFetchError('board-delete', err); setNotice('The board could not be deleted.'); }
  };

  const missing = useMemo(() => (board ? missingActors(board, results, follows.actors) : []), [board, results, follows.actors]);
  const signInHref = `/signin?returnTo=${encodeURIComponent(boardHref(boardId))}`;

  if (!available) return <div className="board-page"><p className="board-line">The board is not available yet.</p></div>;
  if (member.loading) return <div className="board-page" aria-busy="true" />;
  if (!member.signedIn) {
    return (
      <div className="board-page">
        <h1 className="board-title">Board</h1>
        <p className="board-line">The board is for signed-in members. <Link className="board-link" to={signInHref}>Sign in</Link> to build yours.</p>
        <Card as="section" aria-label="Region presets">
          <SectionHeader label="Region presets" hint="A starting board per region" as="h2" />
          <PresetsPanel presets={presets.presets} loading={presets.loading} canFork={false} signInHref={signInHref} />
        </Card>
      </div>
    );
  }

  const closePanel = () => { connectSeq.current += 1; setPanel(null); };
  const verdictPins = panel?.type === 'verdict' ? [pinById[panel.a], pinById[panel.b]] : [];
  const pickedString = panel?.type === 'string' ? panel.string : null;
  const pickedKey = pickedString ? pairKey(pickedString.a, pickedString.b) : null;
  const detailPin = panel?.type === 'pin' ? pinById[panel.pinId] : null;

  let sheetBody = null;
  if (panel?.type === 'add') {
    sheetBody = <AddPinPanel topics={topics} followedThreads={follows.threads} followedActors={follows.actors} full={full} notice={notice} onAdd={addToBoard} />;
  } else if (panel?.type === 'presets') {
    sheetBody = <PresetsPanel presets={presets.presets} loading={presets.loading} canFork signInHref={signInHref} onFork={forkPreset} />;
  } else if (panel?.type === 'verdict' && verdictPins[0] && verdictPins[1]) {
    sheetBody = (
      <VerdictCard
        key={`${panel.a}-${panel.b}`}
        labelA={labelOf(panel.a)}
        labelB={labelOf(panel.b)}
        state={panel}
        kept={!!findString(board, panel.a, panel.b)}
        onKeep={keep}
        onDismiss={() => { closePanel(); setSelected([]); }}
      />
    );
  } else if (pickedString) {
    const cur = findString(board, pickedString.a, pickedString.b);
    sheetBody = cur ? (
      <StringDetail
        string={cur}
        labelA={labelOf(cur.a)}
        labelB={labelOf(cur.b)}
        onCut={() => state.edit((b) => cutString(b, cur.a, cur.b))}
        onRestore={() => state.edit((b) => restoreString(b, cur.a, cur.b))}
        onClose={closePanel}
      />
    ) : null;
  } else if (detailPin) {
    const i = info[detailPin.pinId];
    sheetBody = (
      <div className="board-verdict">
        <p className="board-verdict__pair">{KIND_WORD[detailPin.kind]}</p>
        <p className="board-verdict__strength">
          {detailPin.kind === 'thread' ? <EntityLink kind="story" id={detailPin.refId}>{i?.label}</EntityLink>
            : detailPin.kind === 'country' ? <EntityLink kind="country" id={detailPin.refId}>{i?.label}</EntityLink> : i?.label}
        </p>
        {detailPin.kind === 'thread' ? <StoryTree key={detailPin.refId} story={records.stories[detailPin.refId]} loading={records.loading} error={records.errors[detailPin.refId]} /> : null}
        <div className="board-actions">
          {detailPin.kind === 'actor' && !follows.actors.some((a) => a.toLowerCase() === detailPin.refId.toLowerCase())
            ? <Button onClick={() => follows.followActor(detailPin.refId)}>Follow actor</Button> : null}
          <Button onClick={() => { state.edit((b) => removePin(b, detailPin.pinId)); setSelected((s) => s.filter((x) => x !== detailPin.pinId)); closePanel(); }}>Remove pin</Button>
          <Button onClick={closePanel}>Close</Button>
        </div>
      </div>
    );
  }

  const sheet = panel && sheetBody ? (
    isPhone ? (
      <BottomSheet stop={stop} onStopChange={setStop} onClose={closePanel} title={SHEET_TITLE[panel.type]} subtitle="Board">{<div className="board-sheet-body">{sheetBody}</div>}</BottomSheet>
    ) : (
      <Card as="aside" className="board-sheet" aria-label={SHEET_TITLE[panel.type]}>
        <SectionHeader label={SHEET_TITLE[panel.type]} as="h2"><Button compact onClick={closePanel}>Close</Button></SectionHeader>
        {sheetBody}
      </Card>
    )
  ) : null;

  const empty = boards.settled && !boards.boards.length && !boardId;

  return (
    <div className="board-page" onKeyDown={onKeyDown}>
      <div className="board-head">
        {board ? <NameField key={board.boardId} name={board.name} onRename={(name) => state.edit((b) => ({ ...b, name }))} /> : <h1 className="board-title">Board</h1>}
        {board ? <span className="board-budget" aria-label={`${pins.length} of ${PIN_BUDGET} pins used`}>{pins.length} / {PIN_BUDGET}<span className="board-budget__unit"> pins</span></span> : null}
        {state.saving ? <span className="board-save" role="status">Saving</span> : null}
      </div>
      {state.saveError ? <p className="board-line" role="status">{state.saveError}</p> : null}

      <div className="board-switch" role="group" aria-label="Your boards">
        {boards.boards.map((b) => (
          <Chip key={b.boardId} selected={b.boardId === boardId} onClick={() => navigate(boardHref(b.boardId))}>{b.name}</Chip>
        ))}
        <Button compact onClick={createBoard}>New board</Button>
        <Button compact selected={panel?.type === 'presets'} onClick={() => setPanel(panel?.type === 'presets' ? null : { type: 'presets' })}>From preset</Button>
      </div>

      {empty ? <p className="board-line">You have no boards yet. Start a new board, or fork a region preset.</p> : null}
      {state.notFound ? <p className="board-line">That board was not found. Pick one of yours above.</p> : null}
      {notice && panel?.type !== 'add' ? <p className="board-line" role="status">{notice}</p> : null}

      {board ? (
        <>
          <div className="board-toolbar">
            <Button selected={panel?.type === 'add'} onClick={() => setPanel(panel?.type === 'add' ? null : { type: 'add' })}>Add pin</Button>
            <Button disabled={selected.length !== 2} onClick={connectSelected} title="Select two pins, then connect (or press c)">Connect</Button>
            <span className="board-hint">
              {selected.length === 0 ? 'Drag one pin onto another, or select two and press Connect.'
                : selected.length === 1 ? `Selected: ${labelOf(selected[0])}. Select a second pin.`
                  : `Selected: ${labelOf(selected[0])} and ${labelOf(selected[1])}.`}
            </span>
            {confirmDelete ? (
              <span className="board-confirm" role="group" aria-label="Confirm delete">
                <span>Delete &ldquo;{board.name}&rdquo;?</span>
                <Button compact onClick={deleteBoard}>Yes, delete</Button>
                <Button compact onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </span>
            ) : <Button compact onClick={() => setConfirmDelete(true)}>Delete board</Button>}
          </div>

          <div className={`board-main${panel && sheetBody && !isPhone ? ' has-sheet' : ''}`}>
            <div className="board-canvas">
              <BoardGraph
                pins={pins}
                strings={board.strings}
                info={info}
                selected={selected}
                pickedKey={pickedKey}
                onSelectPin={selectPin}
                onPickString={(s) => setPanel({ type: 'string', string: s })}
                onConnect={connect}
              />
              <div className="board-legend" aria-label="How strings are drawn">
                <span><svg width="36" height="8" aria-hidden="true"><line className="board-key board-key--dashed" x1="0" y1="4" x2="36" y2="4" /></svg> ours, inferred</span>
                <span><svg width="36" height="8" aria-hidden="true"><line className="board-key board-key--dashed-alt" x1="0" y1="4" x2="36" y2="4" /></svg> yours</span>
                <span><svg width="36" height="8" aria-hidden="true"><line className="board-key board-key--cut" x1="0" y1="4" x2="36" y2="4" /></svg> cut</span>
              </div>
              {board.strings.length ? (
                <ul className="board-strings" aria-label="Strings on this board">
                  {board.strings.map((s) => (
                    <li key={pairKey(s.a, s.b)}>
                      <button type="button" className="board-strings__btn" onClick={() => setPanel({ type: 'string', string: s })}>
                        {labelOf(s.a)} / {labelOf(s.b)}
                      </button>
                      <ClaimTag kind={s.owner === 'ours' ? 'inference' : 'yours'} />
                      {s.cutAt ? <span className="board-note">cut</span> : null}
                      {s.line ? <span className="board-note">{s.line}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="board-pinlist" aria-label="Pins on this board">
                {pins.map((p) => (
                  <li key={p.pinId}>
                    <button type="button" className="board-strings__btn" onClick={() => setPanel({ type: 'pin', pinId: p.pinId })}>{KIND_WORD[p.kind]}: {labelOf(p.pinId)}</button>
                    {!p.line && p.kind === 'thread' && info[p.pinId]?.hasHeadline ? <span className="board-note">Latest headline</span> : null}
                    <RecordPinDetails pin={p} />
                  </li>
                ))}
              </ul>
            </div>
            {!isPhone ? sheet : null}
          </div>
          <ArrivalsTray key={board.boardId} board={board}
            onDismiss={(id) => state.edit((b) => ({...b, dismissed: [...new Set([...b.dismissed, id])]}))}
            onKeep={(card) => {
              state.edit((b) => {
                const added = addPin(b, {kind: 'thread', refId: card.threadId});
                if (added.status !== 'added') return b;
                const pin = added.board.pins.find((p) => p.refId === card.threadId);
                return keepString(added.board, pin.pinId, card.via[0].pinId, card.via[0].mechanism);
              });
            }} />
          <BoardWeekly board={board} info={info} stories={records.stories} loading={records.loading} errors={records.errors} />
          <MissingCard actors={missing} onFollow={follows.followActor} />
        </>
      ) : null}
      {board ? null : (state.loading ? <p className="board-line" aria-busy="true">Loading the board.</p> : null)}
      {empty ? <Card as="section" aria-label="Region presets"><SectionHeader label="Region presets" as="h2" /><PresetsPanel presets={presets.presets} loading={presets.loading} canFork signInHref={signInHref} onFork={forkPreset} /></Card> : null}
      {isPhone ? sheet : null}
    </div>
  );
}
