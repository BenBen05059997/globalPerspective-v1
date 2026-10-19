// Public API of the map feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/map`, never a file inside it (eslint no-restricted-imports).
export { default as HudStatusLine } from '@/features/map/components/HudStatusLine';
export { useGdacsStatus } from '@/features/map/hooks/useGdacsStatus';
export { usePausedSince } from '@/features/map/hooks/usePausedSince';
export { WAITING_SENSORS } from '@/features/map/lib/bootSensors.js';
