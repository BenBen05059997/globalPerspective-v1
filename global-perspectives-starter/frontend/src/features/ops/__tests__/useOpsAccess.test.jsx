import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

let auth;
const fetchOps = vi.fn();
vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/shared/api/restProxy', () => ({ fetchOps: (...a) => fetchOps(...a) }));

import { useOpsAccess, rememberOps, resetOpsAccess } from '@/features/ops/hooks/useOpsAccess.js';

beforeEach(() => { auth = { user: { uid: 'u1', isAnonymous: false }, loading: false }; resetOpsAccess(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('useOpsAccess (the account-area Ops link)', () => {
  it('is false until the ops action has answered 200, then true', async () => {
    fetchOps.mockResolvedValue({ status: 200, data: {} });
    const { result } = renderHook(() => useOpsAccess());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false on a 403 and on a failed call, and asks once per uid for a 403', async () => {
    fetchOps.mockResolvedValue({ status: 403, data: null });
    const { result, rerender } = renderHook(() => useOpsAccess());
    await waitFor(() => expect(fetchOps).toHaveBeenCalledTimes(1));
    rerender();
    expect(result.current).toBe(false);
    expect(fetchOps).toHaveBeenCalledTimes(1);
    resetOpsAccess();
    fetchOps.mockRejectedValue(new Error('Proxy HTTP 502'));
    const failed = renderHook(() => useOpsAccess());
    await waitFor(() => expect(fetchOps).toHaveBeenCalledTimes(2));
    expect(failed.result.current).toBe(false);
  });

  it('does not ask when signed out, still loading or a guest', () => {
    for (const a of [{ user: null, loading: false }, { user: { uid: 'u', isAnonymous: false }, loading: true }, { user: { uid: 'g', isAnonymous: true }, loading: false }]) {
      auth = a;
      const { result } = renderHook(() => useOpsAccess());
      expect(result.current).toBe(false);
    }
    expect(fetchOps).not.toHaveBeenCalled();
  });

  it('uses what the page already learned and does not ask again', () => {
    rememberOps('u1', true);
    const { result } = renderHook(() => useOpsAccess());
    expect(result.current).toBe(true);
    expect(fetchOps).not.toHaveBeenCalled();
  });
});
