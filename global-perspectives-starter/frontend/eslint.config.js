import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
      // Frontend restructure (FRONTEND_RESTRUCTURE_EXECUTION_PLAN.md P11): the old flat
      // dirs (components/, hooks/, utils/, services/, contexts/, onboarding/, data/,
      // assets/, styles/) no longer exist under src/ — ban their `@/` aliases repo-wide so
      // a stray import gives a clear lint error instead of a bare module-not-found.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
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
          ],
        },
      ],
    },
  },
  {
    // Dependency-direction rule (design §1/P11): app -> features -> shared, one-way.
    // shared/** must never import from features/** or app/**.
    files: ['src/shared/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/features', '@/features/**'],
              message: 'shared/ must not import from features/ (dependency-direction rule: app -> features -> shared).',
            },
            {
              group: ['@/app/*', '@/app', '@/app/**'],
              message: 'shared/ must not import from app/ (dependency-direction rule: app -> features -> shared).',
            },
          ],
        },
      ],
    },
  },
  {
    // features/** must not import from app/** (features are consumed by app, not the
    // other way around). feature -> feature imports are allowed — they're the
    // documented cross-feature edges in the design's §2.5.
    files: ['src/features/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/app', '@/app/**'],
              message: 'features/ must not import from app/ (dependency-direction rule: app -> features -> shared).',
            },
          ],
        },
      ],
    },
  },
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
  {
    files: ['playwright.config.js', 'e2e/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, process: 'readonly' },
    },
  },
])
