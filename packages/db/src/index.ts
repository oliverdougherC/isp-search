import { assertServerRuntime } from '@isp-search/config/server';

assertServerRuntime('@isp-search/db');

export {
  createDatabase,
  type CreateDatabaseOptions,
  type Database,
  type DatabaseHandle,
} from './client.js';
export {
  checkDatabaseHealth,
  checkDatabaseReadiness,
  type HealthCheckResult,
  type ReadinessResult,
} from './health.js';
export {
  migrationsFolder,
  readMigrationJournal,
  runMigrations,
  type MigrationJournal,
} from './migrations.js';
export { REFERENCE_PROVIDER_SEED, seedReferenceProviders } from './seed.js';
export * as schema from './schema/index.js';
