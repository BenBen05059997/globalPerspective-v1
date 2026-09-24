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

const MAX_SENDS_PER_SESSION = 20;
const seen = new Set();
let sent = 0;
let installed = false;

function endpoint() {
  return typeof window !== 'undefined' ? window.CLIENT_ERRORS_ENDPOINT : null;
}

function report(kind, message, stack) {
  const url = endpoint();
  if (!url || !message) return;
  if (sent >= MAX_SENDS_PER_SESSION) return;

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

export function installErrorSink() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

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
