// Public API of the breaking feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/breaking`, never a file inside it (eslint no-restricted-imports).
export { default as BreakingStrip } from '@/features/breaking/components/BreakingStrip';
export { default as NotificationBell } from '@/features/breaking/components/NotificationBell';
export { useBreakingAlert } from '@/features/breaking/hooks/useBreakingAlert';
