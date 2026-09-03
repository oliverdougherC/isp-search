import { assertServerRuntime } from '@isp-search/config/server';

assertServerRuntime('@isp-search/db');

export {
  createDatabase,
  withTransaction,
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
export {
  sealAddressMaterial,
  openAddressMaterial,
  AddressMaterial,
  AddressMaterialError,
  type RawAddressKey,
} from './address-material.js';
export {
  createSearchSession,
  getSearch,
  isSearchExpired,
  newSearchId,
  sessionPolicyFromEnv,
  type CreateSearchSessionInput,
  type CreatedSearchSession,
  type SessionPolicy,
} from './sessions.js';
export {
  deleteRawAddress,
  deleteRawAddressIfAllSettled,
  newSweepRunId,
  sweepRetention,
  type RetentionTrigger,
  type SweepSummary,
} from './retention.js';
export {
  importRegistry,
  loadActiveRegistry,
  resolveProviderAlias,
  NoActiveRegistryError,
  RegistryImportError,
  type ImportRegistryOptions,
} from './registry.js';
export {
  applyAddressAction,
  SearchActionError,
  type AddressActionDeps,
  type AddressActionInput,
  type AddressActionResult,
  type SearchActionFailure,
} from './address-actions.js';
export {
  claimQualificationJob,
  enforceSearchDeadlines,
  ProviderActionError,
  recomputeSearchState,
  settleQualificationJob,
  startQualification,
  submitProviderAction,
  type AdapterRunResult,
  type JobClaim,
  type OrchestrationDeps,
  type ProviderActionFailure,
  type SettleDecision,
  type StartQualificationResult,
} from './orchestration.js';
export * as schema from './schema/index.js';
