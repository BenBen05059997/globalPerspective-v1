import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import { readdirSync } from 'node:fs'

// ── Import rules ──────────────────────────────────────────────────────────────────────────
// In flat config a later block's `no-restricted-imports` REPLACES the earlier options for the
// files it matches, so every block below repeats the P11 patterns instead of inheriting them.
//
// P11 (FRONTEND_RESTRUCTURE_EXECUTION_PLAN.md): the old flat dirs (components/, hooks/, utils/, …)
// no longer exist under src/ — a stray `@/components|@/hooks|@/utils` import gets a clear message.
const P11 = [
  {
    group: ['@/components/*', '@/components'],
    message:
      'src/components/ no longer exists (P11 restructure) — the file moved into a features/*/ or shared/ directory. Update the import path.',
  },
  {
    group: ['@/hooks/*', '@/hooks'],
    message:
      'src/hooks/ no longer exists (P11 restructure) — the hook moved into a features/*/hooks/ or shared/hooks/ directory. Update the import path.',
  },
  {
    group: ['@/utils/*', '@/utils'],
    message:
      'src/utils/ no longer exists (P11 restructure) — the util moved into a features/*/lib/ or shared/lib/ directory. Update the import path.',
  },
]
// Dependency direction (decision 0006): app -> features -> shared, one-way.
const NO_APP = (who) => ({
  group: ['@/app/*', '@/app', '@/app/**'],
  message: `${who}/ must not import from app/ (dependency-direction rule: app -> features -> shared).`,
})
// Feature public APIs (decision 0024): another feature (or app/) imports `@/features/x` — the
// feature's index.js — never a file inside it. Static imports only, so the lazy
// `import('@/features/x/Page')` route pages in app/App.jsx keep their own chunks. Tests may
// deep-import (vi.mock needs real module paths). quality/check_feature_cycles.mjs keeps the
// feature graph acyclic.
const deepImport = (except) => ({
  group: ['@/features/*/**', ...(except ? [`!@/features/${except}/**`] : [])],
  message: 'Import another feature through its public API (`@/features/<name>`, its index.js), not a file inside it.',
})
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns: [...P11, ...patterns] }] })
const TESTS = ['**/__tests__/**', '**/*.test.{js,jsx}']
const FEATURES = readdirSync(new URL('./src/features', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

export default defineConfig([
  globalIgnores(['dist', 'site-dist', '.wrangler']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      // __APP_VERSION__ / __BUILD_DATE__ are injected at build time by Vite's
      // `define` (vite.config.js) — declare them so no-undef doesn't flag them.
      globals: { ...globals.browser, __APP_VERSION__: 'readonly', __BUILD_DATE__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'no-useless-escape': 'warn',
      'react-refresh/only-export-components': 'off',
      ...restrict(),
    },
  },
  {
    files: ['src/shared/**/*.{js,jsx}'],
    rules: restrict(
      {
        group: ['@/features/*', '@/features', '@/features/**'],
        message: 'shared/ must not import from features/ (dependency-direction rule: app -> features -> shared).',
      },
      NO_APP('shared'),
    ),
  },
  {
    files: ['src/app/**/*.{js,jsx}'],
    ignores: TESTS,
    rules: restrict(deepImport()),
  },
  // features/** tests: only the direction rule (they may deep-import other features).
  {
    files: ['src/features/**/*.{js,jsx}'],
    rules: restrict(NO_APP('features')),
  },
  // One block per feature, generated: its own files may import anything inside itself, other
  // features only through their index.js.
  ...FEATURES.map((f) => ({
    files: [`src/features/${f}/**/*.{js,jsx}`],
    ignores: TESTS,
    rules: restrict(NO_APP('features'), deepImport(f)),
  })),
  {
    files: ['**/*.test.{js,jsx}', '**/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
])
