import { z } from 'zod';

import {
  AddressPrecision,
  AddressValidationState,
  StructuredAddress,
  UsRegionCode,
} from './address.js';

/**
 * Application-owned resolver output (ADR-002). Vendor response shapes stay inside the resolver
 * adapter; this is the only address representation the rest of the system sees.
 */

/** Explicit geography used for launch-market membership. Never inferred from ZIP prefixes. */
export const GeographicScope = z
  .object({
    region: UsRegionCode,
    /** 5-digit county FIPS when known. */
    countyFips: z
      .string()
      .regex(/^\d{5}$/)
      .nullable(),
    /** CBSA GEOID when known (or a reserved synthetic market GEOID in tests). */
    cbsaGeoid: z.string().min(1).max(16).nullable(),
  })
  .strict();
export type GeographicScope = z.infer<typeof GeographicScope>;

/** What the application may do with resolver output, carried from vendor terms (ADR-002). */
export const ResolverRestrictions = z
  .object({
    /** Whether normalized output may be stored beyond the search lifetime. */
    storagePermitted: z.boolean(),
    /** Hard expiry imposed by the vendor (e.g. Google's 30 days), if any. */
    permittedUntil: z.iso.datetime().nullable(),
    coordinatesPermitted: z.boolean(),
  })
  .strict();
export type ResolverRestrictions = z.infer<typeof ResolverRestrictions>;

/**
 * A selectable candidate when resolution is ambiguous. `label` is shown to the searching user
 * only (it is their own input's interpretation); it must never appear in logs or URLs.
 */
export const AddressCandidateOption = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(240),
  })
  .strict();
export type AddressCandidateOption = z.infer<typeof AddressCandidateOption>;

/** User actions a resolution can require before provider fan-out (ADR-002 §6). */
export const AddressResolutionAction = z.enum([
  'select_candidate',
  'provide_unit',
  'correct_input',
]);
export type AddressResolutionAction = z.infer<typeof AddressResolutionAction>;

export const ResolvedAddress = z
  .object({
    schemaVersion: z.literal(1),
    /** Canonical structured address; `unit` preserves the user's subpremise intent verbatim. */
    address: StructuredAddress,
    precision: AddressPrecision,
    validationState: AddressValidationState,
    scope: GeographicScope,
    coordinates: z
      .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
      .strict()
      .nullable(),
    resolverId: z.string().min(1).max(64),
    resolverVersion: z.string().min(1).max(32),
    resolvedAt: z.iso.datetime(),
    restrictions: ResolverRestrictions,
    /** Present when `validationState` is `ambiguous`. */
    candidates: z.array(AddressCandidateOption).max(10),
    /** Enumerated units when the resolver knows the building's units. */
    unitOptions: z.array(z.string().min(1).max(40)).max(200),
  })
  .strict();
export type ResolvedAddress = z.infer<typeof ResolvedAddress>;

/**
 * The user action a validation state demands, or `null` when resolution can proceed.
 * `unsupported` and `validated_unit_unconfirmed` require no user action: the first is an
 * explained refusal, the second proceeds with the user's unit preserved (ADR-002 §5).
 */
export function requiredAddressAction(
  state: AddressValidationState,
): AddressResolutionAction | null {
  switch (state) {
    case 'ambiguous':
      return 'select_candidate';
    case 'validated_unit_missing':
      return 'provide_unit';
    case 'not_found':
    case 'invalid_input':
      return 'correct_input';
    case 'validated':
    case 'validated_unit_unconfirmed':
    case 'unsupported':
      return null;
  }
}

/**
 * Display form of the address, for intentional display to the searching user only.
 * This string is still an address: it must never enter logs, URLs, metrics, or errors.
 */
export function formatDisplayAddress(address: StructuredAddress): string {
  const unit = address.unit === null ? '' : `, ${address.unit}`;
  return `${address.line1}${unit}, ${address.city}, ${address.region} ${address.postalCode}`;
}
