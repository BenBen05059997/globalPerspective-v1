// errorSink noise rule: automation, hidden tabs and leaving pages do not report network failures.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let sink;
const sent = () => globalThis.fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
const define = (obj, key, value) => Object.defineProperty(obj, key, { value, configurable: true });
const timeout = () => new Error('Request timed out after 15s');

beforeEach(async () => {
  vi.resetModules();
  globalThis.fetch = vi.fn(() => Promise.resolve({}));
  window.CLIENT_ERRORS_ENDPOINT = 'https://errors.test/in';
  define(document, 'visibilityState', 'visible');
  define(navigator, 'webdriver', false);
  define(navigator, 'onLine', true);
  sink = await import('../errorSink.js');
  sink.installErrorSink();
});
afterEach(() => { delete window.CLIENT_ERRORS_ENDPOINT; });

describe('errorSink noise rule', () => {
  it('a visible page reports a timeout and a Failed to fetch', () => {
    sink.reportFetchError('briefs-index', timeout());
    sink.reportFetchError('map-world', new TypeError('Failed to fetch'));
    expect(sent().map((p) => p.message)).toEqual([
      'briefs-index: Request timed out after 15s',
      'map-world: Failed to fetch',
    ]);
  });

  it('an automated browser (navigator.webdriver) reports nothing, not even script errors', () => {
    define(navigator, 'webdriver', true);
    sink.reportFetchError('record-manifest', timeout());
    sink.reportBoundaryError(new Error('render crash'), '');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a hidden tab does not report a network failure', () => {
    define(document, 'visibilityState', 'hidden');
    sink.reportFetchError('boot-sensor-news', timeout());
    sink.reportFetchError('map-world', new TypeError('Failed to fetch'));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a hidden tab still reports a real script error', () => {
    define(document, 'visibilityState', 'hidden');
    sink.reportBoundaryError(new Error('render crash'), '');
    expect(sent()).toHaveLength(1);
  });

  it('after pagehide a network failure is dropped; a bfcache restore re-enables it', () => {
    window.dispatchEvent(new Event('pagehide'));
    sink.reportFetchError('map-world', new TypeError('Failed to fetch'));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    const restore = new Event('pageshow');
    define(restore, 'persisted', true);
    window.dispatchEvent(restore);
    sink.reportFetchError('map-world', new TypeError('Failed to fetch'));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('beforeunload alone does not suppress a report (a cancelled leave prompt must not silence the page)', () => {
    window.dispatchEvent(new Event('beforeunload'));
    sink.reportFetchError('briefs-index', timeout());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('offline: a network failure is dropped', () => {
    define(navigator, 'onLine', false);
    sink.reportFetchError('briefs-index', timeout());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a non-network fetch failure (HTTP 503) on a visible page is reported', () => {
    sink.reportFetchError('today-prediction', new Error('HTTP 503'));
    expect(sent()).toHaveLength(1);
  });

  it('an unhandled rejection with Failed to fetch while hidden is dropped', () => {
    define(document, 'visibilityState', 'hidden');
    const ev = new Event('unhandledrejection');
    ev.reason = new TypeError('Failed to fetch');
    window.dispatchEvent(ev);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
