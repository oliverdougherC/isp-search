import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { moneyKind, priceCadence, priceComponentType } from './enums.js';
import { providerBrands } from './providers.js';
import { evidenceRecords, qualificationJobs, searches } from './searches.js';

/**
 * Catalog plans versus address offers (PLA-361, ADR-005).
 *
 * `catalog_plans` are provider products shared across addresses — they can NEVER satisfy an
 * address query on their own. `address_offers` exist only inside one search and are keyed by
 * (search, provider, adapter version, offer key) so at-least-once job delivery converges on
 * one canonical row. Offers carry their HMAC address identity so a future qualification cache
 * (PLA-369) reuses them only for the exact same address identity and version.
 */

export const catalogPlans = pgTable(
  'catalog_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'cascade' }),
    planKey: text('plan_key').notNull(),
    /** Parser version that produced this observation; versions coexist deliberately. */
    parserVersion: text('parser_version').notNull(),
    /** Validated `CatalogPlan` domain object (`kind: 'catalog_plan'`). */
    plan: jsonb('plan').$type<Record<string, unknown>>().notNull(),
    evidenceId: uuid('evidence_id').references(() => evidenceRecords.id, { onDelete: 'set null' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    /** Catalog cache expiry — separate policy from address qualification (PLA-369). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('catalog_plans_unique').on(table.providerId, table.planKey, table.parserVersion),
    index('catalog_plans_expires_idx').on(table.expiresAt),
    // A catalog row must contain a catalog plan, not an address offer.
    check('catalog_plans_kind', sql`${table.plan}->>'kind' = 'catalog_plan'`),
  ],
);

export type CatalogPlanRow = typeof catalogPlans.$inferSelect;

export const addressOffers = pgTable(
  'address_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: text('search_id')
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
      .notNull()
      .references(() => providerBrands.id, { onDelete: 'restrict' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => qualificationJobs.id, { onDelete: 'cascade' }),
    adapterVersion: text('adapter_version').notNull(),
    offerKey: text('offer_key').notNull(),
    /** Validated `AddressOffer` domain object (`kind: 'address_offer'`). */
    offer: jsonb('offer').$type<Record<string, unknown>>().notNull(),
    evidenceId: uuid('evidence_id').references(() => evidenceRecords.id, { onDelete: 'set null' }),
    /** Versioned HMAC identity of the qualified address; safe, and never plaintext. */
    addressIdentity: text('address_identity').notNull(),
    addressIdentityVersion: integer('address_identity_version').notNull(),
    retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull(),
    /** Offer-cache ceiling (≤ 7 days, ADR-007). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Duplicate job delivery cannot create duplicate canonical offers (PLA-361/367).
    uniqueIndex('address_offers_idempotency').on(
      table.searchId,
      table.providerId,
      table.adapterVersion,
      table.offerKey,
    ),
    index('address_offers_search_idx').on(table.searchId),
    index('address_offers_expires_idx').on(table.expiresAt),
    index('address_offers_identity_idx').on(table.addressIdentity),
    // An offer row must contain an address offer, not a catalog plan (ADR-005 cache invariant).
    check('address_offers_kind', sql`${table.offer}->>'kind' = 'address_offer'`),
  ],
);

export type AddressOfferRow = typeof addressOffers.$inferSelect;

/**
 * Price components, denormalized from the offer for constraint-backed semantics: an unknown
 * amount can never carry cents, and a known amount must have them (no invented zeros).
 */
export const offerPriceComponents = pgTable(
  'offer_price_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => addressOffers.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    componentType: priceComponentType('component_type').notNull(),
    label: text('label').notNull(),
    amountKind: moneyKind('amount_kind').notNull(),
    amountCents: integer('amount_cents'),
    unknownReason: text('unknown_reason'),
    cadence: priceCadence('cadence').notNull(),
    appliesFromMonth: integer('applies_from_month'),
    appliesThroughMonth: integer('applies_through_month'),
    requiredConditions: text('required_conditions')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    included: boolean('included').notNull(),
  },
  (table) => [
    uniqueIndex('offer_price_components_unique').on(table.offerId, table.position),
    check(
      'offer_price_components_money_shape',
      sql`(${table.amountKind} = 'known' and ${table.amountCents} is not null and ${table.unknownReason} is null)
       or (${table.amountKind} = 'unknown' and ${table.amountCents} is null and ${table.unknownReason} is not null)`,
    ),
  ],
);

export type OfferPriceComponentRow = typeof offerPriceComponents.$inferSelect;

/** Offer conditions as facts, denormalized alongside the components. */
export const offerConditions = pgTable(
  'offer_conditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => addressOffers.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    conditionType: text('condition_type').notNull(),
    description: text('description'),
  },
  (table) => [uniqueIndex('offer_conditions_unique').on(table.offerId, table.position)],
);

export type OfferConditionRow = typeof offerConditions.$inferSelect;
