import type { ProviderAdapter } from '../contract.js';

import { createReferenceAdapter } from './adapter.js';

/**
 * The deterministic reference adapter matrix (PLA-370). One provider per core scenario, ids
 * matching the synthetic development registry. `reference-link-only` deliberately has NO
 * adapter — it remains a candidate with an official link and no automated verification.
 */
export const REFERENCE_FIXTURE_BY_PROVIDER: Readonly<Record<string, string>> = {
  'reference-available': 'reference/available.json',
  'reference-unavailable': 'reference/unavailable.json',
  'reference-ambiguous': 'reference/address-ambiguous.json',
  'reference-unit-required': 'reference/unit-required.json',
  'reference-timeout': 'reference/timeout.json',
  'reference-rate-limited': 'reference/rate-limited.json',
  'reference-blocked': 'reference/blocked.json',
  'reference-malformed': 'reference/malformed.json',
  'reference-slow': 'reference/slow.json',
  'reference-conflicting': 'reference/conflicting.json',
  'reference-late': 'reference/late.json',
};

/** Every registered reference adapter, ready for the worker's adapter registry. */
export function referenceAdapterSet(): ProviderAdapter[] {
  return Object.entries(REFERENCE_FIXTURE_BY_PROVIDER).map(([providerId, fixturePath]) =>
    createReferenceAdapter({ providerId, fixturePath }),
  );
}

/** Fixture-name based scenario access, used by contract tests. */
export const REFERENCE_SCENARIOS = [
  'available',
  'unavailable',
  'unit-required',
  'address-ambiguous',
  'timeout',
  'upstream-changed',
  'malformed',
  'blocked',
  'captcha',
  'rate-limited',
  'slow',
  'conflicting',
  'late',
] as const;
export type ReferenceScenario = (typeof REFERENCE_SCENARIOS)[number];

export function referenceAdapterFor(scenario: ReferenceScenario): ProviderAdapter {
  return createReferenceAdapter({
    providerId: `reference-${scenario}`,
    fixturePath: `reference/${scenario}.json`,
  });
}

export function allReferenceAdapters(): readonly ProviderAdapter[] {
  return REFERENCE_SCENARIOS.map(referenceAdapterFor);
}

export {
  createReferenceAdapter,
  REFERENCE_ADAPTER_VERSION,
  REFERENCE_PARSER_VERSION,
} from './adapter.js';
