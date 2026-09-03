import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint configuration (ESLint 10 flat config, typed linting).
 *
 * Boundary rules (PLA-353). See docs/architecture.md → "Package boundaries".
 *  - packages/domain imports no other workspace package and no I/O driver.
 *  - packages/providers never imports the database package.
 *  - apps/web never imports the worker; web *client* code never imports server-only packages.
 *  - playwright is importable only under apps/worker.
 * The tests in tooling/boundaries prove each rule reports an error.
 */

const SERVER_ONLY_IMPORTS = [
  { name: '@isp-search/db', message: 'Server-only. Client code must call an API route instead.' },
  { name: '@isp-search/db/queue', message: 'Server-only.' },
  { name: '@isp-search/db/schema', message: 'Server-only.' },
  {
    name: '@isp-search/config/server',
    message: 'Server-only configuration cannot reach the browser.',
  },
  { name: '@isp-search/domain/address-identity', message: 'HMAC identity is server-only.' },
  { name: 'pg', message: 'Database drivers are server-only.' },
  { name: 'pg-boss', message: 'Queue client is server-only.' },
  { name: 'pino', message: 'Use the shared logger through server code only.' },
];

const PLAYWRIGHT_PATTERNS = [
  {
    group: ['playwright', 'playwright-core', 'playwright/*', '@playwright/*'],
    message: 'Playwright is confined to apps/worker (ADR-004).',
  },
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
    'packages/db/drizzle/**',
    '**/next-env.d.ts',
    'packages/providers/scripts/**',
    'scripts/**',
  ]),
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // Typed linting over the *test* projects so tests and config files are covered too.
        project: [
          './packages/*/tsconfig.test.json',
          './apps/worker/tsconfig.test.json',
          './apps/web/tsconfig.json',
          './tooling/tsconfig.test.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    plugins: { 'import-x': importX },
    rules: {
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message: 'Casting to any is forbidden; narrow with a schema or a type guard.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: false, allowBoolean: false, allowNullish: false },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Playwright is forbidden everywhere; the worker override below re-allows it.
      'no-restricted-imports': ['error', { patterns: PLAYWRIGHT_PATTERNS }],
    },
  },
  {
    // Tests may use vitest globals-free imports; relax a few strictness rules for readability.
    files: ['**/*.test.ts', '**/*.test.tsx', 'tooling/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['apps/worker/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...SERVER_ONLY_IMPORTS, { name: 'drizzle-orm', message: 'domain is pure.' }],
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: ['@isp-search/*'],
              message: 'packages/domain must not depend on other workspace packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/providers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SERVER_ONLY_IMPORTS.filter(
            (p) => p.name.startsWith('@isp-search/db') || p.name === 'pg' || p.name === 'pg-boss',
          ),
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: ['@isp-search/db', '@isp-search/db/*', '@isp-search/worker*'],
              message: 'Adapters are I/O-free; persistence is orchestrated elsewhere.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/discovery/**/*.ts', 'packages/resolver/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SERVER_ONLY_IMPORTS.filter(
            (p) => p.name.startsWith('@isp-search/db') || p.name === 'pg' || p.name === 'pg-boss',
          ),
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: [
                '@isp-search/db',
                '@isp-search/db/*',
                '@isp-search/worker*',
                '@isp-search/providers*',
              ],
              message: 'Discovery and resolver packages are pure; persistence lives in db.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ui/**/*.ts', 'packages/ui/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SERVER_ONLY_IMPORTS,
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: ['@isp-search/db*', '@isp-search/providers*', '@isp-search/worker*'],
              message: 'UI is browser-safe.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: ['@isp-search/worker', '@isp-search/worker/*'],
              message: 'The web app never imports the worker.',
            },
          ],
        },
      ],
    },
  },
  {
    // Client-side web code: anything under a `_client` directory or ending in `.client.ts(x)`.
    files: ['apps/web/**/_client/**/*.{ts,tsx}', 'apps/web/**/*.client.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: SERVER_ONLY_IMPORTS,
          patterns: [
            ...PLAYWRIGHT_PATTERNS,
            {
              group: ['@isp-search/worker*', '@isp-search/db*', '**/lib/server/**'],
              message: 'Server-only code cannot be imported by client components.',
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
