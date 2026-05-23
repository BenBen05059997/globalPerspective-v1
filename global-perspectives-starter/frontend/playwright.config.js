/* eslint-env node */
/**
 * Playwright config — Layer 8 (browser E2E) for the Economic Disruption stack.
 * See ECONOMIC_VERIFICATION_PLAN.md §10.
 *
 * Runs against the Vite preview server (built bundle, not dev) for parity with
 * production. Chromium-only by default to keep CI fast and binaries small.
 *
 * Usage:
 *   npx playwright install chromium    # once per clone
 *   npm run e2e
 *   npm run e2e:headed                 # see what's happening
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // economic data flows are state-dependent
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Build + preview in series so the bundle matches what /docs/ would ship.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
