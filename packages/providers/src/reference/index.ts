import type { ProviderAdapter } from '../contract.js';

import { createReferenceAdapter } from './adapter.js';

/** The reference adapter set: one per core outcome the search core must handle. */
export const REFERENCE_SCENARIOS = [
  'available',
  'unavailable',
  'unit-required',
  'address-ambiguous',
  'timeout',
  'upstream-changed',
  'malformed',
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
