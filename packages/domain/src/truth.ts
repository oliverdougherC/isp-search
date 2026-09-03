import {
  EVIDENCE_PRIORITY,
  mapCandidateEvidenceToAvailability,
  type AdapterOutcome,
  type AvailabilityState,
} from './availability.js';
import type { CandidateEvidenceClass } from './candidate.js';
import type { ProviderJobState } from './search-state.js';

/**
 * Centralized derivation of user-facing availability (ADR-005). Adapters and candidate sources
 * never assign public confidence; everything flows through this function.
 *
 * Invariants (each covered by a test):
 * - only an explicit provider `available` / `unavailable` outcome yields a verified state;
 * - every failure outcome (timeout, captcha, blocked, parse_error, ...) falls back to
 *   candidate evidence, which caps at `reported_available` / `likely_available`;
 * - no evidence and no explicit outcome yields `unknown` — never `verified_unavailable`.
 */

export const AvailabilityBasis = {
  providerQualification: 'provider_qualification',
  candidateEvidence: 'candidate_evidence',
  none: 'none',
} as const;
export type AvailabilityBasis = (typeof AvailabilityBasis)[keyof typeof AvailabilityBasis];

export interface DerivedAvailability {
  readonly state: AvailabilityState;
  readonly basis: AvailabilityBasis;
}

export function deriveProviderAvailability(input: {
  /** Latest adapter outcome for this provider, or null when no qualification ran. */
  readonly outcome: AdapterOutcome | null;
  /** Evidence classes of this provider's candidate evidence for this search. */
  readonly candidateEvidence: readonly CandidateEvidenceClass[];
}): DerivedAvailability {
  if (input.outcome === 'available') {
    return { state: 'verified_available', basis: 'provider_qualification' };
  }
  if (input.outcome === 'unavailable') {
    return { state: 'verified_unavailable', basis: 'provider_qualification' };
  }
  const strongest = [...input.candidateEvidence].sort(
    (a, b) => EVIDENCE_PRIORITY[a] - EVIDENCE_PRIORITY[b],
  )[0];
  if (strongest !== undefined) {
    return { state: mapCandidateEvidenceToAvailability(strongest), basis: 'candidate_evidence' };
  }
  return { state: 'unknown', basis: 'none' };
}

/**
 * The settled provider-job state an outcome persists as, once the orchestrator decides the job
 * will not be retried (explicit results immediately; transient outcomes after their budget).
 *
 * `unsupported_market` is an explicit, truthful answer from the provider's flow, so the job
 * succeeded even though no offer exists; the availability above still derives from evidence.
 */
export function settledJobStateForOutcome(
  outcome: AdapterOutcome,
): Extract<ProviderJobState, 'succeeded' | 'action_required' | 'degraded'> {
  switch (outcome) {
    case 'available':
    case 'unavailable':
    case 'unsupported_market':
      return 'succeeded';
    case 'address_ambiguous':
    case 'unit_required':
      return 'action_required';
    case 'captcha':
    case 'blocked':
    case 'rate_limited':
    case 'timeout':
    case 'upstream_changed':
    case 'parse_error':
    case 'invalid_response':
    case 'unknown':
      return 'degraded';
  }
}
