import { useCallback, useEffect, useRef, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { callBoard } from '@/features/board/lib/boardApi.js';

const SAVE_DELAY_MS = 600;
export const STALE_NOTICE = 'This board changed in another tab; reloaded.';

// One board, loaded by id, with every change saved through update_board (debounced). `edit(fn)` applies
// fn(board) locally at once. Saves are serialised: one is in flight at a time, edits made meanwhile queue behind it
// and the latest state is sent next. Each save carries the `updatedAt` the client last received (`expectedUpdatedAt`);
// the server answers 409 stale_board when the board has moved on (another tab or device), and the client then reloads
// it and says so once. Any other rejection (budget, schema) puts the server's copy back and says why, but never over
// an edit made after the rejected save was sent. The page flushes a pending change when it is hidden or closed.
// `visitedAt` is the board's last-visit stamp as it was when this session loaded it (the server moves it on afterwards).
export function useBoard(boardId, enabled, onSaved) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [visitedAt, setVisitedAt] = useState(null);
  const latest = useRef(null);
  const version = useRef(0);
  const saved = useRef(0);
  const base = useRef(null); // the updatedAt last received from the server
  const flight = useRef(null);
  const timer = useRef(null);
  const idRef = useRef(boardId);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  const reload = useCallback(async (id) => {
    try {
      const back = await callBoard('get_board', { boardId: id });
      if (idRef.current !== id) return;
      latest.current = back;
      base.current = back.updatedAt;
      saved.current = version.current;
      setBoard(back);
    } catch (e) { reportFetchError('board-reload', e); }
  }, []);

  const drain = useCallback(async (keepalive) => {
    const id = idRef.current;
    setSaving(true);
    try {
      while (idRef.current === id && latest.current && version.current !== saved.current) {
        const sending = latest.current;
        const v = version.current;
        try {
          const out = await callBoard('update_board', { boardId: id, board: sending, ...(base.current ? { expectedUpdatedAt: base.current } : {}) }, keepalive ? { keepalive: true } : {});
          if (idRef.current !== id) return;
          saved.current = v;
          base.current = out.updatedAt;
          setSaveError('');
          if (version.current === v) { latest.current = out; setBoard(out); }
          onSavedRef.current?.(out);
        } catch (err) {
          if (idRef.current !== id) return;
          if (err.status === 409 || err.code === 'stale_board') {
            await reload(id);
            setSaveError(STALE_NOTICE);
            return;
          }
          reportFetchError('board-save', err);
          if (version.current === v) { // nothing newer to protect: show the server's copy and say why
            setSaveError(err.message || 'The change could not be saved.');
            saved.current = v;
            await reload(id);
            return;
          }
          // a newer edit was made while this save was in flight: it is kept and sent next; this rejection is not shown over it
          saved.current = v;
        }
      }
    } finally {
      setSaving(false);
    }
  }, [reload]);

  const save = useCallback((opts = {}) => {
    clearTimeout(timer.current);
    timer.current = null;
    if (!idRef.current || !latest.current || version.current === saved.current) return flight.current || Promise.resolve();
    if (!flight.current) {
      flight.current = drain(Boolean(opts.keepalive)).finally(() => { flight.current = null; });
    }
    return flight.current;
  }, [drain]);

  useEffect(() => {
    idRef.current = boardId;
    latest.current = null;
    version.current = 0;
    saved.current = 0;
    base.current = null;
    flight.current = null;
    setBoard(null);
    setNotFound(false);
    setSaveError('');
    setVisitedAt(null);
    if (!enabled || !boardId) return undefined;
    let live = true;
    setLoading(true);
    callBoard('get_board', { boardId })
      .then((b) => { if (live) { latest.current = b; base.current = b.updatedAt; setVisitedAt(b.lastVisitedAt || null); setBoard(b); } })
      .catch((err) => {
        if (!live) return;
        if (err.status === 404) setNotFound(true);
        else reportFetchError('board-get', err);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
      if (version.current !== saved.current) save(); // leave nothing unsaved when the board changes
    };
  }, [boardId, enabled, save]);

  // closing or hiding the tab: send what is pending now (a keepalive request survives the page going away)
  useEffect(() => {
    const flush = () => { if (version.current !== saved.current) save({ keepalive: true }); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [save]);

  const edit = useCallback((fn) => {
    if (!latest.current) return;
    latest.current = fn(latest.current);
    version.current += 1;
    setBoard(latest.current);
    setSaveError('');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  }, [save]);

  return { board, loading, notFound, saving, saveError, visitedAt, edit, flush: save };
}
