// check_links — ratchet on hand-built page addresses (engine: quality/ratchet.mjs).
//
// Every reader destination has one canonical address built in shared/lib/links.js (frontend) or
// backend/shared/src/links.js (emails) — PLAN_2026-10-19_linking_and_pages.md. A route string typed
// anywhere else is a copy that drifts, so per file and per route the count may only go DOWN (target 0).
// Counted in frontend src and backend/ (.js/.jsx/.mjs; code comments ignored): each occurrence of a route
// prefix below that is not part of a longer path segment ('/weekly/countries' is not '/weekly/country').
// Excluded: the two links.js modules, the route table (app/App.jsx) and the client redirects
// (app/LegacyRedirects.jsx), and tests.
//   node quality/check_links.mjs [--report | --lower | --write]
import { run, isMain } from './ratchet.mjs';

export const ROUTES = [
  '/weekly/thread', '/weekly/country', '/track-record', '/daily', '/weekly-brief', '/briefings', '/analyze', '/today',
  '/?focus', '/?story', '/?country',
];

const ALLOWED = new Set(['shared/lib/links.js', 'app/App.jsx', 'app/LegacyRedirects.jsx', 'backend/shared/src/links.js']);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Not preceded by a path/host character (so 'api/daily' or 'example.com/today' are not routes) unless the
// host is the site's own ('globalperspective.net/daily/…' in copied text is a hand-built address), and not
// continued by one ('/todays', '/daily-x', '/weekly/countries').
const PATTERNS = ROUTES.map((r) => [r, new RegExp(`(?:(?<![\\w.\\-/])|(?<=globalperspective\\.net))${escape(r)}(?![\\w-])`, 'g')]);

// Drop JS comments: JSX {/* … */}, whole-line // and * / block lines, and trailing ` // …` (a URL's '://'
// is never preceded by whitespace, so it survives).
export function stripJsComments(text) {
  return text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => (m.includes('\n') || /^\/\*\*?\s/.test(m) ? '' : m))
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .map((line) => line.replace(/\s\/\/\s.*$/, ''))
    .join('\n');
}

export function countRoutes(text, file = '') {
  if (file.endsWith('.css')) return {};
  const code = stripJsComments(text);
  return Object.fromEntries(PATTERNS.map(([r, re]) => [r, (code.match(re) || []).length]));
}

export const skipAllowed = (rel) => ALLOWED.has(rel) || /(^|\/)(test|tests|__tests__)\//.test(rel) || /(^|\/)test-[^/]*$/.test(rel);

if (isMain(import.meta.url)) {
  process.exitCode = run({
    name: 'links',
    title: 'hand-built page addresses',
    count: countRoutes,
    skip: skipAllowed,
    dirs: ['backend'],
    note: 'Per-file count of hand-built route strings outside shared/lib/links.js and backend/shared/src/links.js (see quality/check_links.mjs). Counts may only fall; lower them with --lower after switching a caller to links.js.',
    advice: 'build the address with storyHref / countryHref / mapHref / briefingHref / forecastHref / studioHref / todayHref (or <EntityLink>) from shared/lib/links.js; emails use backend/shared/src/links.js',
  });
}
