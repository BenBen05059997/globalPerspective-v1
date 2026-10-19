// Public API of the weekly-brief feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/weekly-brief`, never a file inside it (eslint no-restricted-imports).
export { useWeeklyBrief } from '@/features/weekly-brief/hooks/useWeeklyBrief';
