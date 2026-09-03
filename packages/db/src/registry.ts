import { LaunchRegistry } from '@isp-search/discovery';
import { and, eq, ne } from 'drizzle-orm';

import type { Database, DatabaseHandle } from './client.js';
import {
  launchMarkets,
  launchRegistryDocuments,
  providerAliases,
  providerBrands,
  providerMarkets,
} from './schema/index.js';

/**
 * Launch-registry import (PLA-365/366). The validated registry JSON is stored verbatim as a
 * versioned document (at most one active), and denormalized into the provider directory and
 * market tables for queries. Imports are idempotent per registry version.
 */

export class RegistryImportError extends Error {
  override readonly name = 'RegistryImportError';
  readonly code: 'ambiguous_alias' | 'unsafe_url';
  constructor(code: 'ambiguous_alias' | 'unsafe_url', detail: string) {
    super(`${code}: ${detail}`);
    this.code = code;
  }
}

function assertHttpsUrl(url: string, context: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    throw new RegistryImportError('unsafe_url', `${context}: only credential-free https URLs`);
  }
  return parsed;
}

async function ensureAlias(
  tx: Database,
  providerId: string,
  kind: 'alias' | 'source_id',
  sourceType: string,
  value: string,
): Promise<void> {
  const valueNormalized = value.toLowerCase().trim();
  const [existing] = await tx
    .select({ providerId: providerAliases.providerId })
    .from(providerAliases)
    .where(
      and(
        eq(providerAliases.kind, kind),
        eq(providerAliases.sourceType, sourceType),
        eq(providerAliases.valueNormalized, valueNormalized),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.providerId !== providerId) {
      // One name mapping to two brands is a review failure, never an auto-merge (PLA-366).
      throw new RegistryImportError(
        'ambiguous_alias',
        `${kind}/${sourceType} value maps to both ${existing.providerId} and ${providerId}`,
      );
    }
    return;
  }
  await tx.insert(providerAliases).values({ providerId, kind, sourceType, value, valueNormalized });
}

export interface ImportRegistryOptions {
  /** Make this the active registry that candidate discovery reads. */
  readonly activate: boolean;
  readonly now?: Date;
}

