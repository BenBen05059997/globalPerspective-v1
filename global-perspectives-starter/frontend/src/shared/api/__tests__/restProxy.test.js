// restProxy against a fake fetch: the request each client call really sends (URL, method, body, headers),
// when the Authorization header is present, what a failing reply turns into, and the proxy's in-flight
// de-dupe and 4-request concurrency cap. Module state (endpoint, auth provider, in-flight map, limiter)
// is reset per test by re-importing the module.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PROXY = 'https://proxy.test/read';
const ENDPOINTS = {
  SENSITIVE_PROXY_ENDPOINT: PROXY,
  SAVED_ITEMS_ENDPOINT: 'https://saved.test/',
  USER_PREFS_ENDPOINT: 'https://prefs.test/',
  BOARD_ENDPOINT: 'https://board.test/',
  POLAR_BILLING_ENDPOINT: 'https://billing.test/',
};
const original = {};

const reply = (body, { status = 200, json } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: json || (() => Promise.resolve(body)),
});
const badJson = () => Promise.reject(new SyntaxError('Unexpected token <'));

let fetchMock;
let api;

beforeEach(async () => {
  for (const [k, v] of Object.entries(ENDPOINTS)) { original[k] = window[k]; window[k] = v; }
  fetchMock = vi.fn(() => Promise.resolve(reply({ success: true, data: {} })));
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  api = await import('@/shared/api/restProxy');
});

afterEach(() => {
  for (const k of Object.keys(ENDPOINTS)) {
    if (original[k] === undefined) delete window[k]; else window[k] = original[k];
  }
  vi.unstubAllGlobals();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1);
  return { url, init, body: JSON.parse(init.body) };
};

