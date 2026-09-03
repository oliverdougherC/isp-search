import { Technology } from '@isp-search/domain';
import { z } from 'zod';

/**
 * Versioned launch-registry schema (ADR-001/ADR-003 Route C). The registry is data, not code:
 * markets, providers, evidence, and review dates live in reviewed JSON (and, once seeded, in
 * the database), never in UI branches.
 *
 * `status` matters: the proposed Seattle/Raleigh markets are NOT maintainer-approved; product
 * tests use the synthetic development registry, and nothing may present a `proposed` market as
 * a launch commitment.
 */

export const RegistryEvidenceType = z.enum([
  'official_footprint',
  'bdc_area_summary',
  'unverified',
  'synthetic',
]);
export type RegistryEvidenceType = z.infer<typeof RegistryEvidenceType>;

export const RegistryEvidence = z
  .object({
    type: RegistryEvidenceType,
    url: z.url().optional(),
    checked: z.iso.date().optional(),
    note: z.string().max(400).optional(),
  })
  .strict();
export type RegistryEvidence = z.infer<typeof RegistryEvidence>;

export const RegistryProvider = z
  .object({
    provider_id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    display_name: z.string().min(1).max(120),
    technologies: z.array(Technology).min(1).max(6),
    capacity_based_eligibility: z.boolean().optional(),
    evidence: z.array(RegistryEvidence).min(1).max(10),
    adapter_tier: z.enum(['link_only', 'reference_fixture']),
    fallback_url: z.url(),
    last_reviewed: z.iso.date(),
    listing_blocked_until_evidence: z.boolean().optional(),
  })
  .strict();
export type RegistryProvider = z.infer<typeof RegistryProvider>;

export const RegistryMarket = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    name: z.string().min(1).max(120),
    kind: z.enum(['cbsa', 'county', 'synthetic']),
    /** Explicit geography: CBSA GEOIDs, county FIPS codes, or the synthetic market id. */
    geoids: z.array(z.string().min(1).max(16)).min(1).max(50),
    status: z.enum(['proposed', 'approved', 'development_only']),
    providers: z.array(RegistryProvider).min(1).max(50),
  })
  .strict();
export type RegistryMarket = z.infer<typeof RegistryMarket>;

export const LaunchRegistry = z
  .object({
    $schema: z.string().optional(),
    registry_version: z.string().min(1).max(64),
    status: z.enum(['proposed_pending_maintainer_confirmation', 'approved', 'development_only']),
    route: z.literal('C'),
    bdc_vintage: z
      .object({
        data_as_of: z.iso.date(),
        download_page_last_updated: z.iso.date(),
        attribution: z.string().min(1).max(200),
      })
      .strict(),
    last_reviewed: z.iso.date(),
    completeness_statement_ref: z.string().min(1),
    markets: z.array(RegistryMarket).min(1).max(50),
    unsupported_market_behavior: z
      .object({
        search_state: z.literal('unsupported_market'),
        fcc_map_link: z.url(),
        never_pass_address_in_url: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((registry, ctx) => {
    // A synthetic market may never appear in an approved registry, and a proposed registry
    // may never claim an approved market.
    for (const [index, market] of registry.markets.entries()) {
      if (market.kind === 'synthetic' && registry.status !== 'development_only') {
        ctx.addIssue({
          code: 'custom',
          path: ['markets', index, 'kind'],
          message: 'synthetic markets are development-only',
        });
      }
      if (market.status === 'approved' && registry.status !== 'approved') {
        ctx.addIssue({
          code: 'custom',
          path: ['markets', index, 'status'],
          message: 'a market cannot be approved inside a non-approved registry',
        });
      }
    }
  });
export type LaunchRegistry = z.infer<typeof LaunchRegistry>;
