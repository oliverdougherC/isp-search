import { loadWorkerEnv } from '@isp-search/config/server';
import { createLogger } from '@isp-search/observability';

import { createDatabase } from './client.js';
import { checkDatabaseReadiness } from './health.js';
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
        logger.info({ count }, 'seeded reference providers');
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
