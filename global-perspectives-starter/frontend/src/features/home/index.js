// Public API of the home feature: only what other features (and app/) import. Route pages are
// not exported here — app/App.jsx lazy-loads them by path so each page stays its own chunk.
// Other features import `@/features/home`, never a file inside it (eslint no-restricted-imports).
// Home (/today) is the one page app/App.jsx imports eagerly (the rest are lazy by path).
export { default as Home } from '@/features/home/Home';
