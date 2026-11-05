import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
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
  addPin, retirePin, restorePin, keepString, cutString, restoreString, findString, missingActors, pinRef, failedCombos, KIND_WORD,
} from '@/features/board/lib/boardOps.js';
import RecordPinDetails from '@/features/board/components/RecordPinDetails.jsx';
import ArrivalsTray from '@/features/board/components/ArrivalsTray.jsx';
import StoryTree from '@/features/board/components/StoryTree.jsx';
import BoardWeekly from '@/features/board/components/BoardWeekly.jsx';
import UnsettledZone from '@/features/board/components/UnsettledZone.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import { useRecordFactsThrough } from '@/features/board/hooks/useRecordFactsThrough.js';
import { useWeekCounts } from '@/features/board/hooks/useWeekCounts.js';
import BoardGraph from '@/features/board/components/BoardGraph.jsx';
import BoardMap from '@/features/board/components/BoardMap.jsx';
import MapRail from '@/features/board/components/MapRail.jsx';
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
import AlertsPanel from '@/features/board/components/AlertsPanel.jsx';
import MonthlyCard from '@/features/board/components/MonthlyCard.jsx';
import FoldingRules from '@/features/board/components/FoldingRules.jsx';
import { setWeight } from '@/features/board/lib/divergence.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { isoWeekEnd } from '@/features/board/lib/recordViews.js';
import { todayUTC } from '@/features/board/lib/branchDays.js';
import '@/features/board/board.css';

const SHEET_TITLE = { add: 'Add a pin', presets: 'From a preset', verdict: 'Connection verdict', string: 'String', pin: 'Pin' };

