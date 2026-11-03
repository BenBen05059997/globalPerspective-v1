import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('@/features/board/lib/boardApi.js', () => ({ callBoard: call }));
vi.mock('@/shared/api/errorSink', () => ({ reportFetchError: vi.fn() }));

import { useBoard, STALE_NOTICE } from '@/features/board/hooks/useBoard.js';

const board = (name, updatedAt) => ({ boardId: 'b1', name, pins: [], strings: [], weights: {}, dismissed: [], summary: { versions: [] }, updatedAt, lastVisitedAt: '2026-10-20T08:00:00Z' });
const updates = () => call.mock.calls.filter(([a]) => a === 'update_board');
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); call.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

async function loaded(server) {
  call.mockImplementation(async (action) => { if (action === 'get_board') return server.current; throw new Error(`unexpected ${action}`); });
  const hook = renderHook(() => useBoard('b1', true));
  await waitFor(() => expect(hook.result.current.board).not.toBeNull());
  return hook;
}
const rename = (hook, name) => act(() => hook.result.current.edit((b) => ({ ...b, name })));
const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('saving a board', () => {
  it('sends the updatedAt it last received, and uses the server\'s new one for the next save', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    call.mockImplementation(async (action, body) => (action === 'update_board' ? { ...body.board, updatedAt: `after-${body.board.name}` } : server.current));
    rename(hook, 'B'); await wait(700);
    rename(hook, 'C'); await wait(700);
    expect(updates().map(([, body]) => body.expectedUpdatedAt)).toEqual(['v1', 'after-B']);
  });

  it('keeps one save in flight: an edit made meanwhile waits, and the latest state is sent next', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    const first = deferred();
    call.mockImplementation(async (action, body) => {
      if (action !== 'update_board') return server.current;
      return body.board.name === 'B' ? first.promise : { ...body.board, updatedAt: 'v3' };
    });
    rename(hook, 'B'); await wait(700);
    expect(updates()).toHaveLength(1);
    rename(hook, 'C'); await wait(700);
    rename(hook, 'D'); await wait(700);
    expect(updates()).toHaveLength(1); // still waiting for the first
    await act(async () => { first.resolve({ ...board('B', 'v2') }); await vi.advanceTimersByTimeAsync(10); });
    await waitFor(() => expect(updates()).toHaveLength(2));
    expect(updates()[1][1].board.name).toBe('D'); // the latest state, not C
    expect(updates()[1][1].expectedUpdatedAt).toBe('v2');
    await waitFor(() => expect(hook.result.current.board.name).toBe('D'));
  });

  it('a stale save (409) reloads the board and says so once; the page shows the server\'s copy', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    server.current = board('Other tab', 'v9');
    call.mockImplementation(async (action) => {
      if (action === 'update_board') throw Object.assign(new Error('changed'), { status: 409, code: 'stale_board' });
      return server.current;
    });
    rename(hook, 'Mine'); await wait(700);
    await waitFor(() => expect(hook.result.current.saveError).toBe(STALE_NOTICE));
    expect(hook.result.current.board.name).toBe('Other tab');
    expect(updates()).toHaveLength(1); // no retry loop
    call.mockImplementation(async (action, body) => (action === 'update_board' ? { ...body.board, updatedAt: 'v10' } : server.current));
    rename(hook, 'Again'); await wait(700);
    expect(updates().at(-1)[1].expectedUpdatedAt).toBe('v9'); // the reloaded version
  });

  it('a rejected save puts the server\'s copy back, but never over an edit made after it was sent', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    const first = deferred();
    call.mockImplementation(async (action, body) => {
      if (action === 'update_board') return body.board.name === 'B' ? first.promise : { ...body.board, updatedAt: 'v3' };
      return server.current;
    });
    rename(hook, 'B'); await wait(700);
    rename(hook, 'C'); // made while B is in flight
    await act(async () => { first.reject(Object.assign(new Error('Invalid board'), { status: 400, code: 'invalid_board' })); await vi.advanceTimersByTimeAsync(700); });
    await waitFor(() => expect(updates().at(-1)[1].board.name).toBe('C'));
    await waitFor(() => expect(hook.result.current.board.name).toBe('C'));
    expect(hook.result.current.saveError).toBe('');
  });

  it('with nothing newer, a rejected save shows why and the server copy', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    call.mockImplementation(async (action) => {
      if (action === 'update_board') throw Object.assign(new Error('Pin budget exceeded'), { status: 400, code: 'pin_budget_exceeded' });
      return server.current;
    });
    rename(hook, 'B'); await wait(700);
    await waitFor(() => expect(hook.result.current.saveError).toBe('Pin budget exceeded'));
    expect(hook.result.current.board.name).toBe('A');
  });

  it('flushes a pending change when the page is hidden, as a keepalive request', async () => {
    const server = { current: board('A', 'v1') };
    const hook = await loaded(server);
    call.mockImplementation(async (action, body) => (action === 'update_board' ? { ...body.board, updatedAt: 'v2' } : server.current));
    rename(hook, 'B');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await waitFor(() => expect(updates()).toHaveLength(1));
    expect(updates()[0][2]).toEqual({ keepalive: true });
  });

  it('keeps the visit stamp the session started with', async () => {
    const hook = await loaded({ current: board('A', 'v1') });
    expect(hook.result.current.visitedAt).toBe('2026-10-20T08:00:00Z');
  });
});
