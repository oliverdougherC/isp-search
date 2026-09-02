import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const created: string[] = [];

/**
 * Writes a probe file at a real path (so typed linting can find it in the package's tsconfig),
 * lints it with the repository configuration, and returns the error rule ids. Probe files are
 * always removed afterwards and are git-ignored by name.
 */
async function lintProbe(relativePath: string, code: string): Promise<string[]> {
  const file = resolve(REPO_ROOT, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
  created.push(file);
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: resolve(REPO_ROOT, 'eslint.config.mjs'),
  });
  const [result] = await eslint.lintFiles([file]);
  const messages = result?.messages ?? [];
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length > 0) {
    throw new Error(`lint probe failed to parse: ${fatal.map((m) => m.message).join('; ')}`);
  }
  return messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'unknown');
}

afterEach(() => {
  for (const file of created.splice(0)) {
    rmSync(file, { force: true });
  }
});

/**
 * These tests prove the boundary rules bite. Each case is a prohibited import written into a
 * probe file at a path where the rule applies; ESLint must report `no-restricted-imports`.
 */
describe('import boundaries', () => {
  it('web client code cannot import database, worker, or server config internals', async () => {
    const rules = await lintProbe(
      'apps/web/app/_client/widget.boundary-probe.client.tsx',
      [
        "import { createDatabase } from '@isp-search/db';",
        "import { loadWebServerEnv } from '@isp-search/config/server';",
        "import { JobQueue } from '@isp-search/db/queue';",
        'export const x = [createDatabase, loadWebServerEnv, JobQueue];',
      ].join('\n'),
    );
    expect(rules).toContain('no-restricted-imports');
  });

  it('playwright can only be imported from the worker', async () => {
    const rules = await lintProbe(
      'packages/providers/src/leak.boundary-probe.ts',
      "import { chromium } from 'playwright';\nexport const c = chromium;",
    );
    expect(rules).toContain('no-restricted-imports');
    const workerRules = await lintProbe(
      'apps/worker/src/browser/ok.boundary-probe.ts',
      "import type { LaunchOptions } from 'playwright';\nexport type L = LaunchOptions;",
    );
    expect(workerRules).not.toContain('no-restricted-imports');
  });

  it('domain stays pure: no imports from other workspace packages or database drivers', async () => {
    const rules = await lintProbe(
      'packages/domain/src/leak.boundary-probe.ts',
      "import { createDatabase } from '@isp-search/db';\nimport pg from 'pg';\nexport const x = [createDatabase, pg];",
    );
    expect(rules).toContain('no-restricted-imports');
  });

  it('providers cannot import the database package (adapters stay I/O-free)', async () => {
    const rules = await lintProbe(
      'packages/providers/src/leak2.boundary-probe.ts',
      "import { createDatabase } from '@isp-search/db';\nexport const x = createDatabase;",
    );
    expect(rules).toContain('no-restricted-imports');
  });

  it('web cannot import the worker package', async () => {
    const rules = await lintProbe(
      'apps/web/lib/server/leak.boundary-probe.ts',
      "import { isolatedBrowserPolicy } from '@isp-search/worker/src/browser/runtime';\nexport const x = isolatedBrowserPolicy;",
    );
    expect(rules).toContain('no-restricted-imports');
  });
});
