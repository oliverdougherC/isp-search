import { z } from 'zod';

import { StructuredAddress, UsRegionCode } from './address.js';
import { AdapterOutcome, AvailabilityState } from './availability.js';
import { CandidateEvidenceClass } from './candidate.js';
import { AddressOffer } from './offer.js';
import { FreshnessState, GeographicPrecision, ProvenanceSourceType } from './provenance.js';
import { AddressResolutionAction } from './resolved-address.js';
import { ProviderJobState, SearchState } from './search-state.js';
import { Technology } from './technology.js';
import { AvailabilityBasis } from './truth.js';

/**
 * The versioned public search API contract (PLA-368). Everything here is safe by
 * construction: opaque ids, typed states, display-tier address data only, and never a vendor
 * response shape. `apiVersion` is the stable discriminator for future clients.
 */

export const API_VERSION = 1;

export const SearchSubmission = z
  .object({
    apiVersion: z.literal(API_VERSION),
    address: z
      .object({
        line1: z.string().min(1).max(200),
        unit: z.string().min(1).max(40).nullable(),
        city: z.string().min(1).max(100),
        region: UsRegionCode,
        postalCode: StructuredAddress.shape.postalCode,
      })
      .strict(),
    /** The consent copy version the user saw before submitting. */
    consentVersion: z.string().min(1).max(64),
  })
  .strict();
export type SearchSubmission = z.infer<typeof SearchSubmission>;

export const SearchActionSubmission = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.literal('select_candidate'),
        candidateId: z.string().min(1).max(64),
        epoch: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        type: z.literal('provide_unit'),
        unit: z.string().min(1).max(40),
        epoch: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        type: z.literal('correct_input'),
        address: SearchSubmission.shape.address,
        epoch: z.number().int().min(0),
      })
      .strict(),
    z
      .object({
        type: z.literal('provider_choice'),
        providerId: z.string().min(1).max(64),
        choice: z.string().min(1).max(80),
      })
      .strict(),
  ])
  .and(z.object({ apiVersion: z.literal(API_VERSION) }));
export type SearchActionSubmission = z.infer<typeof SearchActionSubmission>;

export const EvidenceSummary = z
  .object({
    evidenceClass: CandidateEvidenceClass,
    sourceType: ProvenanceSourceType,
    sourceUrl: z.url().nullable(),
    retrievedAt: z.iso.datetime(),
    dataVintage: z.iso.date().nullable(),
    lastReviewed: z.iso.date().nullable(),
    geographicPrecision: GeographicPrecision,
    limitations: z.array(z.string()).max(20),
    freshness: FreshnessState,
  })
  .strict();
export type EvidenceSummary = z.infer<typeof EvidenceSummary>;

export const ProviderResult = z
  .object({
    providerId: z.string(),
    displayName: z.string(),
    technologies: z.array(Technology),
    adapterTier: z.enum(['link_only', 'reference_fixture']).nullable(),
    capacityBasedEligibility: z.boolean(),
    /** Centrally derived (ADR-005). Never assigned by an adapter or a source. */
    availability: AvailabilityState,
    availabilityBasis: z.enum([
      AvailabilityBasis.providerQualification,
      AvailabilityBasis.candidateEvidence,
      AvailabilityBasis.none,
    ]),
    /** Job progress; null when this provider has no qualification job (link-only). */
    jobState: ProviderJobState.nullable(),
    /** Typed execution outcome of the latest settled attempt; never free text. */
    outcome: AdapterOutcome.nullable(),
    /** Typed diagnostic code, e.g. `circuit_open`, `deadline_elapsed`. */
    diagnosticCode: z.string().nullable(),
    /** This provider's pending question, when it needs the user to choose. */
    actionRequired: z
      .object({ options: z.array(z.string().min(1).max(80)).max(50) })
      .strict()
      .nullable(),
    officialLinks: z
      .object({
        homepage: z.url().optional(),
        availability: z.url().optional(),
      })
      .strict(),
    evidence: z.array(EvidenceSummary).max(10),
    offers: z.array(AddressOffer).max(10),
    /** When the newest qualification observation was made, if any. */
    qualifiedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type ProviderResult = z.infer<typeof ProviderResult>;

export const SearchResource = z
  .object({
    apiVersion: z.literal(API_VERSION),
    id: z.string(),
    state: SearchState,
    reasonCode: z.string().nullable(),
    /** Display-tier only; null once the search's display data expired. */
    displayAddress: z.string().nullable(),
    requiredAction: AddressResolutionAction.nullable(),
    addressCandidates: z.array(z.object({ id: z.string(), label: z.string() }).strict()).max(10),
    unitOptions: z.array(z.string()).max(200),
    /** Cite this value when submitting an address action; stale epochs are rejected. */
    actionEpoch: z.number().int().min(0),
    market: z
      .object({
        supported: z.boolean(),
        id: z.string().nullable(),
        name: z.string().nullable(),
        /** `proposed` and `development_only` markets must never read as launch commitments. */
        status: z.enum(['proposed', 'approved', 'development_only']).nullable(),
        registryVersion: z.string().nullable(),
        lastReviewed: z.iso.date().nullable(),
        bdcVintage: z.iso.date().nullable(),
        attribution: z.string().nullable(),
      })
      .strict()
      .nullable(),
    /** ADR-001 completeness language, rendered verbatim by every client. */
    completenessStatement: z.string(),
    fccMapUrl: z.url(),
    pollIntervalMs: z.number().int().min(250),
    deadlineAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    providers: z.array(ProviderResult).max(50),
  })
  .strict();
export type SearchResource = z.infer<typeof SearchResource>;

export const SearchCreated = z
  .object({
    apiVersion: z.literal(API_VERSION),
    id: z.string(),
    state: SearchState,
    requiredAction: AddressResolutionAction.nullable(),
    pollIntervalMs: z.number().int().min(250),
    deadlineAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type SearchCreated = z.infer<typeof SearchCreated>;

/** ADR-001's exact user-facing completeness language, with the review date substituted. */
export function completenessStatement(lastReviewed: string): string {
  return (
    'ISP Search checks a fixed list of providers for each supported area. It does not check ' +
    'every internet provider, and a provider missing from your results may still serve your ' +
    "address. We only mark a provider as verified when the provider's own address check " +
    'confirmed it; in this beta no provider is verified automatically, so results are marked ' +
    "likely (from public area-level data and the provider's published service area) or " +
    'unknown. Nothing here means a provider is unavailable. Provider list last reviewed: ' +
    `${lastReviewed}. For the FCC's full list of reported providers, use the FCC National ` +
    'Broadband Map.'
  );
}