export async function importRegistry(
  handle: DatabaseHandle,
  registryInput: LaunchRegistry,
  options: ImportRegistryOptions,
): Promise<{ registryVersion: string; providers: number; markets: number }> {
  const registry = LaunchRegistry.parse(registryInput);
  const now = options.now ?? new Date();

  // Collect the unique providers across markets, unioning technologies and hosts.
  const providers = new Map<
    string,
    {
      displayName: string;
      technologies: Set<string>;
      hosts: Set<string>;
      fallbackUrl: string;
      tier: 'link_only' | 'reference_fixture';
      lastReviewed: string;
    }
  >();
  for (const market of registry.markets) {
    for (const provider of market.providers) {
      const fallback = assertHttpsUrl(provider.fallback_url, provider.provider_id);
      const entry = providers.get(provider.provider_id) ?? {
        displayName: provider.display_name,
        technologies: new Set<string>(),
        hosts: new Set<string>(),
        fallbackUrl: provider.fallback_url,
        tier: provider.adapter_tier,
        lastReviewed: provider.last_reviewed,
      };
      for (const technology of provider.technologies) entry.technologies.add(technology);
      entry.hosts.add(fallback.hostname.replace(/^www\./, ''));
      for (const evidence of provider.evidence) {
        if (evidence.url) {
          entry.hosts.add(
            assertHttpsUrl(evidence.url, provider.provider_id).hostname.replace(/^www\./, ''),
          );
        }
      }
      providers.set(provider.provider_id, entry);
    }
  }

  await handle.db.transaction(async (tx) => {
    for (const [providerId, entry] of providers) {
      await tx
        .insert(providerBrands)
        .values({
          id: providerId,
          displayName: entry.displayName,
          technologies: [...entry.technologies].sort(),
          officialLinks: {
            homepage: new URL(entry.fallbackUrl).origin,
            availability: entry.fallbackUrl,
          },
          approvedLinkHosts: [...entry.hosts].sort(),
          adapterSupport: entry.tier === 'reference_fixture' ? 'reference' : 'link_only',
          integrationTier: entry.tier,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: providerBrands.id,
          set: {
            displayName: entry.displayName,
            technologies: [...entry.technologies].sort(),
            officialLinks: {
              homepage: new URL(entry.fallbackUrl).origin,
              availability: entry.fallbackUrl,
            },
            approvedLinkHosts: [...entry.hosts].sort(),
            adapterSupport: entry.tier === 'reference_fixture' ? 'reference' : 'link_only',
            integrationTier: entry.tier,
            updatedAt: now,
          },
        });
      await ensureAlias(tx, providerId, 'source_id', 'launch_registry', providerId);
      await ensureAlias(tx, providerId, 'alias', 'launch_registry', entry.displayName);
    }

    for (const market of registry.markets) {
      await tx
        .insert(launchMarkets)
        .values({
          id: market.id,
          name: market.name,
          kind: market.kind,
          geoids: [...market.geoids],
          status: market.status,
          registryVersion: registry.registry_version,
          bdcVintage: registry.bdc_vintage.data_as_of,
          lastReviewed: registry.last_reviewed,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: launchMarkets.id,
          set: {
            name: market.name,
            kind: market.kind,
            geoids: [...market.geoids],
            status: market.status,
            registryVersion: registry.registry_version,
            bdcVintage: registry.bdc_vintage.data_as_of,
            lastReviewed: registry.last_reviewed,
            updatedAt: now,
          },
        });
      // Replace the market's provider rows wholesale so removals are honored.
      await tx.delete(providerMarkets).where(eq(providerMarkets.marketId, market.id));
      for (const provider of market.providers) {
        await tx.insert(providerMarkets).values({
          providerId: provider.provider_id,
          marketId: market.id,
          technologies: [...provider.technologies],
          capacityBasedEligibility: provider.capacity_based_eligibility ?? false,
          adapterTier: provider.adapter_tier,
          fallbackUrl: provider.fallback_url,
          evidence: provider.evidence,
          listingBlocked: provider.listing_blocked_until_evidence ?? false,
          lastReviewed: provider.last_reviewed,
        });
      }
    }

    await tx
      .insert(launchRegistryDocuments)
      .values({
        registryVersion: registry.registry_version,
        status: registry.status,
        document: registry,
        active: false,
        importedAt: now,
      })
      .onConflictDoUpdate({
        target: launchRegistryDocuments.registryVersion,
        set: {
          status: registry.status,
          document: registry,
          importedAt: now,
        },
      });
    if (options.activate) {
      await tx
        .update(launchRegistryDocuments)
        .set({ active: false })
        .where(ne(launchRegistryDocuments.registryVersion, registry.registry_version));
      await tx
        .update(launchRegistryDocuments)
        .set({ active: true })
        .where(eq(launchRegistryDocuments.registryVersion, registry.registry_version));
    }
  });

  return {
    registryVersion: registry.registry_version,
    providers: providers.size,
    markets: registry.markets.length,
  };
}

export class NoActiveRegistryError extends Error {
  override readonly name = 'NoActiveRegistryError';
  constructor() {
    super('no active launch registry document');
  }
}

/** Loads the single active registry document for candidate discovery. */
export async function loadActiveRegistry(handle: DatabaseHandle): Promise<LaunchRegistry> {
  const [row] = await handle.db
    .select({ document: launchRegistryDocuments.document })
    .from(launchRegistryDocuments)
    .where(eq(launchRegistryDocuments.active, true))
    .limit(1);
  if (!row) throw new NoActiveRegistryError();
  return LaunchRegistry.parse(row.document);
}

/** Deterministic alias lookup; returns undefined when the alias is unknown. */
export async function resolveProviderAlias(
  handle: DatabaseHandle,
  input: {
    readonly kind: 'alias' | 'dba' | 'source_id';
    readonly sourceType: string;
    readonly value: string;
  },
): Promise<string | undefined> {
  const [row] = await handle.db
    .select({ providerId: providerAliases.providerId })
    .from(providerAliases)
    .where(
      and(
        eq(providerAliases.kind, input.kind),
        eq(providerAliases.sourceType, input.sourceType),
        eq(providerAliases.valueNormalized, input.value.toLowerCase().trim()),
      ),
    )
    .limit(1);
  return row?.providerId;
}
