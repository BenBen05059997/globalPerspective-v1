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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
