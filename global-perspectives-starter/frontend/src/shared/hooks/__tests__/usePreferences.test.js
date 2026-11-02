// usePreferences: the reader's opt-in email toggles and followed countries. Defaults are all OFF.
// save() and follow() are optimistic and must revert on failure (never a success state that did not
// persist). Signed out, anonymous, or with no endpoint configured: no request is made.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockUseAuth = vi.fn();
const fetchPrefs = vi.fn();
const savePrefs = vi.fn();
const followCountry = vi.fn();
const unfollowCountry = vi.fn();

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('@/shared/api/restProxy', () => ({
  fetchPrefs: (...a) => fetchPrefs(...a),
  savePrefs: (...a) => savePrefs(...a),
  followCountry: (...a) => followCountry(...a),
  unfollowCountry: (...a) => unfollowCountry(...a),
}));

import { usePreferences } from '@/shared/hooks/usePreferences';

const DEFAULTS = { breakingOptIn: false, digestOptIn: false, digestCadence: 'weekly', driftOptIn: false, followedCountries: [] };
const STORED = { breakingOptIn: false, digestOptIn: true, digestCadence: 'daily', driftOptIn: true, followedCountries: ['Iran', 'Japan'] };
const USER = { uid: 'u1', isAnonymous: false };

let currentUser;
beforeEach(() => {
  window.USER_PREFS_ENDPOINT = 'https://prefs.example/api';
  currentUser = USER;
  mockUseAuth.mockImplementation(() => ({ user: currentUser }));
  fetchPrefs.mockReset().mockResolvedValue({ prefs: STORED });
  savePrefs.mockReset().mockResolvedValue({});
  followCountry.mockReset().mockResolvedValue({});
  unfollowCountry.mockReset().mockResolvedValue({});
});
afterEach(() => { delete window.USER_PREFS_ENDPOINT; });

// A request that fails only after React has rendered the optimistic state, as a real network error
// does. (An already-rejected promise would reach the hook's catch before the render that captures
// the previous prefs, which is a timing the browser never produces.)
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Start `call()` inside act (so the optimistic render happens), then fail the request.
async function failAfterRender(mock, call, err) {
  const d = deferred();
  mock.mockReturnValue(d.promise);
  let pending;
  act(() => { pending = call(); });
  let ok;
  await act(async () => { d.reject(err); ok = await pending; });
  return ok;
}

async function loaded() {
  const hook = renderHook(() => usePreferences());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('usePreferences — not signed in / not configured', () => {
  it.each([
    ['signed out', null],
    ['anonymous guest', { uid: 'g', isAnonymous: true }],
  ])('%s: no request, defaults (everything off), not loading, signedIn false', async (_l, user) => {
    currentUser = user;
    const { result } = await loaded();
    expect(fetchPrefs).not.toHaveBeenCalled();
    expect(result.current.signedIn).toBe(false);
    expect(result.current.prefs).toEqual(DEFAULTS);
    expect(result.current.error).toBeNull();
  });

  it('reports endpointMissing and makes no request when the prefs endpoint is not configured', async () => {
    delete window.USER_PREFS_ENDPOINT;
    const { result } = await loaded();
    expect(result.current.endpointMissing).toBe(true);
    expect(result.current.signedIn).toBe(true);
    expect(fetchPrefs).not.toHaveBeenCalled();
    expect(result.current.prefs).toEqual(DEFAULTS);
  });
});

describe('usePreferences — load', () => {
  it('starts loading with defaults, then shows the stored prefs', async () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.loading).toBe(true);
    expect(result.current.prefs).toEqual(DEFAULTS);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchPrefs).toHaveBeenCalledTimes(1);
    expect(result.current.prefs).toEqual(STORED);
    expect(result.current.signedIn).toBe(true);
    expect(result.current.endpointMissing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps the OFF defaults when the server has no prefs for the user yet', async () => {
    fetchPrefs.mockResolvedValue({ prefs: null });
    const { result } = await loaded();
    expect(result.current.prefs).toEqual(DEFAULTS);
    expect(result.current.error).toBeNull();
  });

  it('shows the failure message (and defaults, no fake data) when the load fails', async () => {
    fetchPrefs.mockRejectedValue(new Error('HTTP 502'));
    const { result } = await loaded();
    expect(result.current.error).toBe('HTTP 502');
    expect(result.current.prefs).toEqual(DEFAULTS);
  });

  it('uses a generic message when the load failure has none', async () => {
    fetchPrefs.mockRejectedValue({});
    const { result } = await loaded();
    expect(result.current.error).toBe('Could not load preferences');
  });

  it('isFollowing reflects the followed list', async () => {
    const { result } = await loaded();
    expect(result.current.isFollowing('Iran')).toBe(true);
    expect(result.current.isFollowing('Brazil')).toBe(false);
  });
});

