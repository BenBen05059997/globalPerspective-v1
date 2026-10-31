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
  addPin, removePin, keepString, cutString, restoreString, findString, missingActors, pinRef, failedCombos, KIND_WORD,
} from '@/features/board/lib/boardOps.js';
import RecordPinDetails from '@/features/board/components/RecordPinDetails.jsx';
import ArrivalsTray from '@/features/board/components/ArrivalsTray.jsx';
import StoryTree from '@/features/board/components/StoryTree.jsx';
import BoardWeekly from '@/features/board/components/BoardWeekly.jsx';
import UnsettledZone from '@/features/board/components/UnsettledZone.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import { useWeekCounts } from '@/features/board/hooks/useWeekCounts.js';
import BoardGraph from '@/features/board/components/BoardGraph.jsx';
import VerdictCard from '@/features/board/components/VerdictCard.jsx';
import StringDetail from '@/features/board/components/StringDetail.jsx';
import AddPinPanel from '@/features/board/components/AddPinPanel.jsx';
import PresetsPanel from '@/features/board/components/PresetsPanel.jsx';
import MissingCard from '@/features/board/components/MissingCard.jsx';
import BoardTopBar from '@/features/board/components/BoardTopBar.jsx';
import DueStrip from '@/features/board/components/DueStrip.jsx';
import RailBranches from '@/features/board/components/RailBranches.jsx';
import WeekScrubber from '@/features/board/components/WeekScrubber.jsx';
import DivergencePanel from '@/features/board/components/DivergencePanel.jsx';
import FoldingRules from '@/features/board/components/FoldingRules.jsx';
import { setWeight } from '@/features/board/lib/divergence.js';
import { isoWeekEnd } from '@/features/board/lib/recordViews.js';
import '@/features/board/board.css';

