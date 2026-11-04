// Runs run(signal) under a deadline. The signal aborts when the deadline passes or when the caller's
// own signal aborts (whichever is first), so a hung request rejects instead of waiting forever and
// whatever slot it holds is freed. The timer covers the whole run (headers and body read).
export function withTimeout(ms, run, externalSignal) {
  const ctrl = new AbortController();
  let timedOut = false;
  let timer;
  const onExternal = () => ctrl.abort();
  return new Promise((resolve, reject) => {
    // Reject on abort ourselves too, so a fetch that ignores the signal still lets go.
    ctrl.signal.addEventListener('abort', () => {
      reject(timedOut ? new Error(`Request timed out after ${ms / 1000}s`) : new DOMException('Aborted', 'AbortError'));
    }, { once: true });
    if (externalSignal) {
      if (externalSignal.aborted) onExternal();
      else externalSignal.addEventListener('abort', onExternal, { once: true });
    }
    if (ctrl.signal.aborted) return;
    timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms);
    Promise.resolve().then(() => run(ctrl.signal)).then(resolve, reject);
  }).finally(() => {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternal);
  });
}
