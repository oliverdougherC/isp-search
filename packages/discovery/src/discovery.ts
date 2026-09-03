import {
  computeFreshness,
  type CandidateEvidence,
  type GeographicScope,
  type Technology,
} from '@isp-search/domain';

import type {
  LaunchRegistry,
  RegistryEvidence,
  RegistryMarket,
  RegistryProvider,
} from './registry-schema.js';

/**
 * CandidateDiscovery (PLA-365): turns a resolved geographic scope into a defensible provider
 * candidate set. Route C: the versioned launch registry is the only production source; area
 * evidence never claims address precision, and absence from the registry is never negative
 * evidence.
 */

export interface DiscoveryInput {
  readonly scope: GeographicScope;
  readonly now: Date;
}

export interface DiscoveredMarket {
  readonly id: string;
  readonly name: string;
  readonly status: 'proposed' | 'approved' | 'development_only';
  readonly registryVersion: string;
  readonly lastReviewed: string;
  readonly bdcVintage: string;
  readonly attribution: string;
}

export interface ProviderCandidate {
  readonly providerId: string;
  readonly displayName: string;
  readonly technologies: readonly Technology[];
  readonly adapterTier: 'link_only' | 'reference_fixture';
  readonly fallbackUrl: string;
  readonly capacityBasedEligibility: boolean;
  readonly evidence: readonly CandidateEvidence[];
}

export type DiscoveryResult =
  | {
      readonly status: 'supported';
      readonly market: DiscoveredMarket;
      readonly candidates: readonly ProviderCandidate[];
      /** True when the registry is past its review threshold; candidates remain usable. */
      readonly registryStale: boolean;
      readonly fccMapUrl: string;
    }
  | {
      readonly status: 'unsupported_market';
      readonly registryVersion: string;
      readonly lastReviewed: string;
      readonly fccMapUrl: string;
    };

export interface CandidateDiscovery {
  discover(input: DiscoveryInput): Promise<DiscoveryResult>;
}

/** Typed outage: the caller degrades the search to partial/unknown, never fabricates. */
export class DiscoveryUnavailableError extends Error {
  override readonly name = 'DiscoveryUnavailableError';
  constructor() {
    super('candidate discovery source unavailable');
  }
}

const REGISTRY_STALE_AFTER_DAYS = 120; // quarterly review cadence plus grace (ADR-001)
const DAY_MS = 24 * 3600 * 1000;

function marketMatches(market: RegistryMarket, scope: GeographicScope): boolean {
  switch (market.kind) {
    case 'cbsa':
    case 'synthetic':
      return scope.cbsaGeoid !== null && market.geoids.includes(scope.cbsaGeoid);
    case 'county':
      return scope.countyFips !== null && market.geoids.includes(scope.countyFips);
  }
}

function evidenceToCandidate(
  registry: LaunchRegistry,
  provider: RegistryProvider,
  evidence: RegistryEvidence,
  now: Date,
  registryStale: boolean,
): CandidateEvidence | null {
  if (evidence.type === 'unverified') return null;
  const shared = {
    schemaVersion: 1 as const,
    providerId: provider.provider_id,
    technologies: [...provider.technologies],
    registryVersion: registry.registry_version,
    capacityBasedEligibility: provider.capacity_based_eligibility ?? false,
  };
  const limitations = [
    'candidate evidence only; the provider confirms serviceability',
    ...(registryStale ? ['registry review is overdue; treat listing as stale'] : []),
    ...(provider.capacity_based_eligibility
      ? ['eligibility is capacity-based per address and changes over time']
      : []),
  ];
  const base = {
    schemaVersion: 1 as const,
    retrievedAt: now.toISOString(),
    lastReviewed: provider.last_reviewed,
    adapterVersion: null,
    parserVersion: null,
    contentHash: null,
    limitations,
  };
  switch (evidence.type) {
    case 'official_footprint':
      return {
        ...shared,
        evidenceClass: 'official_generic_page',
        provenance: {
          ...base,
          sourceType: 'official_provider_page',
          sourceDomain: evidence.url ? new URL(evidence.url).hostname : null,
          sourceUrl: evidence.url ?? null,
          dataVintage: evidence.checked ?? null,
          geographicPrecision: 'market',
        },
      };
    case 'bdc_area_summary':
      return {
        ...shared,
        evidenceClass: 'area_level_reported',
        provenance: {
          ...base,
          sourceType: 'bdc_area_summary',
          sourceDomain: 'fcc.gov',
          sourceUrl: evidence.url ?? null,
          dataVintage: registry.bdc_vintage.data_as_of,
          geographicPrecision: 'area',
          limitations: [...limitations, registry.bdc_vintage.attribution],
        },
      };
    case 'synthetic':
      return {
        ...shared,
        evidenceClass: 'area_level_reported',
        provenance: {
          ...base,
          sourceType: 'synthetic',
          sourceDomain: 'example.com',
          sourceUrl: null,
          dataVintage: null,
          geographicPrecision: 'market',
        },
      };
  }
}

export interface RegistryDiscoveryOptions {
  /** Loads the current registry snapshot (from the database in production, or a literal). */
  readonly loadRegistry: () => Promise<LaunchRegistry>;
  readonly staleAfterDays?: number;
}

/**
 * The Route C implementation. Pure over its snapshot: no network, no database — callers supply
 * a loader (deterministic fakes pass a literal; production loads the seeded registry tables).
 */
export function createRegistryCandidateDiscovery(
  options: RegistryDiscoveryOptions,
): CandidateDiscovery {
  const staleAfterDays = options.staleAfterDays ?? REGISTRY_STALE_AFTER_DAYS;
  return {
    async discover(input: DiscoveryInput): Promise<DiscoveryResult> {
      let registry: LaunchRegistry;
      try {
        registry = await options.loadRegistry();
      } catch {
        throw new DiscoveryUnavailableError();
      }
      const fccMapUrl = registry.unsupported_market_behavior.fcc_map_link;
      const market = registry.markets.find((candidate) => marketMatches(candidate, input.scope));
      if (!market) {
        return {
          status: 'unsupported_market',
          registryVersion: registry.registry_version,
          lastReviewed: registry.last_reviewed,
          fccMapUrl,
        };
      }
      const registryStale =
        computeFreshness(
          new Date(`${registry.last_reviewed}T00:00:00.000Z`),
          {
            staleAfterMs: staleAfterDays * DAY_MS,
            expireAfterMs: Number.POSITIVE_INFINITY,
          },
          input.now,
        ) !== 'fresh';
      const candidates: ProviderCandidate[] = [];
      for (const provider of market.providers) {
        if (provider.listing_blocked_until_evidence === true) continue;
        const evidence = provider.evidence
          .map((entry) => evidenceToCandidate(registry, provider, entry, input.now, registryStale))
          .filter((entry): entry is CandidateEvidence => entry !== null);
        if (evidence.length === 0) continue;
        candidates.push({
          providerId: provider.provider_id,
          displayName: provider.display_name,
          technologies: provider.technologies,
          adapterTier: provider.adapter_tier,
          fallbackUrl: provider.fallback_url,
          capacityBasedEligibility: provider.capacity_based_eligibility ?? false,
          evidence,
        });
      }
      return {
        status: 'supported',
        market: {
          id: market.id,
          name: market.name,
          status: market.status,
          registryVersion: registry.registry_version,
          lastReviewed: registry.last_reviewed,
          bdcVintage: registry.bdc_vintage.data_as_of,
          attribution: registry.bdc_vintage.attribution,
        },
        candidates,
        registryStale,
        fccMapUrl,
      };
    },
  };
}
