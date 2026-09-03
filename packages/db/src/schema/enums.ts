import {
  AdapterOutcome,
  EvidenceClass,
  PriceCadence,
  PriceComponentType,
  ProviderJobState,
  SearchState,
} from '@isp-search/domain';
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL enums mirror the domain vocabulary exactly (PLA-361: no lossy strings).
 * Values come from the zod enums so the two can never drift silently; a domain change
 * surfaces as a generated migration. User-facing availability is deliberately NOT stored:
 * it is derived at read time by `deriveProviderAvailability` (ADR-005), so a cache or
 * denormalization bug can never freeze weak evidence into a verified state.
 */

function options(values: readonly string[]): [string, ...string[]] {
  return [...values] as [string, ...string[]];
}

export const searchState = pgEnum('search_state', options(SearchState.options));
export const providerJobState = pgEnum('provider_job_state', options(ProviderJobState.options));
export const adapterOutcome = pgEnum('adapter_outcome', options(AdapterOutcome.options));
export const evidenceClass = pgEnum('evidence_class', options(EvidenceClass.options));
export const priceComponentType = pgEnum(
  'price_component_type',
  options(PriceComponentType.options),
);
export const priceCadence = pgEnum('price_cadence', options(PriceCadence.options));

export const adapterSupportState = pgEnum('adapter_support_state', [
  'reference',
  'link_only',
  'disabled',
]);

export const circuitState = pgEnum('circuit_state', ['closed', 'open']);

export const marketStatus = pgEnum('market_status', ['proposed', 'approved', 'development_only']);

export const moneyKind = pgEnum('money_kind', ['known', 'unknown']);

export const providerAliasKind = pgEnum('provider_alias_kind', ['alias', 'dba', 'source_id']);

export const retentionDataClass = pgEnum('retention_data_class', [
  'raw_address',
  'search_display_data',
  'expired_search',
  'address_offers',
  'provider_artifacts',
  'catalog_plans',
]);
