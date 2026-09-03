import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

/**
 * Probe files are written at real paths so typed linting can find them in each package's
 * tsconfig. All probes are created BEFORE the first lint call: typescript-eslint builds one
 * program per tsconfig on first use and may not pick up files created afterwards. Probes are
 * removed afterwards and are git-ignored by name (`*.boundary-probe.*`).
 */
const PROBES = {
  webClient: {
    path: 'apps/web/app/_client/widget.boundary-probe.client.tsx',
    code: [
      "import { createDatabase } from '@isp-search/db';",
      "import { loadWebServerEnv } from '@isp-search/config/server';",
      "import { JobQueue } from '@isp-search/db/queue';",
      'export const x = [createDatabase, loadWebServerEnv, JobQueue];',
    ].join('\n'),
  },
  providersPlaywright: {
    path: 'packages/providers/src/leak.boundary-probe.ts',
    code: "import { chromium } from 'playwright';\nexport const c = chromium;",
  },
  workerPlaywright: {
    path: 'apps/worker/src/browser/ok.boundary-probe.ts',
    code: "import type { LaunchOptions } from 'playwright';\nexport type L = LaunchOptions;",
  },
  domainImpure: {
    path: 'packages/domain/src/leak.boundary-probe.ts',
    code: "import { createDatabase } from '@isp-search/db';\nimport pg from 'pg';\nexport const x = [createDatabase, pg];",
  },
  providersDb: {
    path: 'packages/providers/src/leak2.boundary-probe.ts',
    code: "import { createDatabase } from '@isp-search/db';\nexport const x = createDatabase;",
  },
  webWorker: {
    path: 'apps/web/lib/server/leak.boundary-probe.ts',
    code: "import { isolatedBrowserPolicy } from '@isp-search/worker/src/browser/runtime';\nexport const x = isolatedBrowserPolicy;",
  },
} as const;

type ProbeName = keyof typeof PROBES;

let eslint: ESLint;

beforeAll(() => {
  for (const probe of Object.values(PROBES)) {
    const file = resolve(REPO_ROOT, probe.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, probe.code);
  }
  eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: resolve(REPO_ROOT, 'eslint.config.mjs'),
  });
});

afterAll(() => {
  for (const probe of Object.values(PROBES)) {
    rmSync(resolve(REPO_ROOT, probe.path), { force: true });
  }
});

async function errorRules(name: ProbeName): Promise<string[]> {
  const [result] = await eslint.lintFiles([resolve(REPO_ROOT, PROBES[name].path)]);
  const messages = result?.messages ?? [];
  const fatal = messages.filter((m) => m.fatal);
  if (fatal.length > 0) {
    throw new Error(
      `lint probe ${name} failed to parse: ${fatal.map((m) => m.message).join('; ')}`,
    );
  }
  return messages.filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'unknown');
}

/** These tests prove the boundary rules bite: each prohibited import must report an error. */
describe('import boundaries', () => {
  it('web client code cannot import database, worker, or server config internals', async () => {
    expect(await errorRules('webClient')).toContain('no-restricted-imports');
  });

  it('playwright can only be imported from the worker', async () => {
    expect(await errorRules('providersPlaywright')).toContain('no-restricted-imports');
    expect(await errorRules('workerPlaywright')).not.toContain('no-restricted-imports');
  });

  it('domain stays pure: no imports from other workspace packages or database drivers', async () => {
    expect(await errorRules('domainImpure')).toContain('no-restricted-imports');
  });

  it('providers cannot import the database package (adapters stay I/O-free)', async () => {
    expect(await errorRules('providersDb')).toContain('no-restricted-imports');
  });

  it('web cannot import the worker package', async () => {
    expect(await errorRules('webWorker')).toContain('no-restricted-imports');
  });
});
