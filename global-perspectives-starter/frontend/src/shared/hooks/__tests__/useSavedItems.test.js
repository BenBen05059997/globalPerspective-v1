// useSavedItems: the signed-in reader's saved list. Saved items require sign-in (unlike the public
// data hooks): signed out means no request at all. Save/unsave are NOT optimistic: the list changes
// only after the server confirms, and a failure leaves it untouched and rejects to the caller.
// The hook keeps a module-level cache per user, so each test loads a fresh module copy.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockUseAuth = vi.fn();
const fetchSavedItems = vi.fn();
const saveItem = vi.fn();
const unsaveItem = vi.fn();

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('@/shared/api/restProxy', () => ({
  fetchSavedItems: (...a) => fetchSavedItems(...a),
  saveItem: (...a) => saveItem(...a),
  unsaveItem: (...a) => unsaveItem(...a),
}));

const USER_A = { uid: 'a', isAnonymous: false };
const USER_B = { uid: 'b', isAnonymous: false };
const THREAD = { itemType: 'thread', itemId: 't1', savedAt: '2026-09-20T00:00:00.000Z', metadata: { title: 'Thread one' } };
const COUNTRY = { itemType: 'country', itemId: 'Iran', savedAt: '2026-09-21T00:00:00.000Z', metadata: { name: 'Iran' } };

let useSavedItems;
// A stable user object per render (the hook's effect depends on the object identity).
let currentUser;

beforeEach(async () => {
  vi.resetModules();
  ({ useSavedItems } = await import('@/shared/hooks/useSavedItems'));
  fetchSavedItems.mockReset().mockResolvedValue({ data: [THREAD, COUNTRY] });
  saveItem.mockReset().mockResolvedValue({});
  unsaveItem.mockReset().mockResolvedValue({});
  currentUser = USER_A;
  mockUseAuth.mockImplementation(() => ({ user: currentUser }));
});

describe('useSavedItems — signed out', () => {
  it('makes no request, returns an empty list and no error', async () => {
    currentUser = null;
    const { result } = renderHook(() => useSavedItems());
    expect(result.current.savedItems).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchSavedItems).not.toHaveBeenCalled();
  });

  it('save and unsave are no-ops with no request', async () => {
    currentUser = null;
    const { result } = renderHook(() => useSavedItems());
    await act(async () => {
      await result.current.save('thread', 't1', { title: 'x' });
      await result.current.unsave('thread', 't1');
    });
    expect(saveItem).not.toHaveBeenCalled();
    expect(unsaveItem).not.toHaveBeenCalled();
    expect(result.current.savedItems).toEqual([]);
    expect(result.current.isSaved('thread', 't1')).toBe(false);
  });

  it('empties the list and drops the cache when the reader signs out', async () => {
    const { result, rerender } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    currentUser = null;
    rerender();
    await waitFor(() => expect(result.current.savedItems).toEqual([]));
    // signing back in as the same user must fetch again, not resurrect the old cache
    currentUser = { ...USER_A };
    rerender();
    await waitFor(() => expect(fetchSavedItems).toHaveBeenCalledTimes(2));
  });
});

describe('useSavedItems — list', () => {
  it('fetches once on sign-in, shows loading, then the items; isSaved matches on type and id', async () => {
    const { result } = renderHook(() => useSavedItems());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchSavedItems).toHaveBeenCalledTimes(1);
    expect(result.current.savedItems).toEqual([THREAD, COUNTRY]);
    expect(result.current.error).toBeNull();
    expect(result.current.isSaved('thread', 't1')).toBe(true);
    expect(result.current.isSaved('country', 'Iran')).toBe(true);
    expect(result.current.isSaved('country', 't1')).toBe(false);
    expect(result.current.isSaved('thread', 'Iran')).toBe(false);
  });

  it('treats a response with no data as an empty list', async () => {
    fetchSavedItems.mockResolvedValue({});
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.savedItems).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a fetch failure as an error message with an empty list (no fake items)', async () => {
    fetchSavedItems.mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));
    expect(result.current.loading).toBe(false);
    expect(result.current.savedItems).toEqual([]);
  });

  it('shares the per-user cache across hook instances (one request) but refetches for a different user', async () => {
    const first = renderHook(() => useSavedItems());
    await waitFor(() => expect(first.result.current.savedItems).toHaveLength(2));
    const second = renderHook(() => useSavedItems());
    await waitFor(() => expect(second.result.current.savedItems).toHaveLength(2));
    expect(fetchSavedItems).toHaveBeenCalledTimes(1);

    fetchSavedItems.mockResolvedValue({ data: [COUNTRY] });
    currentUser = USER_B;
    first.rerender();
    await waitFor(() => expect(first.result.current.savedItems).toEqual([COUNTRY]));
    expect(fetchSavedItems).toHaveBeenCalledTimes(2);
  });

  it('ignores a response that arrives after unmount', async () => {
    let resolve;
    fetchSavedItems.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result, unmount } = renderHook(() => useSavedItems());
    unmount();
    await act(async () => { resolve({ data: [THREAD] }); });
    expect(result.current.savedItems).toEqual([]);
  });
});

