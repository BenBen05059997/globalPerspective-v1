// alertPath — a breaking alert's resolver address, the same one emails carry: /breaking/:id goes to the
// alert's story when the single-alert read says it has one, else to the map (app/LegacyRedirects.jsx).
// Feed rows carry only the alert key (their `threadId` is a legacy alias of it, and the key falls back
// to a topic id for an un-threaded alert), so a row cannot link the story itself.
export function alertPath(alert) {
  return `/breaking/${encodeURIComponent(alert.id || alert.threadId)}`;
}
