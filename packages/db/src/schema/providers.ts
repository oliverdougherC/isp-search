import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { adapterSupportState, circuitState, marketStatus, providerAliasKind } from './enums.js';

/**
 * Provider directory (PLA-366 persisted by PLA-361): retail brands, aliases and
 * source-specific identifiers, launch markets, per-market support, and circuit state.
 */

export interface ProviderOfficialLinks {
  readonly homepage?: string;
  readonly availability?: string;
  readonly order?: string;
  readonly broadband_facts?: string;
  readonly support?: string;
  readonly terms?: string;
  readonly privacy?: string;
  readonly correction?: string;
  /** Kept for M1 compatibility; migrate to `broadband_facts`. */
  readonly labels?: string;
}

export const providerBrands = pgTable(
  'provider_brands',
  {
    /** Stable internal identifier (slug). Never a vendor or FCC identifier. */
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    legalEntity: text('legal_entity'),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    officialLinks: jsonb('official_links').$type<ProviderOfficialLinks>().notNull().default({}),
    /** Registrable domains approved for user-facing links (isApprovedOfficialUrl). */
    approvedLinkHosts: text('approved_link_hosts')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    technologies: text('technologies')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    adapterSupport: adapterSupportState('adapter_support').notNull().default('link_only'),
    /** Free-text integration tier per ADR-004; `null` until a tier is approved. */
    integrationTier: text('integration_tier'),
    /** Date the terms/robots review that justifies the current tier was performed. */
    termsReviewedAt: timestamp('terms_reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('provider_brands_adapter_support_idx').on(table.adapterSupport),
    check('provider_brands_id_slug', sql`${table.id} ~ '^[a-z0-9][a-z0-9-]{1,62}$'`),
  ],
);

export type ProviderBrand = typeof providerBrands.$inferSelect;
export type NewProviderBrand = typeof providerBrands.$inferInsert;

/**
 * Alias / DBA / source-specific identifier mapping. The normalized value is unique per
 * (kind, source), so one alias can never silently map to two brands: a duplicate insert fails
 * review instead of auto-merging (PLA-366).
 */
export const providerAliases = pgTable(
  'provider_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'cascade' }),
    kind: providerAliasKind('kind').notNull(),
    /** Which source namespace the value comes from, e.g. `launch_registry`, `bdc`. */
    sourceType: text('source_type').notNull().default('generic'),
    value: text('value').notNull(),
    valueNormalized: text('value_normalized').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('provider_aliases_unique_per_source').on(
      table.kind,
      table.sourceType,
      table.valueNormalized,
    ),
    index('provider_aliases_provider_idx').on(table.providerId),
    check(
      'provider_aliases_value_normalized_lower',
      sql`${table.valueNormalized} = lower(${table.valueNormalized})`,
    ),
  ],
);

export type ProviderAlias = typeof providerAliases.$inferSelect;
export type NewProviderAlias = typeof providerAliases.$inferInsert;

/** Versioned launch markets (ADR-001/003 Route C). Markets are data, never UI branches. */
export const launchMarkets = pgTable(
  'launch_markets',
  {
    /** Registry market id, e.g. `cbsa-42660` or `synthetic-zz`. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind').notNull(), // 'cbsa' | 'county' | 'synthetic'
    /** Explicit geography: CBSA GEOIDs or county FIPS codes. Never ZIP prefixes. */
    geoids: text('geoids')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: marketStatus('status').notNull().default('proposed'),
    registryVersion: text('registry_version').notNull(),
    bdcVintage: date('bdc_vintage'),
    lastReviewed: date('last_reviewed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('launch_markets_kind', sql`${table.kind} in ('cbsa','county','synthetic')`)],
);

export type LaunchMarket = typeof launchMarkets.$inferSelect;
export type NewLaunchMarket = typeof launchMarkets.$inferInsert;

/** Which providers are listed in which market, with their registry evidence. */
export const providerMarkets = pgTable(
  'provider_markets',
  {
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'cascade' }),
    marketId: text('market_id')
      .notNull()
      .references(() => launchMarkets.id, { onDelete: 'cascade' }),
    technologies: text('technologies')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    capacityBasedEligibility: boolean('capacity_based_eligibility').notNull().default(false),
    adapterTier: text('adapter_tier').notNull().default('link_only'),
    fallbackUrl: text('fallback_url'),
    /** Registry evidence entries (official footprint URLs, BDC notes). Never an address. */
    evidence: jsonb('evidence').$type<readonly Record<string, unknown>[]>().notNull().default([]),
    /** Blocked from listing until real evidence exists (launch-matrix flag). */
    listingBlocked: boolean('listing_blocked').notNull().default(false),
    lastReviewed: date('last_reviewed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.providerId, table.marketId] })],
);

export type ProviderMarket = typeof providerMarkets.$inferSelect;
export type NewProviderMarket = typeof providerMarkets.$inferInsert;

/** Circuit/health state per provider (minimal in M2; scoring arrives in M3, PLA-381). */
export const providerHealth = pgTable('provider_health', {
  providerId: text('provider_id')
    .primaryKey()
    .references(() => providerBrands.id, { onDelete: 'cascade' }),
  circuitState: circuitState('circuit_state').notNull().default('closed'),
  /** PII-free typed reason code, e.g. `manual_disable`, `blocked_rate`. */
  reason: text('reason'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProviderHealthRow = typeof providerHealth.$inferSelect;
