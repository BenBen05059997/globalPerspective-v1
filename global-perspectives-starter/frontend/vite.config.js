import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Absolute base so hashed bundles resolve at ANY route depth. Relative './'
  // broke nested deep-links (e.g. refreshing /weekly/thread/:id resolved
  // ./assets against /weekly/thread/ → 404 → blank). The github.io subpath
  // 301-redirects to the custom domain, so '/' is correct for the live site.
  base: '/',
  plugins: [react()],
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
    // e2e/ holds Playwright specs — they run under Playwright, not vitest.
    // Without this, vitest's default glob picks them up and they error on
    // Playwright-only globals.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