export default function BoardPage() {
  useNoIndex();
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  // every move between boards keeps the query (the dev harness lives in it)
  const goTo = useCallback((id, opts) => navigate({ pathname: boardHref(id), search }, opts), [navigate, search]);
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
  const [railOpen, setRailOpen] = useState(false);
  const presets = usePresets(available && (panel?.type === 'presets' || (member.signedIn && boards.settled && !boards.boards.length) || !member.signedIn));

  const board = state.board;
  const pins = useMemo(() => board?.pins || [], [board]);
  const info = usePinInfo(pins, topics);
  const records = useStoryViews(pins);
  const recordThrough = useRecordFactsThrough();
  const today = todayUTC();
  // the visit date the session started with: the server moves lastVisitedAt on as soon as the arrivals are read
  const counts = useWeekCounts(today, state.visitedAt, !!board?.recordAvailable);
  // retired pins are greyed: their stories stay out of the due strip, the rail, the weekly and the counts
  const liveStories = useMemo(() => {
    const refs = new Set(pins.filter((p) => !p.retiredAt).map((p) => p.refId));
    return Object.fromEntries(Object.entries(records.stories).filter(([id]) => refs.has(id)));
  }, [pins, records.stories]);
  const countIds = useMemo(() => [...new Set([...pins.filter((p) => p.kind === 'thread').map((p) => p.refId), ...Object.values(records.stories).map((s) => s?.threadId).filter(Boolean)])], [pins, records.stories]);
  const liveCount = pins.filter((p) => !p.retiredAt).length;
  const full = liveCount >= PIN_BUDGET;
  const pinById = useMemo(() => Object.fromEntries(pins.map((p) => [p.pinId, p])), [pins]);
  const labelOf = (id) => info[id]?.label || pinById[id]?.refId || id;
  const threadLabel = (threadId) => info[board.pins.find((p) => p.refId === threadId)?.pinId]?.label || threadId;

  // With no board in the address, open the newest one.
  useEffect(() => {
    if (live && !boardId && boards.settled && boards.boards.length) goTo(boards.boards[0].boardId, { replace: true });
  }, [live, boardId, boards.settled, boards.boards, goTo]);

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
    setNotice(r.status === 'restored' ? 'That pin was retired; it is back on the board.' : '');
    state.edit((b) => addPin(b, ref).board);
  };

  // Dropping a connection forgets its verdict: a "no link" line and label drawn for it go with it.
  const dropVerdict = () => {
    const pairKey = panel?.result?.pairKey;
    if (pairKey) setResults((prev) => prev.filter((r) => r.pairKey !== pairKey));
    closePanel();
    setSelected([]);
  };
  const keep = (line) => {
    state.edit((b) => keepString(b, panel.a, panel.b, line));
    setPanel(null);
    setSelected([]);
  };

  const createBoard = async () => {
    try {
      const b = await boards.create(`Board ${boards.boards.length + 1}`);
      goTo(b.boardId);
    } catch (err) { reportFetchError('board-create', err); setNotice(err.code === 'board_limit' ? err.message : 'The board could not be created.'); }
  };
  const forkPreset = async (p) => {
    try {
      const b = await boards.fork(p.presetId);
      setPanel(null);
      goTo(b.boardId);
    } catch (err) { reportFetchError('board-fork', err); setNotice(err.code === 'board_limit' ? err.message : 'The preset could not be forked.'); }
  };
  const deleteBoard = async () => {
    try {
      await boards.remove(boardId);
      setConfirmDelete(false);
      goTo(undefined, { replace: true });
    } catch (err) { reportFetchError('board-delete', err); setNotice('The board could not be deleted.'); }
  };

  const missing = useMemo(() => (board ? missingActors(board, results, follows.actors) : []), [board, results, follows.actors]);
  const failed = useMemo(() => (board ? failedCombos(board, results) : []), [board, results]);
  const addActor = (name) => addToBoard({ kind: 'actor', refId: name });
  const views = ['map', 'graph'];
  const mapView = view === 'map';
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

  // The open story pin's tree: in the bottom sheet on a phone, full width under the graph on a desktop.
  const storyTree = detailPin?.kind === 'thread'
    ? <StoryTree key={detailPin.refId} story={records.stories[detailPin.refId]} loading={records.loading} error={records.errors[detailPin.refId]} today={today} recordThrough={recordThrough} /> : null;

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
        existing={findString(board, panel.a, panel.b)}
        onKeep={keep}
        onDismiss={dropVerdict}
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
        <p className="board-verdict__pair">{KIND_WORD[detailPin.kind]}{detailPin.retiredAt ? ` · retired ${dayMonth(detailPin.retiredAt)}; it keeps its strings and your lines` : ''}</p>
        <p className="board-verdict__strength">
          {detailPin.kind === 'thread' ? <EntityLink kind="story" id={detailPin.refId}>{i?.label}</EntityLink>
            : detailPin.kind === 'country' ? <EntityLink kind="country" id={detailPin.refId}>{i?.label}</EntityLink> : i?.label}
        </p>
        {detailPin.kind === 'thread' && isPhone ? storyTree : null}
        <div className="board-actions">
          {detailPin.kind === 'actor' && !follows.actors.some((a) => a.toLowerCase() === detailPin.refId.toLowerCase())
            ? <Button onClick={() => follows.followActor(detailPin.refId)}>Follow actor</Button> : null}
          {detailPin.retiredAt
            ? <Button disabled={full} onClick={() => { state.edit((b) => restorePin(b, detailPin.pinId)); closePanel(); }}>{full ? `Restore pin (budget of ${PIN_BUDGET} is full)` : 'Restore pin'}</Button>
            : <Button onClick={() => { state.edit((b) => retirePin(b, detailPin.pinId)); setSelected((s) => s.filter((x) => x !== detailPin.pinId)); closePanel(); }}>Retire pin</Button>}
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

  // On the map the rail starts collapsed; an open panel (a pin, a string) or its arrow opens it.
  const thinRail = mapView && !railOpen && !(sheet && !isPhone);
  const empty = boards.settled && !boards.boards.length && !boardId;

  return (
    <div className={`board-page${sheet ? ' has-sheet-open' : ''}`} onKeyDown={onKeyDown}>
      <BoardTopBar
        board={board}
        pinCount={liveCount}
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
          <Chip key={b.boardId} selected={b.boardId === boardId} onClick={() => goTo(b.boardId)}>{b.name}</Chip>
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
            {mapView ? <span className="board-hint">Click a pin or an arc for its detail. Switch to Graph to connect pins.</span> : <>
              <Button disabled={selected.length !== 2} onClick={connectSelected} title="Select two pins, then connect (or press c)">Connect</Button>
              <span className="board-hint">
                {selected.length === 0 ? 'Drag one pin onto another, or select two and press Connect.'
                  : selected.length === 1 ? `Selected: ${labelOf(selected[0])}. Select a second pin.`
                    : `Selected: ${labelOf(selected[0])} and ${labelOf(selected[1])}.`}
              </span>
            </>}
            {confirmDelete ? (
              <span className="board-confirm" role="group" aria-label="Confirm delete">
                <span>Delete &ldquo;{board.name}&rdquo;?</span>
                <Button compact onClick={deleteBoard}>Yes, delete</Button>
                <Button compact onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </span>
            ) : <Button compact onClick={() => setConfirmDelete(true)}>Delete board</Button>}
          </div>

          <div className={`board-main${thinRail ? ' board-main--thin' : ''}`}>
            <div className="board-canvas">
              {mapView ? (
                <BoardMap
                  pins={pins}
                  strings={board.strings}
                  info={info}
                  stories={records.stories}
                  pickedKey={pickedKey}
                  ghosts={missing}
                  failed={failed}
                  coverageGap={coverage?.gaps?.[0] || null}
                  onPickPin={(pinId) => setPanel({ type: 'pin', pinId })}
                  onPickString={(s) => setPanel({ type: 'string', string: s })}
                  onAddGhost={addActor}
                />
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
                  stories={records.stories}
                  today={today}
                />
              )}
              <DueStrip stories={liveStories} today={today} labelOf={threadLabel} />
              {storyTree && !isPhone ? (
                <Card as="section" aria-label={`Story tree: ${labelOf(detailPin.pinId)}`}>
                  <SectionHeader label={labelOf(detailPin.pinId)} hint="Story tree" as="h2"><Button compact onClick={closePanel}>Close tree</Button></SectionHeader>
                  {storyTree}
                </Card>
              ) : null}
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
                        <button type="button" className="board-strings__btn" onClick={() => setPanel({ type: 'pin', pinId: p.pinId })}>{KIND_WORD[p.kind]}: {labelOf(p.pinId)}{p.retiredAt ? ' (retired)' : ''}</button>
                        {!p.line && p.kind === 'thread' && info[p.pinId]?.hasHeadline ? <span className="board-pinrow__tag">Latest headline</span> : null}
                      </div>
                      <RecordPinDetails pin={p} story={records.stories[p.refId]} today={today} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            {thinRail ? <MapRail board={board} stories={liveStories} links={records.links} missing={missing} onOpen={() => setRailOpen(true)} /> : (
            <div className="board-rail">
              {mapView ? <Button compact onClick={() => setRailOpen(false)} aria-label="Collapse this week on your board">› Collapse</Button> : null}
              {!isPhone ? sheet : null}
              <BoardWeekly board={board} info={info} stories={liveStories} links={records.links} loading={records.loading}
                onAddPin={(threadId) => addToBoard({ kind: 'thread', refId: threadId })}
                onDismissLink={(threadId) => state.edit((b) => ({ ...b, dismissed: [...new Set([...b.dismissed, threadId])] }))} />
              <RailBranches stories={liveStories} labelOf={threadLabel} today={today} />
              <MissingCard actors={missing} full={full} onFollow={follows.followActor} onAdd={addActor} />
              <DivergencePanel board={board} stories={liveStories} labelOf={labelOf}
                onRestore={(a, b) => state.edit((bd) => restoreString(bd, a, b))}
                onWeight={(forkId, branchId, percent) => state.edit((bd) => setWeight(bd, forkId, branchId, percent))} />
            </div>)}
          </div>
          <ArrivalsTray key={board.boardId} board={board} labelOf={labelOf}
            onDismiss={(id) => state.edit((b) => ({...b, dismissed: [...new Set([...b.dismissed, id])]}))}
            onKeep={(card) => {
              state.edit((b) => {
                const added = addPin(b, {kind: 'thread', refId: card.threadId});
                if (added.status !== 'added') return b;
                const pin = added.board.pins.find((p) => p.refId === card.threadId);
                return keepString(added.board, pin.pinId, card.via[0].pinId, card.via[0].mechanism);
              });
            }} />
          {board.recordAvailable ? <UnsettledZone ids={countIds} counts={counts} stories={liveStories} today={today} /> : null}
          <MonthlyCard board={board} stories={liveStories} today={today} labelOf={labelOf} storyLabel={threadLabel}
            onRetire={(pinId) => state.edit((b) => retirePin(b, pinId))} />
          {import.meta.env.DEV ? <details className="board-fold"><summary>Alerts (dev harness only: not stored, nothing sent)</summary><AlertsPanel board={board} labelOf={labelOf} /></details> : null}
          <details className="board-fold"><summary>How the board folds</summary><FoldingRules /></details>
        </>
      ) : null}
      {board ? null : (state.loading ? <p className="board-line" aria-busy="true">Loading the board.</p> : null)}
      {empty ? <Card as="section" aria-label="Region presets"><SectionHeader label="Region presets" as="h2" /><PresetsPanel presets={presets.presets} loading={presets.loading} canFork signInHref={signInHref} onFork={forkPreset} /></Card> : null}
      {isPhone ? sheet : null}
    </div>
  );
}
