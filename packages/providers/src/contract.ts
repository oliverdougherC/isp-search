import { AdapterOutcome, StructuredAddress } from '@isp-search/domain';
import { z } from 'zod';

/**
 * Versioned provider adapter contract. Adapters convert a provider-specific flow into typed
 * outcomes; they never decide user-facing confidence (that mapping lives in the domain).
 */

export const IntegrationTier = z.enum([
  /** Official partner/provider API or feed with explicit permission. */
  'official_api',
  /** Documented public consumer API whose terms permit the use. */
  'documented_public_api',
  /** Provider-owned browser flow, automated only after per-provider review. */
  'reviewed_browser_flow',
  /** User-directed official link. No automated verification. */
  'link_only',
  /** Deterministic fixture-backed adapter for tests and local development. */
  'reference_fixture',
]);
export type IntegrationTier = z.infer<typeof IntegrationTier>;

export const QualificationRequest = z
  .object({
    searchId: z.string().min(1),
    providerId: z.string().min(1),
    correlationId: z.string().min(1),
    address: StructuredAddress,
    /** Absolute deadline. Adapters must return `timeout` rather than run past it. */
    deadlineAt: z.iso.datetime(),
    /**
     * The user's answer to a previous `unit_required`/`address_ambiguous` action from THIS
     * provider (PLA-364). Never copied across providers.
     */
    actionResponse: z.string().min(1).max(80).optional(),
  })
  .strict();
export type QualificationRequest = z.infer<typeof QualificationRequest>;

export const QualificationEvidence = z
  .object({
    sourceType: z.enum(['synthetic', 'provider_qualification', 'official_page']),
    sourceUrl: z.url().optional(),
    capturedAt: z.iso.datetime(),
    adapterVersion: z.string().min(1),
    parserVersion: z.string().min(1),
    /** Stable fingerprint of the response shape (never of raw content containing an address). */
    fingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict();
export type QualificationEvidence = z.infer<typeof QualificationEvidence>;

export const QualificationResult = z
  .object({
    outcome: AdapterOutcome,
    evidence: QualificationEvidence.nullable(),
    /** Present only for `unit_required` / `address_ambiguous`; options are provider labels. */
    actionOptions: z.array(z.string().min(1).max(80)).max(50).optional(),
    /** PII-free diagnostics for operators. Keys must be typed codes, not free text. */
    diagnostics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .strict();
export type QualificationResult = z.infer<typeof QualificationResult>;

export interface AdapterContext {
  readonly now: () => Date;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly version: string;
  readonly providerId: string;
  readonly tier: IntegrationTier;
  qualify(request: QualificationRequest, context: AdapterContext): Promise<QualificationResult>;
}
