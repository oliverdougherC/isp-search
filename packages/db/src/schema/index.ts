import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * M1 foundation schema. The full search schema (searches, candidates, attempts, offers,
 * evidence artifacts, retention) is owned by M2 (PLA-361). This file establishes migration
 * ownership and a minimal provider directory used by the deterministic reference adapters.
 */

export const adapterSupportState = pgEnum('adapter_support_state', [
  'reference',
  'link_only',
  'disabled',
]);

export interface ProviderOfficialLinks {
  readonly homepage?: string;
  readonly availability?: string;
  readonly labels?: string;
  readonly privacy?: string;
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
