import { describe, expect, it } from 'vitest';

import { AdapterOutcome } from './availability.js';
import { deriveProviderAvailability, settledJobStateForOutcome } from './truth.js';

const FAILURE_OUTCOMES = [
  'timeout',
  'captcha',
  'blocked',
  'rate_limited',
  'parse_error',
  'invalid_response',
  'upstream_changed',
  'unknown',
  'unsupported_market',
] as const;

describe('deriveProviderAvailability — non-negotiable truth invariants', () => {
  it('timeout cannot become unavailable', () => {
    const derived = deriveProviderAvailability({ outcome: 'timeout', candidateEvidence: [] });
    expect(derived.state).not.toBe('verified_unavailable');
    expect(derived.state).toBe('unknown');
  });

  it('captcha cannot become unavailable', () => {
    const derived = deriveProviderAvailability({ outcome: 'captcha', candidateEvidence: [] });
    expect(derived.state).toBe('unknown');
  });

  it('blocked cannot become unavailable', () => {
    const derived = deriveProviderAvailability({ outcome: 'blocked', candidateEvidence: [] });
    expect(derived.state).toBe('unknown');
  });

  it('parser failure cannot become unavailable', () => {
    for (const outcome of ['parse_error', 'invalid_response', 'upstream_changed'] as const) {
      const derived = deriveProviderAvailability({ outcome, candidateEvidence: [] });
      expect(derived.state, outcome).toBe('unknown');
    }
  });

  it('missing candidate evidence cannot become unavailable', () => {
    const derived = deriveProviderAvailability({ outcome: null, candidateEvidence: [] });
    expect(derived).toEqual({ state: 'unknown', basis: 'none' });
  });

  it('no failure outcome, with or without evidence, produces a verified state', () => {
    for (const outcome of FAILURE_OUTCOMES) {
      for (const evidence of [[], ['area_level_reported' as const]]) {
        const derived = deriveProviderAvailability({ outcome, candidateEvidence: evidence });
        expect(derived.state, `${outcome} + ${String(evidence)}`).not.toBe('verified_available');
        expect(derived.state, `${outcome} + ${String(evidence)}`).not.toBe('verified_unavailable');
      }
    }
  });

  it('generic label or catalog evidence cannot become address availability', () => {
    const derived = deriveProviderAvailability({
      outcome: null,
      candidateEvidence: ['provider_label', 'official_generic_page'],
    });
    expect(derived).toEqual({ state: 'likely_available', basis: 'candidate_evidence' });
  });

  it('exact explicit provider unavailable becomes verified unavailable', () => {
    const derived = deriveProviderAvailability({
      outcome: 'unavailable',
      candidateEvidence: ['area_level_reported'],
    });
    expect(derived).toEqual({ state: 'verified_unavailable', basis: 'provider_qualification' });
  });

  it('exact explicit provider available becomes verified available', () => {
    const derived = deriveProviderAvailability({ outcome: 'available', candidateEvidence: [] });
    expect(derived).toEqual({ state: 'verified_available', basis: 'provider_qualification' });
  });

  it('area and registry evidence stays likely; licensed location data stays reported', () => {
    expect(
      deriveProviderAvailability({ outcome: null, candidateEvidence: ['area_level_reported'] })
        .state,
    ).toBe('likely_available');
    expect(
      deriveProviderAvailability({
        outcome: null,
        candidateEvidence: ['location_level_licensed', 'area_level_reported'],
      }).state,
    ).toBe('reported_available');
  });

  it('a provider needing user action stays action-worthy, never unavailable', () => {
    for (const outcome of ['unit_required', 'address_ambiguous'] as const) {
      const derived = deriveProviderAvailability({
        outcome,
        candidateEvidence: ['area_level_reported'],
      });
      expect(derived.state, outcome).toBe('likely_available');
      expect(settledJobStateForOutcome(outcome)).toBe('action_required');
    }
  });
});

describe('settledJobStateForOutcome', () => {
  it('covers every adapter outcome with a settled provider-job state', () => {
    for (const outcome of AdapterOutcome.options) {
      const state = settledJobStateForOutcome(outcome);
      expect(['succeeded', 'action_required', 'degraded']).toContain(state);
    }
  });

  it('explicit answers succeed; failures degrade', () => {
    expect(settledJobStateForOutcome('available')).toBe('succeeded');
    expect(settledJobStateForOutcome('unavailable')).toBe('succeeded');
    expect(settledJobStateForOutcome('unsupported_market')).toBe('succeeded');
    for (const outcome of ['timeout', 'captcha', 'blocked', 'parse_error', 'unknown'] as const) {
      expect(settledJobStateForOutcome(outcome), outcome).toBe('degraded');
    }
  });
});