describe('usePreferences — save (optimistic)', () => {
  it('applies the patch immediately, sends only the patch, then adopts the server prefs and returns true', async () => {
    let resolve;
    savePrefs.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = await loaded();
    let pending;
    act(() => { pending = result.current.save({ breakingOptIn: true }); });
    expect(result.current.prefs.breakingOptIn).toBe(true); // optimistic, server not answered yet
    expect(result.current.prefs.digestCadence).toBe('daily'); // the rest is untouched
    expect(result.current.saving).toBe(true);
    expect(savePrefs).toHaveBeenCalledWith({ breakingOptIn: true });
    let ok;
    await act(async () => { resolve({ prefs: { ...STORED, breakingOptIn: true, digestOptIn: false } }); ok = await pending; });
    expect(ok).toBe(true);
    expect(result.current.saving).toBe(false);
    expect(result.current.prefs).toEqual({ ...STORED, breakingOptIn: true, digestOptIn: false });
    expect(result.current.error).toBeNull();
  });

  it('keeps the optimistic value when the server answers without prefs', async () => {
    savePrefs.mockResolvedValue({});
    const { result } = await loaded();
    let ok;
    await act(async () => { ok = await result.current.save({ digestCadence: 'weekly' }); });
    expect(ok).toBe(true);
    expect(result.current.prefs).toEqual({ ...STORED, digestCadence: 'weekly' });
  });

  it('reverts to the previous prefs on failure, sets the error, returns false', async () => {
    const { result } = await loaded();
    const ok = await failAfterRender(savePrefs, () => result.current.save({ breakingOptIn: true, digestCadence: 'weekly' }), new Error('HTTP 500'));
    expect(ok).toBe(false);
    expect(result.current.prefs).toEqual(STORED);
    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.saving).toBe(false);
  });

  it('uses "Could not save" when the failure has no message, and clears the error on the next attempt', async () => {
    const { result } = await loaded();
    await failAfterRender(savePrefs, () => result.current.save({ breakingOptIn: true }), {});
    expect(result.current.error).toBe('Could not save');
    expect(result.current.prefs).toEqual(STORED);
    savePrefs.mockReset().mockResolvedValue({});
    await act(async () => { await result.current.save({ breakingOptIn: true }); });
    expect(result.current.error).toBeNull();
    expect(result.current.prefs.breakingOptIn).toBe(true);
  });
});

describe('usePreferences — follow / unfollow (optimistic)', () => {
  it('follow adds the country (sorted), turns drift emails opt-in on, calls followCountry and adopts server prefs', async () => {
    let resolve;
    followCountry.mockReturnValue(new Promise((r) => { resolve = r; }));
    fetchPrefs.mockResolvedValue({ prefs: { ...DEFAULTS, followedCountries: ['Japan'] } });
    const { result } = await loaded();
    let pending;
    act(() => { pending = result.current.follow('Brazil', true); });
    expect(result.current.prefs.followedCountries).toEqual(['Brazil', 'Japan']);
    expect(result.current.prefs.driftOptIn).toBe(true);
    expect(result.current.isFollowing('Brazil')).toBe(true);
    expect(followCountry).toHaveBeenCalledWith('Brazil');
    expect(unfollowCountry).not.toHaveBeenCalled();
    const server = { ...DEFAULTS, driftOptIn: true, followedCountries: ['Brazil', 'Japan'] };
    let ok;
    await act(async () => { resolve({ prefs: server }); ok = await pending; });
    expect(ok).toBe(true);
    expect(result.current.prefs).toEqual(server);
  });

  it('unfollow removes the country, leaves driftOptIn as it was, and calls unfollowCountry', async () => {
    const { result } = await loaded();
    let ok;
    await act(async () => { ok = await result.current.follow('Iran', false); });
    expect(ok).toBe(true);
    expect(unfollowCountry).toHaveBeenCalledWith('Iran');
    expect(followCountry).not.toHaveBeenCalled();
    expect(result.current.prefs.followedCountries).toEqual(['Japan']);
    expect(result.current.prefs.driftOptIn).toBe(true);
    expect(result.current.isFollowing('Iran')).toBe(false);
  });

  it('reverts the follow (list and driftOptIn) and reports the server reason when it is refused, e.g. members only', async () => {
    fetchPrefs.mockResolvedValue({ prefs: DEFAULTS });
    const { result } = await loaded();
    const ok = await failAfterRender(followCountry, () => result.current.follow('Brazil', true), new Error('members_only'));
    expect(ok).toBe(false);
    expect(result.current.prefs).toEqual(DEFAULTS);
    expect(result.current.isFollowing('Brazil')).toBe(false);
    expect(result.current.error).toBe('members_only');
    expect(result.current.saving).toBe(false);
  });

  it('reverts a failed unfollow so the country stays followed', async () => {
    const { result } = await loaded();
    const ok = await failAfterRender(unfollowCountry, () => result.current.follow('Iran', false), {});
    expect(ok).toBe(false);
    expect(result.current.prefs).toEqual(STORED);
    expect(result.current.error).toBe('Could not update follow');
  });

  it('follow with no country does nothing and returns false', async () => {
    const { result } = await loaded();
    let ok;
    await act(async () => { ok = await result.current.follow('', true); });
    expect(ok).toBe(false);
    expect(followCountry).not.toHaveBeenCalled();
    expect(unfollowCountry).not.toHaveBeenCalled();
    expect(result.current.prefs).toEqual(STORED);
  });
});
