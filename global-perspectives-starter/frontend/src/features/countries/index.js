// Public API of the countries feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/countries`, never a file inside it (eslint no-restricted-imports).
export { default as CountryCardV2 } from '@/features/countries/components/CountryCardV2.jsx';
