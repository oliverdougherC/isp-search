import { z } from 'zod';

/**
 * Environment schemas, split by runtime so that each process validates exactly what it needs
 * and nothing more. Values are described in `.env.example`.
 *
 * Naming rule: anything readable by the browser MUST be prefixed `NEXT_PUBLIC_`; anything
 * else is server-only. Secrets never carry the public prefix.
 */

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const port = z.coerce.number().int().min(1).max(65535);

const logLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

export const NodeEnv = z.enum(['development', 'test', 'production']);
export type NodeEnv = z.infer<typeof NodeEnv>;

/** Values that are safe to embed in client bundles. */
export const PublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).max(60).default('ISP Search'),
});
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/** Shared server-side values required by every long-running process. */
const SharedServerSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  LOG_LEVEL: logLevel.default('info'),
  DATABASE_URL: z
    .url()
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
    }),
  /**
   * Key material for the versioned HMAC address identity (ADR-007). At least 32 characters.
   * Generate with `openssl rand -hex 32` or `pnpm env:init`.
   */
  ADDRESS_HMAC_SECRET: z.string().min(32, 'ADDRESS_HMAC_SECRET must be at least 32 characters'),
  ADDRESS_HMAC_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  /** Debug payload capture is off by default and can never exceed a 24 hour TTL. */
  DEBUG_CAPTURE_ENABLED: booleanFromString.default(false),
  DEBUG_CAPTURE_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(1),
  /**
   * AES-256-GCM key for the short-lived encrypted raw-address material (ADR-007, PLA-362).
   * Exactly 64 hex characters (32 bytes). Generate with `openssl rand -hex 32` or `pnpm env:init`.
   */
  RAW_ADDRESS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'RAW_ADDRESS_ENCRYPTION_KEY must be 64 lowercase hex characters'),
  RAW_ADDRESS_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  /** Raw-address retention ceiling; ADR-007 hard maximum is 24 h (1440 minutes). */
  RAW_ADDRESS_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  /** Whole-search retention (record served, display data kept); ceiling 24 h. */
  SEARCH_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
  /** Global orchestration deadline per search (SLO hypothesis: 30–45 s). */
  SEARCH_DEADLINE_SECONDS: z.coerce.number().int().min(5).max(300).default(40),
  /** Version of the consent copy shown before an address is submitted. */
  CONSENT_VERSION: z.string().min(1).max(64).default('dev-2026-09'),
  /**
   * Which AddressResolver runs (ADR-002). `synthetic` is the deterministic development
   * default; `smarty` stays gated until PLA-349 provides a consented corpus and the
   * maintainer provisions credentials/terms.
   */
  ADDRESS_RESOLVER: z.enum(['synthetic', 'smarty']).default('synthetic'),
  /**
   * Comma-separated provider ids allowed to run adapters; `*` = every registered adapter.
   * Removing an id downgrades that provider to link-only (provider-disable runbook).
   */
  ENABLED_PROVIDER_IDS: z.string().default('*'),
  SMARTY_ENABLED: booleanFromString.default(false),
  SMARTY_AUTH_ID: z.string().min(1).optional(),
  SMARTY_AUTH_TOKEN: z.string().min(1).optional(),
});

export const WebServerEnvSchema = SharedServerSchema.extend({
  PORT: port.default(3000),
  APP_BASE_URL: z.url().default('http://localhost:3000'),
  JOB_QUEUE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/, 'JOB_QUEUE_SCHEMA must be a lowercase postgres identifier')
    .default('pgboss'),
  /** Optional bearer token for the internal deletion/expiry operation (PLA-368). */
  INTERNAL_ADMIN_TOKEN: z.string().min(16).optional(),
  /** POST /api/searches per-IP budget (per minute). */
  SEARCH_CREATE_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
  /** GET /api/searches/:id per-IP budget (per minute). */
  SEARCH_READ_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(10000).default(240),
});
export type WebServerEnv = z.infer<typeof WebServerEnvSchema>;

export const WorkerEnvSchema = SharedServerSchema.extend({
  WORKER_HEALTH_PORT: port.default(3100),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  /** Per-provider concurrency ceiling inside one worker (PLA-367). */
  PROVIDER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  JOB_QUEUE_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/, 'JOB_QUEUE_SCHEMA must be a lowercase postgres identifier')
    .default('pgboss'),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().min(0).max(120_000).default(15_000),
});
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

export const TestEnvSchema = z.object({
  DATABASE_URL_TEST: SharedServerSchema.shape.DATABASE_URL.optional(),
  JOB_QUEUE_SCHEMA: WorkerEnvSchema.shape.JOB_QUEUE_SCHEMA,
  /** Deterministic suites run with network disabled unless this is explicitly `true`. */
  ISP_SEARCH_TEST_NETWORK: booleanFromString.default(false),
});
export type TestEnv = z.infer<typeof TestEnvSchema>;

/** Names of every variable that must never appear in client bundles or logs in plaintext. */
export const SECRET_ENV_NAMES: readonly string[] = [
  'DATABASE_URL',
  'ADDRESS_HMAC_SECRET',
  'RAW_ADDRESS_ENCRYPTION_KEY',
  'SMARTY_AUTH_TOKEN',
  'INTERNAL_ADMIN_TOKEN',
];
