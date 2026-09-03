import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { adapterOutcome, evidenceClass, providerJobState, searchState } from './enums.js';
import { launchMarkets, providerBrands } from './providers.js';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Search sessions and their privacy-tiered address material (PLA-361/362, ADR-007).
 *
 * Three retention tiers, deliberately separated:
 *  1. `search_address_material` — the encrypted raw/resolved address. Deleted as soon as all
 *     provider jobs terminate; hard ceiling 24 h. Isolated in its own table so deletion is a
 *     row delete, not a column update, and so no index can touch plaintext.
 *  2. Display columns on `searches` (`display_address`, `address_candidates`, `unit_options`)
 *     — safe-by-intent data shown back to the searching user. Wiped when the search expires
 *     (`expires_at`, ≤ 24 h by config).
 *  3. Everything else on `searches` — opaque identifiers, states, timestamps. No PII.
 */
export const searches = pgTable(
  'searches',
  {
    /** Opaque high-entropy id (43-char base64url from 32 random bytes). Safe to log. */
    id: text('id').primaryKey(),
    state: searchState('state').notNull().default('created'),
    /** Typed failure/action reason code; never free text derived from input. */
    reasonCode: text('reason_code'),
    /** Versioned HMAC identity (`v1:<hex>`); cache key material, safe to store and log. */
    addressIdentity: text('address_identity'),
    addressIdentityVersion: integer('address_identity_version'),
    /** Safe display address for the searching user. Wiped at search expiry. */
    displayAddress: text('display_address'),
    /** Resolver candidate options (id + label) while an ambiguity action is pending. */
    addressCandidates:
      jsonb('address_candidates').$type<readonly { id: string; label: string }[]>(),
    /** Enumerated unit options while a unit action is pending. */
    unitOptions: jsonb('unit_options').$type<readonly string[]>(),
    /** The address action currently required from the user, if any. */
    requiredAction: text('required_action'),
    /** Monotonic counter; an action submission must cite the current value (stale rejection). */
    actionEpoch: integer('action_epoch').notNull().default(0),
    resolverId: text('resolver_id'),
    resolverVersion: text('resolver_version'),
    validationState: text('validation_state'),
    addressPrecision: text('address_precision'),
    marketId: text('market_id').references(() => launchMarkets.id, { onDelete: 'set null' }),
    registryVersion: text('registry_version'),
    consentVersion: text('consent_version').notNull(),
    /** Global orchestration deadline (ADR-006). */
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    /** When the whole search record stops being served and display data is wiped. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('searches_expires_at_idx').on(table.expiresAt),
    index('searches_state_idx').on(table.state),
    // The id must be the full-entropy opaque form; a short id would invite enumeration.
    check('searches_id_shape', sql`${table.id} ~ '^[A-Za-z0-9_-]{43}$'`),
    check(
      'searches_identity_version_together',
      sql`(${table.addressIdentity} is null) = (${table.addressIdentityVersion} is null)`,
    ),
  ],
);

export type SearchRow = typeof searches.$inferSelect;
export type NewSearchRow = typeof searches.$inferInsert;

/**
 * Encrypted raw + resolved address material (AES-256-GCM, key from server config).
 * One row per search; deleted early when all jobs terminate, swept at `expires_at` latest.
 */
export const searchAddressMaterial = pgTable(
  'search_address_material',
  {
    searchId: text('search_id')
      .primaryKey()
      .references(() => searches.id, { onDelete: 'cascade' }),
    /** nonce (12) || auth tag (16) || ciphertext of the JSON payload. */
    ciphertext: bytea('ciphertext').notNull(),
    keyVersion: integer('key_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Hard raw-address ceiling (≤ 24 h, ADR-007). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('search_address_material_expires_idx').on(table.expiresAt)],
);

export type SearchAddressMaterialRow = typeof searchAddressMaterial.$inferSelect;

/** Provenance metadata for one observation (PLA-369). Never raw source content. */
export const evidenceRecords = pgTable(
  'evidence_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Validated `Provenance` domain object. */
    provenance: jsonb('provenance').$type<Record<string, unknown>>().notNull(),
    sourceType: text('source_type').notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    contentHash: text('content_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('evidence_records_retrieved_idx').on(table.retrievedAt)],
);

export type EvidenceRecordRow = typeof evidenceRecords.$inferSelect;

/** Candidate evidence rows: why a provider is listed for this search (ADR-003). */
export const searchCandidates = pgTable(
  'search_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: text('search_id')
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'restrict' }),
    evidenceClass: evidenceClass('evidence_class').notNull(),
    /** Validated `CandidateEvidence` domain object. */
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('search_candidates_unique').on(
      table.searchId,
      table.providerId,
      table.evidenceClass,
    ),
    index('search_candidates_search_idx').on(table.searchId),
    // Candidate evidence is never a qualification result (ADR-005).
    check(
      'search_candidates_not_qualification',
      sql`${table.evidenceClass} <> 'provider_qualification'`,
    ),
  ],
);

export type SearchCandidateRow = typeof searchCandidates.$inferSelect;

/**
 * One qualification job per (search, provider, adapter version) — the same key as the queue's
 * singleton key, so duplicate delivery converges on one row (PLA-367).
 */
export const qualificationJobs = pgTable(
  'qualification_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: text('search_id')
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'restrict' }),
    adapterVersion: text('adapter_version').notNull(),
    state: providerJobState('state').notNull().default('queued'),
    outcome: adapterOutcome('outcome'),
    /** Provider action options while `action_required` (safe labels from the adapter). */
    actionOptions: jsonb('action_options').$type<readonly string[]>(),
    attemptCount: integer('attempt_count').notNull().default(0),
    /** PII-free typed code for the latest failure, e.g. `deadline_elapsed`. */
    lastDiagnosticCode: text('last_diagnostic_code'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('qualification_jobs_idempotency').on(
      table.searchId,
      table.providerId,
      table.adapterVersion,
    ),
    index('qualification_jobs_search_idx').on(table.searchId),
    // A settled state must carry its outcome; the two can only be null together pre-settlement.
    check(
      'qualification_jobs_settled_has_outcome',
      sql`(${table.settledAt} is null) or (${table.outcome} is not null) or ${table.state} = 'expired'`,
    ),
  ],
);

export type QualificationJobRow = typeof qualificationJobs.$inferSelect;

/** Every attempt, kept for audit even when retries supersede it. */
export const qualificationAttempts = pgTable(
  'qualification_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => qualificationJobs.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    outcome: adapterOutcome('outcome').notNull(),
    retryClass: text('retry_class').notNull(),
    evidenceId: uuid('evidence_id').references(() => evidenceRecords.id, {
      onDelete: 'set null',
    }),
    /** PII-free typed diagnostics from the adapter. */
    diagnostics: jsonb('diagnostics').$type<Record<string, string | number | boolean>>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    latencyMs: integer('latency_ms').notNull(),
  },
  (table) => [
    uniqueIndex('qualification_attempts_unique').on(table.jobId, table.attemptNumber),
    check('qualification_attempts_latency_nonnegative', sql`${table.latencyMs} >= 0`),
  ],
);

export type QualificationAttemptRow = typeof qualificationAttempts.$inferSelect;