const SHEET_TITLE = { add: 'Add a pin', presets: 'From a preset', verdict: 'Connection verdict', string: 'String', pin: 'Pin' };

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
  const [view, setView] = useState('graph');
  const [weekPick, setWeekPick] = useState(null);
  const presets = usePresets(available && (panel?.type === 'presets' || (member.signedIn && boards.settled && !boards.boards.length) || !member.signedIn));

  const board = state.board;
  const pins = useMemo(() => board?.pins || [], [board]);
  const info = usePinInfo(pins, topics);
  const records = useStoryViews(pins);
  const today = new Date().toISOString().slice(0, 10);
  const counts = useWeekCounts(today, board?.lastVisitedAt, !!board?.recordAvailable);
  const countIds = useMemo(() => [...new Set([...pins.filter((p) => p.kind === 'thread').map((p) => p.refId), ...Object.values(records.stories).map((s) => s?.threadId).filter(Boolean)])], [pins, records.stories]);
  const full = pins.length >= PIN_BUDGET;
  const pinById = useMemo(() => Object.fromEntries(pins.map((p) => [p.pinId, p])), [pins]);
  const labelOf = (id) => info[id]?.label || pinById[id]?.refId || id;

  // With no board in the address, open the newest one.
  useEffect(() => {
    if (live && !boardId && boards.settled && boards.boards.length) navigate(boardHref(boards.boards[0].boardId), { replace: true });
  }, [live, boardId, boards.settled, boards.boards, navigate]);

  // A different board starts with a clean selection and no open panel.
  useEffect(() => { setPanel(null); setSelected([]); setResults([]); setNotice(''); setConfirmDelete(false); setWeekPick(null); }, [boardId]);

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
  const failed = useMemo(() => (board ? failedCombos(board, results) : []), [board, results]);
  const addActor = (name) => addToBoard({ kind: 'actor', refId: name });
  // The map view is not built yet: the switch shows only in the dev harness.
  const views = import.meta.env.DEV ? ['map', 'graph'] : ['graph'];
  const coverage = board?.coverage || null; // per-day coverage and kept weeks: the live board feed does not carry it yet
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
    <div className={`board-page${sheet ? ' has-sheet-open' : ''}`} onKeyDown={onKeyDown}>
      <BoardTopBar
        board={board}
        pinCount={pins.length}
        saving={state.saving}
        views={views}
        view={view}
        onView={setView}
        weekEnd={weekPick || isoWeekEnd(today)}
        addOpen={panel?.type === 'add'}
        onAdd={() => setPanel(panel?.type === 'add' ? null : { type: 'add' })}
        onRename={(name) => state.edit((b) => ({ ...b, name }))}
      />
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

          <div className="board-main">
            <div className="board-canvas">
              {import.meta.env.DEV && view === 'map' ? (
                <p className="board-line">The map view is not built yet (dev harness only).</p>
              ) : (
                <BoardGraph
                  pins={pins}
                  strings={board.strings}
                  info={info}
                  selected={selected}
                  pickedKey={pickedKey}
                  onSelectPin={selectPin}
                  onPickString={(s) => setPanel({ type: 'string', string: s })}
                  onConnect={connect}
                  ghosts={missing}
                  failed={failed}
                  onAddGhost={addActor}
                  coverageGap={coverage?.gaps?.[0] || null}
                />
              )}
              <DueStrip stories={records.stories} today={today} />
              {coverage?.weeks ? <WeekScrubber weeks={coverage.weeks} note={coverage.note} onChange={setWeekPick} /> : null}
              {board.strings.length ? (
                <details className="board-strings-disclosure">
                  <summary>List of strings ({board.strings.length})</summary>
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
                </details>
              ) : null}
              <details className="board-strings-disclosure">
                <summary>List of pins ({pins.length})</summary>
                <ul className="board-pinlist" aria-label="Pins on this board">
                  {pins.map((p) => (
                    <li key={p.pinId}>
                      <div className="board-pinrow">
                        <button type="button" className="board-strings__btn" onClick={() => setPanel({ type: 'pin', pinId: p.pinId })}>{KIND_WORD[p.kind]}: {labelOf(p.pinId)}</button>
                        {!p.line && p.kind === 'thread' && info[p.pinId]?.hasHeadline ? <span className="board-pinrow__tag">Latest headline</span> : null}
                      </div>
                      <RecordPinDetails pin={p} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <div className="board-rail">
              {!isPhone ? sheet : null}
              <BoardWeekly board={board} info={info} stories={records.stories} links={records.links} loading={records.loading} errors={records.errors}
                onAddPin={(threadId) => addToBoard({ kind: 'thread', refId: threadId })}
                onDismissLink={(threadId) => state.edit((b) => ({ ...b, dismissed: [...new Set([...b.dismissed, threadId])] }))} />
              <RailBranches stories={records.stories} labelOf={(threadId) => info[board.pins.find((p) => p.refId === threadId)?.pinId]?.label || threadId} />
              <MissingCard actors={missing} full={full} onFollow={follows.followActor} onAdd={addActor} />
              <DivergencePanel board={board} stories={records.stories} labelOf={labelOf}
                onRestore={(a, b) => state.edit((bd) => restoreString(bd, a, b))}
                onWeight={(forkId, branchId, percent) => state.edit((bd) => setWeight(bd, forkId, branchId, percent))} />
            </div>
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
          {board.recordAvailable ? <UnsettledZone ids={countIds} counts={counts} /> : null}
          <details className="board-fold"><summary>How the board folds</summary><FoldingRules /></details>
        </>
      ) : null}
      {board ? null : (state.loading ? <p className="board-line" aria-busy="true">Loading the board.</p> : null)}
      {empty ? <Card as="section" aria-label="Region presets"><SectionHeader label="Region presets" as="h2" /><PresetsPanel presets={presets.presets} loading={presets.loading} canFork signInHref={signInHref} onFork={forkPreset} /></Card> : null}
      {isPhone ? sheet : null}
    </div>
  );
}
