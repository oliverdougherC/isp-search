import { z } from 'zod';

import { ContractTerm, DataAllowance, Money, Speed } from './money.js';
import { Provenance } from './provenance.js';
import { Technology } from './technology.js';

/**
 * Catalog plans versus address offers (PLA-360).
 *
 * A catalog plan is a reusable provider product ("Fiber 1 Gig") shared across addresses. An
 * address offer exists only in the context of one search's address. The `kind` discriminants
 * make the two structurally incompatible so a generic plan can never be persisted or serialized
 * as an address-specific result (the cache invariant behind ADR-005).
 */

export const PriceComponentType = z.enum([
  'base_recurring',
  'introductory_recurring',
  'provider_fee_recurring',
  'passthrough_fee_recurring',
  'equipment_rental',
  'equipment_purchase',
  'installation',
  'activation',
  'one_time_credit',
  'recurring_discount',
  'tax_excluded',
  'unknown_other',
]);
export type PriceComponentType = z.infer<typeof PriceComponentType>;

export const OfferConditionType = z.enum([
  'auto_pay',
  'paperless_billing',
  'mobile_line',
  'bundle',
  'new_customer',
  'credit_approval',
  'term_commitment',
  'equipment_choice',
  'self_install',
  'limited_availability',
  'provider_caveat',
]);
export type OfferConditionType = z.infer<typeof OfferConditionType>;

export const OfferCondition = z
  .object({
    type: OfferConditionType,
    /** Safe display text from public marketing copy; never user or address data. */
    description: z.string().min(1).max(300).nullable(),
  })
  .strict();
export type OfferCondition = z.infer<typeof OfferCondition>;

export const PriceCadence = z.enum(['monthly', 'one_time']);
export type PriceCadence = z.infer<typeof PriceCadence>;

export const PriceComponent = z
  .object({
    type: PriceComponentType,
    /** Display label from the source, e.g. "Internet 500 promotional rate". */
    label: z.string().min(1).max(120),
    amount: Money,
    cadence: PriceCadence,
    /** 1-based month range this component applies to; null = open-ended / from month 1. */
    appliesFromMonth: z.number().int().min(1).nullable(),
    appliesThroughMonth: z.number().int().min(1).nullable(),
    /** Conditions required for this component (e.g. a discount needing Auto Pay). */
    requiredConditions: z.array(OfferConditionType).max(8),
    /** False when the amount is charged separately/optionally (e.g. optional equipment). */
    included: z.boolean(),
  })
  .strict();
export type PriceComponent = z.infer<typeof PriceComponent>;

export const CatalogPlan = z
  .object({
    kind: z.literal('catalog_plan'),
    schemaVersion: z.literal(1),
    providerId: z.string().min(1).max(64),
    /** Provider-scoped stable key, e.g. `fiber-1gig`. */
    planKey: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    technology: Technology,
    download: Speed,
    upload: Speed,
    typicalLatencyMs: z.number().positive().nullable(),
    dataAllowance: DataAllowance,
    /** Official Broadband Facts label URL when one is known for the plan. */
    broadbandFactsUrl: z.url().nullable(),
    provenance: Provenance,
  })
  .strict();
export type CatalogPlan = z.infer<typeof CatalogPlan>;

export const AddressOffer = z
  .object({
    kind: z.literal('address_offer'),
    schemaVersion: z.literal(1),
    providerId: z.string().min(1).max(64),
    /** Stable within (search, provider, adapter version); the offer idempotency key part. */
    offerKey: z.string().min(1).max(80),
    /** Optional reference to the catalog plan this offer instantiates. */
    planKey: z.string().min(1).max(80).nullable(),
    name: z.string().min(1).max(120),
    technology: Technology,
    download: Speed,
    upload: Speed,
    dataAllowance: DataAllowance,
    contract: ContractTerm,
    priceComponents: z.array(PriceComponent).min(1).max(30),
    /** The recurring price after every promotion ends; `unknown` is an honest, common answer. */
    postPromotionMonthly: Money,
    conditions: z.array(OfferCondition).max(12),
    /** Official ordering deep link (validated upstream against the provider allowlist). */
    orderUrl: z.url().nullable(),
    broadbandFactsUrl: z.url().nullable(),
    provenance: Provenance,
  })
  .strict();
export type AddressOffer = z.infer<typeof AddressOffer>;
