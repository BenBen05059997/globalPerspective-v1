// Public API of the track-record feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/track-record`, never a file inside it (eslint no-restricted-imports).
export { useTrackRecord } from '@/features/track-record/hooks/useTrackRecord';
export { useCorrectionsFeed } from '@/features/track-record/hooks/useCorrectionsFeed';
