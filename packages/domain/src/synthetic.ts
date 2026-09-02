import type { z } from 'zod';

import { StructuredAddress } from './address.js';

/**
 * Synthetic fixture conventions (docs/security/fixture-sanitation.md).
 *
 * Every address in a committed fixture, snapshot, seed, or test MUST satisfy these rules so
 * that the fixture scanner can tell a synthetic address from a real one mechanically:
 *  - the street line contains one of the reserved tokens below;
 *  - the region is the reserved non-state code `ZZ`;
 *  - the postal code starts with `000` (no US ZIP code starts with 000).
 */
export const SYNTHETIC_STREET_TOKENS = ['SYNTHETIC', 'FIXTURE', 'EXAMPLE'] as const;
export const SYNTHETIC_REGION = 'ZZ';
export const SYNTHETIC_POSTAL_PREFIX = '000';
export const SYNTHETIC_CITY = 'Fixtureville';

export function isSyntheticAddress(address: StructuredAddress): boolean {
  const line = address.line1.toUpperCase();
  const hasToken = SYNTHETIC_STREET_TOKENS.some((token) => line.includes(token));
  return (
    hasToken &&
    address.region === SYNTHETIC_REGION &&
    address.postalCode.startsWith(SYNTHETIC_POSTAL_PREFIX)
  );
}

/** A `StructuredAddress` that additionally satisfies the synthetic conventions. */
export const SyntheticAddress = StructuredAddress.refine(isSyntheticAddress, {
  message: 'address does not satisfy the synthetic fixture conventions',
});
export type SyntheticAddress = z.infer<typeof SyntheticAddress>;

export interface SyntheticAddressOptions {
  readonly number?: number;
  readonly unit?: string | null;
  readonly streetToken?: (typeof SYNTHETIC_STREET_TOKENS)[number];
}

/** Deterministic factory for synthetic reference addresses. */
export function syntheticAddress(options: SyntheticAddressOptions = {}): SyntheticAddress {
  const number = options.number ?? 100;
  const token = options.streetToken ?? 'SYNTHETIC';
  const streetWord = token.charAt(0) + token.slice(1).toLowerCase();
  const candidate: StructuredAddress = {
    line1: `${String(number)} ${streetWord} Way`,
    unit: options.unit ?? null,
    city: SYNTHETIC_CITY,
    region: SYNTHETIC_REGION,
    postalCode: `${SYNTHETIC_POSTAL_PREFIX}${String(number % 100).padStart(2, '0')}`,
    country: 'US',
  };
  return SyntheticAddress.parse(candidate);
}
