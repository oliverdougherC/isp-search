import { z } from 'zod';

/**
 * Provenance: where a normalized fact came from, at what precision, and how fresh it is.
 * Every candidate, qualification result, plan, offer, and price field must be able to point
 * at one of these (PLA-369). Raw source content is never stored here — only metadata and an
 * optional content hash, which is not presented as proof once the content itself is deleted.
 */

export const ProvenanceSourceType = z.enum([
  /** Deterministic reference fixture. Never a claim about the real world. */
  'synthetic',
  'provider_qualification',
  'provider_label',
  'licensed_location_data',
  'bdc_area_summary',
  'official_provider_page',
  'launch_registry',
]);
export type ProvenanceSourceType = z.infer<typeof ProvenanceSourceType>;

export const GeographicPrecision = z.enum(['address', 'building', 'area', 'market']);
export type GeographicPrecision = z.infer<typeof GeographicPrecision>;

export const Provenance = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: ProvenanceSourceType,
    /** Registrable domain of the source, e.g. `fcc.gov`. Never contains an address. */
    sourceDomain: z.string().min(1).max(253).nullable(),
    /** Official source URL. Must never contain a user address (enforced by callers/tests). */
    sourceUrl: z.url().nullable(),
    retrievedAt: z.iso.datetime(),
    /** The "data as of" date of the underlying dataset, when it differs from retrieval. */
    dataVintage: z.iso.date().nullable(),
    /** When a human last reviewed this source entry (registry rows, terms, footprints). */
    lastReviewed: z.iso.date().nullable(),
    geographicPrecision: GeographicPrecision,
    adapterVersion: z.string().min(1).nullable(),
    parserVersion: z.string().min(1).nullable(),
    /** Shape/content hash of the evidence (`sha256:<hex>`); metadata, not retained content. */
    contentHash: z
      .string()
      .regex(/^sha256:[0-9a-f]{64}$/)
      .nullable(),
    /** Human-readable limitation notes, e.g. "area-level only, not address-verified". */
    limitations: z.array(z.string().min(1).max(300)).max(20),
  })
  .strict();
export type Provenance = z.infer<typeof Provenance>;

export const FreshnessState = z.enum(['fresh', 'stale', 'expired']);
export type FreshnessState = z.infer<typeof FreshnessState>;

export interface FreshnessPolicy {
  /** Age (ms) after which the observation is shown as stale. */
  readonly staleAfterMs: number;
  /** Age (ms) after which the observation must no longer be used at all. */
  readonly expireAfterMs: number;
}

/**
 * Deterministic freshness from observation time and a policy. `expired` always wins over
 * `stale`; a nonsensical policy (expire before stale) still reports `expired` correctly.
 */
export function computeFreshness(
  retrievedAt: Date,
  policy: FreshnessPolicy,
  now: Date,
): FreshnessState {
  const age = now.getTime() - retrievedAt.getTime();
  if (age >= policy.expireAfterMs) return 'expired';
  if (age >= policy.staleAfterMs) return 'stale';
  return 'fresh';
}
