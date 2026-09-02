import { z } from 'zod';

/** Two-letter US state or territory codes plus the reserved synthetic code `ZZ` used by fixtures. */
export const UsRegionCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'region code must be two uppercase letters');

/**
 * Structured address as owned by the application. Vendor-specific shapes are converted into
 * this at the resolver boundary and never leak further.
 *
 * `unit` is an application-owned field. It is preserved from user input even when a resolver
 * omits or rewrites it (ADR-002).
 */
export const StructuredAddress = z
  .object({
    line1: z.string().min(1).max(200),
    unit: z.string().min(1).max(40).nullable(),
    city: z.string().min(1).max(100),
    region: UsRegionCode,
    postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'postal code must be 5 or 9 digits'),
    country: z.literal('US'),
  })
  .strict();
export type StructuredAddress = z.infer<typeof StructuredAddress>;

export const AddressPrecision = z.enum([
  'subpremise',
  'premise',
  'range_interpolated',
  'street',
  'postal_code',
  'locality',
  'unknown',
]);
export type AddressPrecision = z.infer<typeof AddressPrecision>;

export const AddressValidationState = z.enum([
  'validated',
  'validated_unit_missing',
  'validated_unit_unconfirmed',
  'ambiguous',
  'not_found',
  'invalid_input',
  'unsupported',
]);
export type AddressValidationState = z.infer<typeof AddressValidationState>;

/**
 * Canonical string used only as HMAC input for cache identity. It is deterministic, case- and
 * whitespace-normalized, and includes the unit so that two units of one building never share
 * a cache identity. It is never logged or stored in plaintext.
 */
export function canonicalizeForIdentity(address: StructuredAddress): string {
  const norm = (value: string | null): string =>
    (value ?? '')
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[.,#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return [
    norm(address.line1),
    norm(address.unit),
    norm(address.city),
    address.region,
    address.postalCode.slice(0, 5),
    address.country,
  ].join('|');
}
