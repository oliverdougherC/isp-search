import { loadWorkerEnv } from '@isp-search/config/server';
import { loadBundledRegistry } from '@isp-search/discovery';
import { createLogger } from '@isp-search/observability';

import { createDatabase } from './client.js';
import { checkDatabaseReadiness } from './health.js';
import { importRegistry } from './registry.js';
import { seedReferenceProviders } from './seed.js';

/**
 * Operator commands: `seed` and `status`. Migrations are applied through `drizzle-kit migrate`
 * (`pnpm db:migrate`) so that the applied SQL is exactly the reviewed SQL in `drizzle/`.
 */
async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? '';
  const env = loadWorkerEnv();
  const logger = createLogger({ name: 'db-cli', level: env.LOG_LEVEL });
  const handle = createDatabase({
    connectionString: env.DATABASE_URL,
    applicationName: 'isp-search-db-cli',
  });
  try {
    switch (command) {
      case 'seed': {
        const count = await seedReferenceProviders(handle);
        // Development default: the synthetic registry is active (deterministic tests/E2E);
        // the proposed launch matrix is imported inactive for directory review. Activating a
        // real market registry is a maintainer decision, not a seed side effect (ADR-001).
        const synthetic = await importRegistry(handle, loadBundledRegistry('synthetic-dev'), {
          activate: true,
        });
        const proposed = await importRegistry(handle, loadBundledRegistry('proposed'), {
          activate: false,
        });
        logger.info({ count, synthetic, proposed }, 'seeded reference providers and registries');
        return 0;
      }
      case 'status': {
        const readiness = await checkDatabaseReadiness(handle);
        logger.info(readiness, 'database readiness');
        return readiness.status === 'ready' ? 0 : 1;
      }
      default:
        logger.error({ command }, 'unknown command; expected `seed` or `status`');
        return 2;
    }
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
