import { z } from 'zod';

import { EvidenceClass } from './availability.js';
import { Provenance } from './provenance.js';
import { Technology } from './technology.js';

/**
 * Candidate evidence: why a provider is listed for a search at all (ADR-003 Route C).
 * A candidate is a reason to ask, never a claim of availability; absence of a candidate is
 * never evidence of unavailability.
 */

/** Candidate evidence can carry every class except a provider qualification result. */
export const CandidateEvidenceClass = EvidenceClass.exclude(['provider_qualification']);
export type CandidateEvidenceClass = z.infer<typeof CandidateEvidenceClass>;

export const CandidateEvidence = z
  .object({
    schemaVersion: z.literal(1),
    providerId: z.string().min(1).max(64),
    evidenceClass: CandidateEvidenceClass,
    /** Technology hints from the source; hints, not qualified facts. */
    technologies: z.array(Technology).max(6),
    /** Version of the registry (or dataset) that produced this candidate. */
    registryVersion: z.string().min(1).max(64).nullable(),
    /** Eligibility is capacity-based per address (fixed wireless) and changes over time. */
    capacityBasedEligibility: z.boolean(),
    provenance: Provenance,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.provenance.geographicPrecision === 'address') {
      // Route C has no address-precision candidate source; a candidate claiming address
      // precision would let area data masquerade as address-verified downstream (ADR-003).
      if (value.evidenceClass !== 'location_level_licensed') {
        ctx.addIssue({
          code: 'custom',
          path: ['provenance', 'geographicPrecision'],
          message: 'address-precision candidate evidence requires a licensed location-level source',
        });
      }
    }
  });
export type CandidateEvidence = z.infer<typeof CandidateEvidence>;