describe('useSavedItems — save', () => {
  it('sends type, id and metadata, then puts the item first with a savedAt stamp', async () => {
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    await act(async () => { await result.current.save('story', 's9', { title: 'New story' }); });
    expect(saveItem).toHaveBeenCalledTimes(1);
    expect(saveItem).toHaveBeenCalledWith('story', 's9', { title: 'New story' });
    expect(result.current.savedItems).toHaveLength(3);
    const [first] = result.current.savedItems;
    expect(first).toMatchObject({ itemType: 'story', itemId: 's9', metadata: { title: 'New story' } });
    expect(Number.isNaN(Date.parse(first.savedAt))).toBe(false);
    expect(result.current.isSaved('story', 's9')).toBe(true);
  });

  it('defaults metadata to {} and saving an already-saved item moves it to the front without duplicating it', async () => {
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    await act(async () => { await result.current.save('country', 'Iran'); });
    expect(saveItem).toHaveBeenCalledWith('country', 'Iran', {});
    expect(result.current.savedItems.map((i) => i.itemId)).toEqual(['Iran', 't1']);
  });

  it('is not optimistic: the item appears only after the server confirms', async () => {
    let resolve;
    saveItem.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    let pending;
    act(() => { pending = result.current.save('story', 's9', {}); });
    expect(result.current.isSaved('story', 's9')).toBe(false);
    await act(async () => { resolve({}); await pending; });
    expect(result.current.isSaved('story', 's9')).toBe(true);
  });

  it('on failure rejects to the caller and leaves the list exactly as it was', async () => {
    saveItem.mockRejectedValue(new Error('HTTP 403'));
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    await act(async () => {
      await expect(result.current.save('story', 's9', {})).rejects.toThrow('HTTP 403');
    });
    expect(result.current.savedItems).toEqual([THREAD, COUNTRY]);
    expect(result.current.isSaved('story', 's9')).toBe(false);
  });

  it('a saved item survives into a second hook instance via the shared cache', async () => {
    const first = renderHook(() => useSavedItems());
    await waitFor(() => expect(first.result.current.savedItems).toHaveLength(2));
    await act(async () => { await first.result.current.save('story', 's9', {}); });
    const second = renderHook(() => useSavedItems());
    await waitFor(() => expect(second.result.current.isSaved('story', 's9')).toBe(true));
    expect(fetchSavedItems).toHaveBeenCalledTimes(1);
  });
});

describe('useSavedItems — unsave', () => {
  it('sends type and id, then removes only that item', async () => {
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    await act(async () => { await result.current.unsave('thread', 't1'); });
    expect(unsaveItem).toHaveBeenCalledTimes(1);
    expect(unsaveItem).toHaveBeenCalledWith('thread', 't1');
    expect(result.current.savedItems).toEqual([COUNTRY]);
    expect(result.current.isSaved('thread', 't1')).toBe(false);
  });

  it('keeps the item in the list until the server confirms the removal', async () => {
    let resolve;
    unsaveItem.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    let pending;
    act(() => { pending = result.current.unsave('thread', 't1'); });
    expect(result.current.isSaved('thread', 't1')).toBe(true);
    await act(async () => { resolve({}); await pending; });
    expect(result.current.isSaved('thread', 't1')).toBe(false);
  });

  it('on failure rejects to the caller and the item stays saved', async () => {
    unsaveItem.mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(() => useSavedItems());
    await waitFor(() => expect(result.current.savedItems).toHaveLength(2));
    await act(async () => {
      await expect(result.current.unsave('thread', 't1')).rejects.toThrow('HTTP 500');
    });
    expect(result.current.savedItems).toEqual([THREAD, COUNTRY]);
    expect(result.current.isSaved('thread', 't1')).toBe(true);
  });
});
