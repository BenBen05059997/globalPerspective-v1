// errorSink — fire-and-forget passive client-error reporter.
//
// Listens for uncaught errors + unhandled promise rejections and POSTs a small
// JSON blob to the newsClientErrors Lambda (window.CLIENT_ERRORS_ENDPOINT).
// No-ops silently when the endpoint is unset, so it's safe to ship before the
// backend exists. Read errors back with `node scripts/errors.mjs`.
//
// Self-protections (a reporter must never make things worse):
//   - in-session dedup so one repeating error doesn't spam the network
//   - a hard per-session send cap
//   - never reports its own failures (no recursion)
//
// Noise rule (one place, applies to every page): an automated fleet loads the site every 3 hours and
// leaves again, and its requests time out or are cancelled. That is not a reader failure, so:
//   - a browser under automation (navigator.webdriver) reports nothing;
//   - a network failure ("Request timed out", "Failed to fetch", Safari "Load failed", Firefox
//     "NetworkError") is reported only if the page is still open and visible when it lands: not in a
//     hidden tab, not after pagehide/beforeunload (the browser cancels in-flight fetches then), not
//     while the browser is offline. Real script errors and render crashes are NOT subject to the
//     visibility checks: they are ours to fix wherever they happen.

const MAX_SENDS_PER_SESSION = 20;
const seen = new Set();
let sent = 0;
let installed = false;
let leaving = false; // pagehide/beforeunload fired: in-flight fetches are cancelled, not broken

const NETWORK_FAILURE = /Request timed out after|Failed to fetch|Load failed|NetworkError/i;

// True when this failure is not a reader-visible problem. Exported for tests.
export function isNoise(message) {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  if (!NETWORK_FAILURE.test(String(message))) return false;
  if (leaving) return true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return false;
}

function endpoint() {
  return typeof window !== 'undefined' ? window.CLIENT_ERRORS_ENDPOINT : null;
}

function report(kind, message, stack) {
  const url = endpoint();
  if (!url || !message) return;
  if (sent >= MAX_SENDS_PER_SESSION) return;
  if (isNoise(message)) return;

  const key = `${kind}:${message}:${(stack || '').split('\n')[1] || ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;

  const payload = JSON.stringify({
    kind,
    message: String(message).slice(0, 2000),
    stack: String(stack || '').slice(0, 8000),
    url: window.location?.href || '',
    userAgent: navigator?.userAgent || '',
    timestamp: new Date().toISOString(),
  });

  try {
    // keepalive lets the POST survive a page unload (e.g. a navigation that
    // followed the error). Swallow all failures — a reporter must stay silent.
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  } catch {
    /* never throw from the reporter */
  }
}

// Called by the React ErrorBoundary's componentDidCatch. A working boundary
// CATCHES the throw, so it never reaches the window 'error' listener above —
// without this the crash would be invisible to the sink. componentStack is
// folded into the stack field so the backend Lambda needs no change.
export function reportBoundaryError(error, componentStack) {
  const stack =
    (error?.stack || String(error || '')) +
    (componentStack ? '\n--- React component stack ---' + componentStack : '');
  report('react', error?.message || String(error), stack);
}

// Called by any feature that catches its own fetch failure and wants it reported without
// re-throwing (e.g. a card that renders an honest fallback instead of crashing). `context` is a
// short label ("story-card-summary") so the backend log can tell sources apart.
export function reportFetchError(context, error) {
  report('fetch', `${context}: ${error?.message || String(error)}`, error?.stack);
}

export function installErrorSink() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('pagehide', () => { leaving = true; });
  window.addEventListener('beforeunload', () => { leaving = true; });
  window.addEventListener('pageshow', (e) => { if (e.persisted) leaving = false; }); // back/forward cache restore

  window.addEventListener('error', (e) => {
    // Resource-load errors (img/script 404) have no `error` object and a
    // useless message — skip them; they're not JS exceptions.
    if (!e.error && !e.message) return;
    report('error', e.message || e.error?.message, e.error?.stack);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const message = reason?.message || String(reason);
    report('unhandledrejection', message, reason?.stack);
  });
}
