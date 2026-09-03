import type {
  AddressValidationState,
  ResolvedAddress,
  StructuredAddress,
} from '@isp-search/domain';

import { ResolveInput, type AddressResolver, type ResolverContext } from './contract.js';

/**
 * Deterministic development/test resolver (PLA-363). Behavior is driven entirely by reserved
 * tokens in the street line, so every address/unit workflow (PLA-364) can be exercised with no
 * network and no vendor:
 *
 *   AMBIGUOUS  -> two candidates ("Way"/"Court"); resolves after `selectedCandidateId`
 *   MDU        -> building with enumerated units; missing unit pauses, unknown unit proceeds
 *                 as `validated_unit_unconfirmed` (the user's unit always wins, ADR-002)
 *   INVALID    -> invalid_input        NOTFOUND -> not_found
 *   UNSUPPORTED-> resolves outside every launch market (unsupported-market flow)
 *
 * Anything else resolves as validated. Synthetic-region (ZZ) addresses map to the synthetic
 * launch market; other regions resolve with no CBSA/county, which discovery treats as
 * unsupported. No input is ever sent anywhere.
 */

export const SYNTHETIC_RESOLVER_ID = 'synthetic';
export const SYNTHETIC_RESOLVER_VERSION = '1.0.0';

export const SYNTHETIC_MDU_UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4B'] as const;

const CANDIDATE_SUFFIXES: Readonly<Record<string, string>> = {
  way: 'Way',
  court: 'Court',
};

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export function createSyntheticResolver(): AddressResolver {
  return {
    id: SYNTHETIC_RESOLVER_ID,
    version: SYNTHETIC_RESOLVER_VERSION,
    resolve(rawInput: ResolveInput, context: ResolverContext): Promise<ResolvedAddress> {
      const input = ResolveInput.parse(rawInput);
      const upper = input.line1.toUpperCase();
      const now = context.now();

      let line1 = normalizeLine(input.line1);
      let validationState: AddressValidationState = 'validated';
      let candidates: { id: string; label: string }[] = [];
      let unitOptions: string[] = [];

      if (upper.includes('INVALID')) {
        validationState = 'invalid_input';
      } else if (upper.includes('NOTFOUND')) {
        validationState = 'not_found';
      } else if (upper.includes('AMBIGUOUS')) {
        const chosen = input.selectedCandidateId
          ? CANDIDATE_SUFFIXES[input.selectedCandidateId]
          : undefined;
        if (chosen === undefined) {
          validationState = 'ambiguous';
          candidates = Object.entries(CANDIDATE_SUFFIXES).map(([id, suffix]) => ({
            id,
            label: `${line1} ${suffix}, ${input.city}, ${input.region} ${input.postalCode}`,
          }));
        } else {
          line1 = `${line1} ${chosen}`;
        }
      }

      const isMdu = upper.includes('MDU');
      if (validationState === 'validated' && isMdu) {
        unitOptions = [...SYNTHETIC_MDU_UNITS];
        if (input.unit === null) {
          validationState = 'validated_unit_missing';
        } else if (!SYNTHETIC_MDU_UNITS.some((unit) => unit === input.unit)) {
          validationState = 'validated_unit_unconfirmed';
        }
      }

      const address: StructuredAddress = {
        line1,
        unit: input.unit,
        city: normalizeLine(input.city),
        region: input.region,
        postalCode: input.postalCode,
        country: 'US',
      };

      const inSyntheticMarket = input.region === 'ZZ' && !upper.includes('UNSUPPORTED');

      const resolved: ResolvedAddress = {
        schemaVersion: 1,
        address,
        precision:
          validationState === 'validated' && input.unit !== null
            ? 'subpremise'
            : validationState === 'not_found' || validationState === 'invalid_input'
              ? 'unknown'
              : 'premise',
        validationState,
        scope: {
          region: input.region,
          countyFips: null,
          cbsaGeoid: inSyntheticMarket ? 'synthetic-zz' : null,
        },
        coordinates: null,
        resolverId: SYNTHETIC_RESOLVER_ID,
        resolverVersion: SYNTHETIC_RESOLVER_VERSION,
        resolvedAt: now.toISOString(),
        restrictions: { storagePermitted: true, permittedUntil: null, coordinatesPermitted: false },
        candidates,
        unitOptions,
      };
      return Promise.resolve(resolved);
    },
  };
}
