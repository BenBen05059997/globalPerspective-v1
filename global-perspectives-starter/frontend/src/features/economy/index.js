// Public API of the economy feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/economy`, never a file inside it (eslint no-restricted-imports).
export { default as InstrumentChip } from '@/features/economy/components/InstrumentChip';
export { default as MechanismCard } from '@/features/economy/components/MechanismCard';
export { useEconomicImpact } from '@/features/economy/hooks/useEconomicImpact';
