import { useCallback, useEffect, useState } from 'react';
import { reportFetchError } from '@/shared/api/errorSink';
import { callBoard } from '@/features/board/lib/boardApi.js';

// The member's boards ([{boardId, name, pinCount, updatedAt}], newest first) and the create / delete calls.
// Fails empty: a failed list is an empty list plus a report to the error sink.
export function useBoards(enabled) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await callBoard('list_boards');
      setBoards(Array.isArray(list) ? list : []);
    } catch (err) {
      reportFetchError('board-list', err);
      setBoards([]);
    } finally {
      setSettled(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setBoards([]); setSettled(false); return undefined; }
    let live = true;
    setLoading(true);
    refresh().finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [enabled, refresh]);

  const create = useCallback(async (name, presetFrom) => {
    const board = await callBoard('create_board', { name, ...(presetFrom ? { presetFrom } : {}) });
    await refresh();
    return board;
  }, [refresh]);

  const fork = useCallback(async (presetId, name) => {
    const board = await callBoard('fork_preset', { presetId, ...(name ? { name } : {}) });
    await refresh();
    return board;
  }, [refresh]);

  const remove = useCallback(async (boardId) => {
    await callBoard('delete_board', { boardId });
    await refresh();
  }, [refresh]);

  return { boards, loading, settled, refresh, create, fork, remove };
}
