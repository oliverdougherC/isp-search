import { sql } from 'drizzle-orm';

import type { DatabaseHandle } from './client.js';
import { providerBrands, type NewProviderBrand } from './schema/index.js';

/**
 * Non-sensitive seed data: the deterministic reference providers used by the reference
 * adapters. Real provider brands are added in M2 from the launch registry (ADR-001/003).
 */
export const REFERENCE_PROVIDER_SEED: readonly NewProviderBrand[] = [
  {
    id: 'reference-available',
    displayName: 'Reference Provider (available)',
    legalEntity: null,
    aliases: ['ref-available'],
    officialLinks: { homepage: 'https://example.com/reference/available' },
    adapterSupport: 'reference',
    integrationTier: 'reference_fixture',
  },
  {
    id: 'reference-unavailable',
    displayName: 'Reference Provider (unavailable)',
    legalEntity: null,
    aliases: ['ref-unavailable'],
    officialLinks: { homepage: 'https://example.com/reference/unavailable' },
    adapterSupport: 'reference',
    integrationTier: 'reference_fixture',
  },
  {
    id: 'reference-unit-required',
    displayName: 'Reference Provider (unit required)',
    legalEntity: null,
    aliases: ['ref-unit-required'],
    officialLinks: { homepage: 'https://example.com/reference/unit-required' },
    adapterSupport: 'reference',
    integrationTier: 'reference_fixture',
  },
  {
    id: 'reference-timeout',
    displayName: 'Reference Provider (timeout)',
    legalEntity: null,
    aliases: ['ref-timeout'],
    officialLinks: { homepage: 'https://example.com/reference/timeout' },
    adapterSupport: 'reference',
    integrationTier: 'reference_fixture',
  },
];

export async function seedReferenceProviders(handle: DatabaseHandle): Promise<number> {
  await handle.db
    .insert(providerBrands)
    .values([...REFERENCE_PROVIDER_SEED])
    .onConflictDoUpdate({
      target: providerBrands.id,
      set: {
        displayName: sql`excluded.display_name`,
        aliases: sql`excluded.aliases`,
        officialLinks: sql`excluded.official_links`,
        adapterSupport: sql`excluded.adapter_support`,
        integrationTier: sql`excluded.integration_tier`,
        updatedAt: sql`now()`,
      },
    });
  return REFERENCE_PROVIDER_SEED.length;
}
