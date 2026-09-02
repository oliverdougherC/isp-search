import { describe, expect, it } from 'vitest';

import {
  AdapterOutcome,
  classifyRetry,
  mapCandidateEvidenceToAvailability,
  mapOutcomeToAvailability,
} from './availability.js';

describe('mapOutcomeToAvailability', () => {
  it('only an explicit provider unavailable outcome yields verified_unavailable', () => {
    const unavailable = AdapterOutcome.options.filter(
      (outcome) => mapOutcomeToAvailability(outcome) === 'verified_unavailable',
    );
    expect(unavailable).toEqual(['unavailable']);
  });

  it('only an explicit provider available outcome yields verified_available', () => {
    const available = AdapterOutcome.options.filter(
      (outcome) => mapOutcomeToAvailability(outcome) === 'verified_available',
    );
    expect(available).toEqual(['available']);
  });

  it('every failure, block, ambiguity, or unsupported case yields unknown', () => {
    const failures: AdapterOutcome[] = [
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
    ];
    for (const outcome of failures) {
      expect(mapOutcomeToAvailability(outcome), outcome).toBe('unknown');
    }
  });

  it('candidate evidence can never produce a verified state', () => {
    const states = (
      [
        'provider_label',
        'location_level_licensed',
        'area_level_reported',
        'official_generic_page',
      ] as const
    ).map(mapCandidateEvidenceToAvailability);
    expect(states).not.toContain('verified_available');
    expect(states).not.toContain('verified_unavailable');
    expect(mapCandidateEvidenceToAvailability('location_level_licensed')).toBe(
      'reported_available',
    );
    expect(mapCandidateEvidenceToAvailability('area_level_reported')).toBe('likely_available');
  });
});

describe('classifyRetry', () => {
  it('never retries explicit provider results or user actions', () => {
    for (const outcome of [
      'available',
      'unavailable',
      'address_ambiguous',
      'unit_required',
    ] as const) {
      expect(classifyRetry(outcome)).toBe('none');
    }
  });
  it('retries transient network conditions', () => {
    expect(classifyRetry('timeout')).toBe('transient');
    expect(classifyRetry('rate_limited')).toBe('transient');
  });
  it('treats blocks, captcha, and parser drift as maintenance signals, not retries', () => {
    for (const outcome of ['captcha', 'blocked', 'upstream_changed', 'parse_error'] as const) {
      expect(classifyRetry(outcome)).toBe('maintenance');
    }
  });
});
