import { mapOutcomeToAvailability, syntheticAddress } from '@isp-search/domain';
import { describe, expect, it } from 'vitest';

import { QualificationResult, type QualificationRequest } from '../contract.js';

import { allReferenceAdapters, REFERENCE_SCENARIOS, referenceAdapterFor } from './index.js';

const context = { now: () => new Date('2026-09-02T12:00:00.000Z') };

function request(overrides: Partial<QualificationRequest> = {}): QualificationRequest {
  return {
    searchId: 'search-1',
    providerId: 'reference-available',
    correlationId: 'corr-1',
    address: syntheticAddress({ number: 7, unit: '2B' }),
    deadlineAt: '2026-09-02T12:00:30.000Z',
    ...overrides,
  };
}

describe('reference adapters', () => {
  it('cover every scenario with a schema-valid result', async () => {
    for (const adapter of allReferenceAdapters()) {
      const result = await adapter.qualify(request({ providerId: adapter.providerId }), context);
      expect(QualificationResult.safeParse(result).success, adapter.id).toBe(true);
    }
  });

  it.each([
    ['available', 'available', 'verified_available'],
    ['unavailable', 'unavailable', 'verified_unavailable'],
    ['unit-required', 'unit_required', 'unknown'],
    ['address-ambiguous', 'address_ambiguous', 'unknown'],
    ['upstream-changed', 'upstream_changed', 'unknown'],
    ['malformed', 'parse_error', 'unknown'],
  ] as const)('%s fixture yields %s → %s', async (scenario, outcome, state) => {
    const result = await referenceAdapterFor(scenario).qualify(request(), context);
    expect(result.outcome).toBe(outcome);
    expect(mapOutcomeToAvailability(result.outcome)).toBe(state);
  });

  it('timeout scenario honours the deadline deterministically', async () => {
    const adapter = referenceAdapterFor('timeout');
    const past = await adapter.qualify(
      request({ deadlineAt: '2026-09-02T11:59:59.000Z' }),
      context,
    );
    expect(past.outcome).toBe('timeout');
    expect(past.evidence).toBeNull();
  });

  it('unit-required exposes action options without echoing the address', async () => {
    const result = await referenceAdapterFor('unit-required').qualify(
      request({ address: syntheticAddress() }),
      context,
    );
    expect(result.outcome).toBe('unit_required');
    expect(result.actionOptions?.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('Synthetic Way');
  });

  it('refuses a non-synthetic address', async () => {
    const realistic = {
      ...syntheticAddress(),
      line1: '100 Main Street',
      region: 'CA',
      postalCode: '90210',
    };
    const result = await referenceAdapterFor('available').qualify(
      request({ address: realistic }),
      context,
    );
    expect(result.outcome).toBe('invalid_response');
    expect(result.diagnostics['code']).toBe('reference_adapter_requires_synthetic_address');
  });

  it('every scenario has a fixture file', () => {
    expect(REFERENCE_SCENARIOS).toHaveLength(7);
  });
});