describe('read proxy: request shape per action', () => {
  it.each([
    ['fetchTopicsCache', [], 'topics', {}],
    ['fetchSummaryCache', ['t1'], 'summary', { topicId: 't1' }],
    ['fetchPredictionCache', ['t1'], 'prediction', { topicId: 't1' }],
    ['fetchTraceCauseCache', ['t1'], 'trace_cause', { topicId: 't1' }],
    ['fetchTodayArchive', [], 'today', {}],
    ['fetchCountryFacts', [['France']], 'country_facts', { countryNames: ['France'] }],
    ['fetchLatestDailyBrief', [], 'latest_daily_brief', { lookbackDays: 30 }],
    ['fetchLatestDailyBrief', [7], 'latest_daily_brief', { lookbackDays: 7 }],
    ['fetchWeeklyBrief', [], 'weekly_brief', {}],
    ['fetchWeeklyBrief', ['2026-10-26'], 'weekly_brief', { week: '2026-10-26' }],
    ['fetchSystemsAnalysis', ['France'], 'systems_analysis', { countryName: 'France' }],
    ['fetchWebIndex', [], 'web_index', {}],
    ['fetchWebIndex', ['thread-a'], 'web_index', { threadId: 'thread-a' }],
    ['geocodeProxy', ['Paris'], 'geocode', { address: 'Paris' }],
  ])('%s(%j) POSTs {action: %s, payload} to the proxy with no Authorization header', async (fn, args, action, payload) => {
    await api[fn](...args);
    const { url, init, body } = lastCall();
    expect(url).toBe(PROXY);
    expect(init.method).toBe('POST');
    expect(body).toEqual({ action, payload });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('public reads never wait for or require sign-in: no token is requested, signed in or not', async () => {
    const getToken = vi.fn(() => Promise.resolve('tok'));
    api.setAuthProvider(getToken);
    await api.fetchTopicsCache();
    await api.fetchTodayArchive();
    await api.fetchLatestDailyBrief();
    await api.fetchWeeklyBrief();
    await api.fetchWebIndex();
    expect(getToken).not.toHaveBeenCalled();
    for (const [, init] of fetchMock.mock.calls) expect(init.headers.Authorization).toBeUndefined();
  });

  it("today's daily brief is a public read; an older day goes through the auth path", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const getToken = vi.fn(() => Promise.resolve('tok'));
    api.setAuthProvider(getToken);

    await api.fetchDailyBrief();
    expect(lastCall().body).toEqual({ action: 'daily_brief', payload: { dateKey: today } });
    expect(lastCall().init.headers.Authorization).toBeUndefined();
    await api.fetchDailyBrief(today);
    expect(lastCall().init.headers.Authorization).toBeUndefined();
    expect(getToken).not.toHaveBeenCalled();

    await api.fetchDailyBrief('2026-01-02');
    expect(lastCall().body).toEqual({ action: 'daily_brief', payload: { dateKey: '2026-01-02' } });
    expect(lastCall().init.headers.Authorization).toBe('Bearer tok');
  });
});

describe('read proxy: auth-aware actions', () => {
  it('sends the Bearer token when signed in', async () => {
    api.setAuthProvider(() => Promise.resolve('abc'));
    await api.fetchArchiveRange(14);
    const { url, body, init } = lastCall();
    expect(url).toBe(PROXY);
    expect(body).toEqual({ action: 'archive_range', payload: { days: 14 } });
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('still sends the request, without a header, when signed out (token null) or no provider is set', async () => {
    await api.fetchCorrectionsFeed();
    expect(lastCall().body).toEqual({ action: 'corrections_feed', payload: { limit: 40 } });
    expect(lastCall().init.headers.Authorization).toBeUndefined();

    api.setAuthProvider(() => Promise.resolve(null));
    await api.fetchThreadAnalyses(['a', 'b']);
    expect(lastCall().body).toEqual({ action: 'thread_analysis', payload: { threadIds: ['a', 'b'] } });
    expect(lastCall().init.headers.Authorization).toBeUndefined();
  });

  it.each([
    ['fetchNarrativeThread', ['t9'], 'narrative_thread', { threadId: 't9' }],
    ['fetchCountryIntelligence', [['Iran']], 'country_intelligence', { countryNames: ['Iran'] }],
    ['fetchCountryHistory', ['Iran'], 'country_history', { countryName: 'Iran' }],
  ])('%s sends %s with the token', async (fn, args, action, payload) => {
    api.setAuthProvider(() => Promise.resolve('t'));
    await api[fn](...args);
    expect(lastCall().body).toEqual({ action, payload });
    expect(lastCall().init.headers.Authorization).toBe('Bearer t');
  });

  it('currentAuthToken returns the token, null without a provider, and null when the provider throws', async () => {
    expect(await api.currentAuthToken()).toBeNull();
    api.setAuthProvider(() => Promise.resolve('x'));
    expect(await api.currentAuthToken()).toBe('x');
    api.setAuthProvider(() => Promise.reject(new Error('firebase down')));
    expect(await api.currentAuthToken()).toBeNull();
  });
});

describe('read proxy: reply handling', () => {
  it('unwraps a Lambda-proxy style reply (JSON string body and object body)', async () => {
    fetchMock.mockResolvedValueOnce(reply({ statusCode: 200, headers: {}, body: JSON.stringify({ success: true, data: { n: 1 } }) }));
    expect(await api.fetchTopicsCache()).toEqual({ success: true, data: { n: 1 } });
    fetchMock.mockResolvedValueOnce(reply({ statusCode: 200, body: { success: true, data: { n: 2 } } }));
    expect(await api.fetchTodayArchive()).toEqual({ success: true, data: { n: 2 } });
  });

  it('returns a plain reply untouched', async () => {
    fetchMock.mockResolvedValueOnce(reply({ success: true, data: { topics: [] } }));
    expect(await api.fetchTopicsCache()).toEqual({ success: true, data: { topics: [] } });
  });

  it('a non-200 rejects with the status and the server body; no placeholder data is invented', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'boom' }, { status: 500 }));
    const err = await api.fetchTopicsCache().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Proxy HTTP 500: {"error":"boom"}');
    expect(err.message).not.toMatch(/something went wrong/i);
  });

  it('the same for an auth-aware action', async () => {
    api.setAuthProvider(() => Promise.resolve('t'));
    fetchMock.mockResolvedValueOnce(reply({ error: 'nope' }, { status: 403 }));
    await expect(api.fetchCountryHistory('Iran')).rejects.toThrow('Proxy HTTP 403: {"error":"nope"}');
  });

  it('a 503 that carries stale topics resolves with them (direct and Lambda-proxy shapes)', async () => {
    const stale = { data: { topics: [{ topicId: 'a' }] } };
    fetchMock.mockResolvedValueOnce(reply(stale, { status: 503 }));
    expect(await api.fetchTopicsCache()).toEqual(stale);
    fetchMock.mockResolvedValueOnce(reply({ body: JSON.stringify(stale) }, { status: 503 }));
    expect(await api.fetchTopicsCache()).toEqual(stale);
  });

  it('a 503 with no stale topics still rejects', async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: { topics: [] } }, { status: 503 }));
    await expect(api.fetchTopicsCache()).rejects.toThrow(/Proxy HTTP 503/);
  });

  it('a network error rejects with the original error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.fetchTopicsCache()).rejects.toThrow('Failed to fetch');
  });

  it('a body that is not JSON: a 200 resolves null, a 502 rejects with the status', async () => {
    fetchMock.mockResolvedValueOnce(reply(null, { json: badJson }));
    expect(await api.fetchTopicsCache()).toBeNull();
    fetchMock.mockResolvedValueOnce(reply(null, { status: 502, json: badJson }));
    await expect(api.fetchTodayArchive()).rejects.toThrow('Proxy HTTP 502: null');
  });

  it('throws a config error, without calling fetch, when no endpoint is set', async () => {
    delete window.SENSITIVE_PROXY_ENDPOINT;
    await expect(api.fetchTopicsCache()).rejects.toThrow(/Missing REST proxy config/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('configureProxy sets the endpoint', async () => {
    delete window.SENSITIVE_PROXY_ENDPOINT;
    api.configureProxy({ endpoint: 'https://configured.test/p' });
    await api.fetchTopicsCache();
    expect(lastCall().url).toBe('https://configured.test/p');
  });
});

describe('read proxy: de-dupe and concurrency cap', () => {
  it('identical concurrent calls collapse into one request; the next call after it settles refetches', async () => {
    const [a, b] = await Promise.all([api.fetchSummaryCache('t1'), api.fetchSummaryCache('t1')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    await api.fetchSummaryCache('t1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('different payloads are separate requests', async () => {
    await Promise.all([api.fetchSummaryCache('t1'), api.fetchSummaryCache('t2')]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('signed-in and signed-out calls of the same action do not share a response', async () => {
    let token = null;
    api.setAuthProvider(() => Promise.resolve(token));
    const anon = api.fetchCorrectionsFeed(5);
    await Promise.resolve();
    await Promise.resolve();
    token = 'user-1';
    const member = api.fetchCorrectionsFeed(5);
    await Promise.all([anon, member]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const auths = fetchMock.mock.calls.map(([, init]) => init.headers.Authorization);
    expect(auths).toContain('Bearer user-1');
    expect(auths).toContain(undefined);
  });

  it('a failed request is not cached: the retry goes out again', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(api.fetchSummaryCache('t1')).rejects.toThrow('offline');
    await expect(api.fetchSummaryCache('t1')).resolves.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('at most 4 requests are in flight; the rest start as earlier ones finish', async () => {
    const pending = [];
    let active = 0;
    let peak = 0;
    fetchMock.mockImplementation(() => new Promise((resolve) => {
      active += 1;
      peak = Math.max(peak, active);
      pending.push(() => { active -= 1; resolve(reply({ success: true })); });
    }));
    const calls = Array.from({ length: 7 }, (_, i) => api.fetchSummaryCache(`t${i}`));
    await vi.waitFor(() => expect(pending.length).toBe(4));
    expect(fetchMock).toHaveBeenCalledTimes(4);

    pending.shift()();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    while (pending.length < 4 && fetchMock.mock.calls.length < 7) await new Promise((r) => setTimeout(r, 0));
    while (pending.length) { pending.shift()(); await new Promise((r) => setTimeout(r, 0)); }
    await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(peak).toBeLessThanOrEqual(4);
  });
});

describe('saved items (SAVED_ITEMS_ENDPOINT)', () => {
  it('save, unsave and list send the action to the saved-items endpoint with the Bearer token', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    await api.saveItem('story', 'thread-1', { title: 'T' });
    expect(lastCall().url).toBe('https://saved.test/');
    expect(lastCall().init.method).toBe('POST');
    expect(lastCall().init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
    expect(lastCall().body).toEqual({ action: 'save_item', payload: { itemType: 'story', itemId: 'thread-1', metadata: { title: 'T' } } });

    await api.unsaveItem('story', 'thread-1');
    expect(lastCall().body).toEqual({ action: 'unsave_item', payload: { itemType: 'story', itemId: 'thread-1' } });

    await api.fetchSavedItems();
    expect(lastCall().body).toEqual({ action: 'get_saved_items', payload: {} });
    await api.fetchSavedItems('country');
    expect(lastCall().body).toEqual({ action: 'get_saved_items', payload: { itemType: 'country' } });
  });

  it('signed out: rejects with "Sign in required" and sends nothing', async () => {
    await expect(api.fetchSavedItems()).rejects.toThrow('Sign in required');
    api.setAuthProvider(() => Promise.resolve(null));
    await expect(api.saveItem('story', 'x')).rejects.toThrow('Sign in required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a non-200 rejects with the status and body; a missing endpoint rejects without fetching', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ error: 'bad' }, { status: 401 }));
    await expect(api.fetchSavedItems()).rejects.toThrow('SavedItems HTTP 401: {"error":"bad"}');
    delete window.SAVED_ITEMS_ENDPOINT;
    fetchMock.mockClear();
    await expect(api.fetchSavedItems()).rejects.toThrow('Missing SAVED_ITEMS_ENDPOINT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('preferences (USER_PREFS_ENDPOINT)', () => {
  it('get_prefs, set_prefs and follow/unfollow send the right action and payload with the token', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    await api.fetchPrefs();
    expect(lastCall().url).toBe('https://prefs.test/');
    expect(lastCall().init.headers.Authorization).toBe('Bearer tok');
    expect(lastCall().body).toEqual({ action: 'get_prefs', payload: {} });

    await api.savePrefs({ weeklyEmail: true });
    expect(lastCall().body).toEqual({ action: 'set_prefs', payload: { weeklyEmail: true } });
    await api.followCountry('Iran');
    expect(lastCall().body).toEqual({ action: 'follow_country', payload: { country: 'Iran' } });
    await api.unfollowCountry('Iran');
    expect(lastCall().body).toEqual({ action: 'unfollow_country', payload: { country: 'Iran' } });
  });

  it('signed out: rejects "Sign in required", never calls fetch', async () => {
    await expect(api.fetchPrefs()).rejects.toThrow('Sign in required');
    await expect(api.savePrefs({ a: 1 })).rejects.toThrow('Sign in required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a 403 members_only reply rejects with the status and body so callers can revert', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ error: 'members_only' }, { status: 403 }));
    await expect(api.followCountry('Iran')).rejects.toThrow('Prefs HTTP 403: {"error":"members_only"}');
  });

  it('missing endpoint rejects without fetching', async () => {
    delete window.USER_PREFS_ENDPOINT;
    api.setAuthProvider(() => Promise.resolve('tok'));
    await expect(api.fetchPrefs()).rejects.toThrow('Missing USER_PREFS_ENDPOINT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('breaking alerts (public, USER_PREFS_ENDPOINT)', () => {
  it('fetchAlerts posts list_alerts with no Authorization header even when signed in, and returns the body', async () => {
    const getToken = vi.fn(() => Promise.resolve('tok'));
    api.setAuthProvider(getToken);
    fetchMock.mockResolvedValueOnce(reply({ ok: true, alerts: [{ id: 'a1', title: 'T', at: '2026-11-02T00:00:00Z' }] }));
    const out = await api.fetchAlerts();
    expect(out.alerts).toHaveLength(1);
    expect(lastCall().url).toBe('https://prefs.test/');
    expect(lastCall().body).toEqual({ action: 'list_alerts' });
    expect(lastCall().init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(getToken).not.toHaveBeenCalled();
  });

  it('fetchAlert posts get_alert with the id, no auth', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: true, alert: { id: 'a1' } }));
    expect(await api.fetchAlert('a1')).toEqual({ ok: true, alert: { id: 'a1' } });
    expect(lastCall().body).toEqual({ action: 'get_alert', payload: { id: 'a1' } });
    expect(lastCall().init.headers.Authorization).toBeUndefined();
  });

  it('non-200 and a missing endpoint reject; a non-JSON 200 resolves null', async () => {
    fetchMock.mockResolvedValueOnce(reply({}, { status: 500 }));
    await expect(api.fetchAlerts()).rejects.toThrow('Alerts HTTP 500');
    fetchMock.mockResolvedValueOnce(reply({}, { status: 404 }));
    await expect(api.fetchAlert('x')).rejects.toThrow('Alert HTTP 404');
    fetchMock.mockResolvedValueOnce(reply(null, { json: badJson }));
    expect(await api.fetchAlerts()).toBeNull();
    delete window.USER_PREFS_ENDPOINT;
    fetchMock.mockClear();
    await expect(api.fetchAlerts()).rejects.toThrow('Missing USER_PREFS_ENDPOINT');
    await expect(api.fetchAlert('x')).rejects.toThrow('Missing USER_PREFS_ENDPOINT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('board (BOARD_ENDPOINT)', () => {
  it('boardConfigured follows the window global', () => {
    expect(api.boardConfigured()).toBe(true);
    delete window.BOARD_ENDPOINT;
    expect(api.boardConfigured()).toBe(false);
  });

  it('sends a flat body with the action and the token, and resolves data', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ success: true, data: { boards: [1] } }));
    expect(await api.boardAction('list_boards', { limit: 3 })).toEqual({ boards: [1] });
    expect(lastCall().url).toBe('https://board.test/');
    expect(lastCall().body).toEqual({ limit: 3, action: 'list_boards' });
    expect(lastCall().init.headers.Authorization).toBe('Bearer tok');
  });

  it('list_presets with auth:false sends no token and does not ask for one', async () => {
    const getToken = vi.fn(() => Promise.resolve('tok'));
    api.setAuthProvider(getToken);
    await api.boardAction('list_presets', {}, { auth: false });
    expect(getToken).not.toHaveBeenCalled();
    expect(lastCall().init.headers.Authorization).toBeUndefined();
    expect(lastCall().body).toEqual({ action: 'list_presets' });
  });

  it('signed out with auth required rejects "Sign in required" without fetching', async () => {
    await expect(api.boardAction('list_boards')).rejects.toThrow('Sign in required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failure throws an Error carrying status, code and budget from the server', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ success: false, error: 'Over budget', code: 'budget', budget: { left: 0 } }, { status: 429 }));
    const err = await api.boardAction('run', {}).catch((e) => e);
    expect(err.message).toBe('Over budget');
    expect(err.status).toBe(429);
    expect(err.code).toBe('budget');
    expect(err.budget).toEqual({ left: 0 });
  });

  it('a 200 with success:false, or an unparseable body, is still a failure', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ success: false, error: 'denied' }));
    await expect(api.boardAction('x')).rejects.toThrow('denied');
    fetchMock.mockResolvedValueOnce(reply(null, { status: 500, json: badJson }));
    const err = await api.boardAction('x').catch((e) => e);
    expect(err.message).toBe('Board HTTP 500');
    expect(err.status).toBe(500);
  });

  it('missing endpoint rejects without fetching', async () => {
    delete window.BOARD_ENDPOINT;
    await expect(api.boardAction('x')).rejects.toThrow('Missing BOARD_ENDPOINT');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('billing (POLAR_BILLING_ENDPOINT)', () => {
  it('billingConfigured follows the window global', () => {
    expect(api.billingConfigured()).toBe(true);
    delete window.POLAR_BILLING_ENDPOINT;
    expect(api.billingConfigured()).toBe(false);
  });

  it('createCheckout and fetchMembership send the action (plus plan) with the token', async () => {
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ url: 'https://pay.test/c' }));
    expect(await api.createCheckout('annual')).toEqual({ url: 'https://pay.test/c' });
    expect(lastCall().url).toBe('https://billing.test/');
    expect(lastCall().body).toEqual({ action: 'create_checkout', plan: 'annual' });
    expect(lastCall().init.headers.Authorization).toBe('Bearer tok');

    await api.fetchMembership();
    expect(lastCall().body).toEqual({ action: 'get_membership' });
  });

  it('signed out rejects "Sign in required"; a server error surfaces its message, else the status', async () => {
    await expect(api.fetchMembership()).rejects.toThrow('Sign in required');
    expect(fetchMock).not.toHaveBeenCalled();
    api.setAuthProvider(() => Promise.resolve('tok'));
    fetchMock.mockResolvedValueOnce(reply({ error: 'No such plan' }, { status: 400 }));
    await expect(api.createCheckout('x')).rejects.toThrow('No such plan');
    fetchMock.mockResolvedValueOnce(reply(null, { status: 500, json: badJson }));
    await expect(api.fetchMembership()).rejects.toThrow('Polar HTTP 500');
  });
});
