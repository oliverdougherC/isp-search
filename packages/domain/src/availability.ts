import { z } from 'zod';

/**
 * User-facing availability states. These are the only states the product may display.
 * See docs/adr/ADR-005-truth-and-confidence-model.md.
 */
export const AvailabilityState = z.enum([
  'verified_available',
  'verified_unavailable',
  'reported_available',
  'likely_available',
  'unknown',
]);
export type AvailabilityState = z.infer<typeof AvailabilityState>;

/**
 * Typed execution outcomes an adapter may return. Adapters cannot invent UI semantics;
 * the centralized mapping in `mapOutcomeToAvailability` converts outcomes into states.
 */
export const AdapterOutcome = z.enum([
  'available',
  'unavailable',
  'address_ambiguous',
  'unit_required',
  'unsupported_market',
  'captcha',
  'blocked',
  'rate_limited',
  'timeout',
  'upstream_changed',
  'parse_error',
  'invalid_response',
  'unknown',
]);
export type AdapterOutcome = z.infer<typeof AdapterOutcome>;

/**
 * Evidence classes ordered by priority (1 = strongest). Higher priority evidence never erases
 * disagreement; contradictions are retained and displayed.
 */
export const EvidenceClass = z.enum([
  'provider_qualification',
  'provider_label',
  'location_level_licensed',
  'area_level_reported',
  'official_generic_page',
]);
export type EvidenceClass = z.infer<typeof EvidenceClass>;

export const EVIDENCE_PRIORITY: Readonly<Record<EvidenceClass, number>> = {
  provider_qualification: 1,
  provider_label: 2,
  location_level_licensed: 3,
  area_level_reported: 4,
  official_generic_page: 5,
};

/**
 * Centralized outcome-to-state mapping.
 *
 * Invariants (tested):
 * - Only an explicit provider `unavailable` outcome yields `verified_unavailable`.
 * - Only an explicit provider `available` outcome yields `verified_available`.
 * - Every failure, block, timeout, ambiguity, or unsupported case yields `unknown`.
 * - Area-level evidence can never produce a verified state (it is not an adapter outcome).
 */
export function mapOutcomeToAvailability(outcome: AdapterOutcome): AvailabilityState {
  switch (outcome) {
    case 'available':
      return 'verified_available';
    case 'unavailable':
      return 'verified_unavailable';
    case 'address_ambiguous':
    case 'unit_required':
    case 'unsupported_market':
    case 'captcha':
    case 'blocked':
    case 'rate_limited':
    case 'timeout':
    case 'upstream_changed':
    case 'parse_error':
    case 'invalid_response':
    case 'unknown':
      return 'unknown';
  }
}

/**
 * Candidate evidence (without a provider qualification) maps to at most `reported_available`
 * or `likely_available`. It can never produce a verified state.
 */
export function mapCandidateEvidenceToAvailability(
  evidence: Exclude<EvidenceClass, 'provider_qualification'>,
): Extract<AvailabilityState, 'reported_available' | 'likely_available' | 'unknown'> {
  switch (evidence) {
    case 'location_level_licensed':
      return 'reported_available';
    case 'provider_label':
    case 'area_level_reported':
    case 'official_generic_page':
      return 'likely_available';
  }
}

/** Outcomes that must never be retried automatically because retrying cannot change them. */
export const TERMINAL_OUTCOMES: ReadonlySet<AdapterOutcome> = new Set<AdapterOutcome>([
  'available',
  'unavailable',
  'address_ambiguous',
  'unit_required',
  'unsupported_market',
]);

/** Outcomes that may be retried with backoff, bounded by the retry budget. */
export const TRANSIENT_OUTCOMES: ReadonlySet<AdapterOutcome> = new Set<AdapterOutcome>([
  'rate_limited',
  'timeout',
]);

export type RetryClass = 'none' | 'transient' | 'maintenance';

/** Classifies an outcome for the job runner. `maintenance` means: do not retry, open a signal. */
export function classifyRetry(outcome: AdapterOutcome): RetryClass {
  if (TERMINAL_OUTCOMES.has(outcome)) return 'none';
  if (TRANSIENT_OUTCOMES.has(outcome)) return 'transient';
  return 'maintenance';
}
