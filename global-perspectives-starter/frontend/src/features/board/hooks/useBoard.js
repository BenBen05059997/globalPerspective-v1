import { useCallback, useEffect, useRef, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { callBoard } from '@/features/board/lib/boardApi.js';

const SAVE_DELAY_MS = 600;

// One board, loaded by id, with every change saved through update_board (debounced). `edit(fn)` applies
// fn(board) locally at once; the save then replaces the local copy with the server's normalised board unless a
// newer local edit is already waiting. A rejected save (budget, schema) puts the server's copy back and says why.
export function useBoard(boardId, enabled, onSaved) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const latest = useRef(null);
  const version = useRef(0);
  const saved = useRef(0);
  const timer = useRef(null);
  const idRef = useRef(boardId);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    const id = idRef.current;
    const sending = latest.current;
    const v = version.current;
    if (!id || !sending || v === saved.current) return;
    setSaving(true);
    try {
      const out = await callBoard('update_board', { boardId: id, board: sending });
      saved.current = v;
      setSaveError('');
      if (idRef.current === id && version.current === v) { latest.current = out; setBoard(out); }
      onSavedRef.current?.(out);
    } catch (err) {
      reportFetchError('board-save', err);
      setSaveError(err.message || 'The change could not be saved.');
      saved.current = v;
      try {
        const back = await callBoard('get_board', { boardId: id });
        if (idRef.current === id) { latest.current = back; setBoard(back); }
      } catch (e) { reportFetchError('board-reload', e); }
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    idRef.current = boardId;
    latest.current = null;
    version.current = 0;
    saved.current = 0;
    setBoard(null);
    setNotFound(false);
    setSaveError('');
    if (!enabled || !boardId) return undefined;
    let live = true;
    setLoading(true);
    callBoard('get_board', { boardId })
      .then((b) => { if (live) { latest.current = b; setBoard(b); } })
      .catch((err) => {
        if (!live) return;
        if (err.status === 404) setNotFound(true);
        else reportFetchError('board-get', err);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
      if (version.current !== saved.current) save(); // leave nothing unsaved when the board changes or the page closes
    };
  }, [boardId, enabled, save]);

  const edit = useCallback((fn) => {
    if (!latest.current) return;
    latest.current = fn(latest.current);
    version.current += 1;
    setBoard(latest.current);
    setSaveError('');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  }, [save]);

  return { board, loading, notFound, saving, saveError, edit, flush: save };
}
