// Public API of the briefings feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/briefings`, never a file inside it (eslint no-restricted-imports).
// /briefings addresses come from briefingHref in @/shared/lib/links.js, not from here.
export { useWeeklyBrief } from '@/features/briefings/hooks/useWeeklyBrief.js';
