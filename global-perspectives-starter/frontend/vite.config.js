import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Build stamp so the live site can show exactly which commit is deployed (handy for
// confirming a deploy actually landed in prod). Git SHA + date, resolved at build.
let gitSha = 'dev'
try { gitSha = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* not a git checkout */ }
const buildDate = new Date().toISOString().slice(0, 10)

// `npm run dev:fixture` (`vite --mode fixture`): the dev server answers /data/record/views/* from fixtures/record-views/ and
// /data/world/latest.json (the map bundle) from fixtures/world.json, so the story page, the Stories list, Today and the Map open with no
// network. Dev server only (`apply: 'serve'`, and only in fixture mode): the build never loads it. Every date in a file moves by the days
// from the fixture manifest's factsThrough to today (the pages' 30-day windows and analysis age stay in reach); the manifest's builtAt and
// the bundle's generated_at, next_expected_at and source times are now (the freshness checks pass). A file the fixture lacks is a 404,
// which the pages read as "not generated".
const FIXTURE_DIR = path.resolve(__dirname, 'fixtures/record-views')
const WORLD_FIXTURE = path.resolve(__dirname, 'fixtures/world.json')
const DAY_MS = 86400000
function shiftedFixture(file) {
  const through = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8')).factsThrough
  const shift = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(through)) / DAY_MS) * DAY_MS
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/\d{4}-\d{2}-\d{2}/g, (d) => new Date(Date.parse(d) + shift).toISOString().slice(0, 10)))
}
function sendJson(res, body) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
function recordViewsFixture() {
  return {
    name: 'record-views-fixture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/data/record/views', (req, res) => {
        const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(FIXTURE_DIR, rel)
        if (!/^[\w./-]+\.json$/.test(rel) || !file.startsWith(`${FIXTURE_DIR}${path.sep}`) || !fs.existsSync(file)) {
          res.statusCode = 404
          res.end()
          return
        }
        const body = shiftedFixture(file)
        if (rel === 'manifest.json') body.builtAt = new Date().toISOString()
        sendJson(res, body)
      })
      server.middlewares.use('/data/world/latest.json', (req, res) => {
        const body = shiftedFixture(WORLD_FIXTURE)
        const now = new Date()
        body.generated_at = now.toISOString()
        body.next_expected_at = new Date(now.getTime() + 30 * 60000).toISOString()
        body.sources = { ...body.sources, gdacs: now.toISOString(), news: now.toISOString() }
        sendJson(res, body)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(gitSha),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  // Absolute base so hashed bundles resolve at ANY route depth. Relative './'
  // broke nested deep-links (e.g. refreshing /weekly/thread/:id resolved
  // ./assets against /weekly/thread/ → 404 → blank). The github.io subpath
  // 301-redirects to the custom domain, so '/' is correct for the live site.
  base: '/',
  plugins: [react(), ...(mode === 'fixture' ? [recordViewsFixture()] : [])],
  // '@' -> src/, '@fixtures' -> tests/fixtures/ (used by test/redesign.test.jsx).
  // Vitest shares this `resolve` block since `test` is defined in the same
  // defineConfig call, so `vi.mock('@/…')` resolves without extra config.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@fixtures': path.resolve(__dirname, 'tests/fixtures'),
    },
  },
  build: {
    // 'hidden' emits .map files into dist/ (gitignored) WITHOUT appending a
    // //# sourceMappingURL comment to the bundle — so production never exposes
    // the maps, but `scripts/errors.mjs` can still resolve minified stacks
    // locally. The deploy step strips any .map from docs/ as a belt-and-braces.
    sourcemap: 'hidden',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // The jsdom page tests (map console, story page, Studio deck) run ~5 s each when the suite runs
    // in parallel on a busy machine; the 5 s default made them time out intermittently.
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/site-dist/**', 'worker/**'],
  },
}))
