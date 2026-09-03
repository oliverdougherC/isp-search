import {
  assertTransition,
  formatDisplayAddress,
  requiredAddressAction,
  type ResolvedAddress,
  type SearchState,
} from '@isp-search/domain';
import { deriveAddressIdentity } from '@isp-search/domain/address-identity';
import { eq } from 'drizzle-orm';

import { openAddressMaterial, sealAddressMaterial } from './address-material.js';
import type { DatabaseHandle } from './client.js';
import { searchAddressMaterial, searches } from './schema/index.js';
import { isSearchExpired, type SessionPolicy } from './sessions.js';

/**
 * Address-level user actions (PLA-364): selecting an ambiguity candidate, supplying a unit,
 * or correcting the input. Actions are epoch-guarded — every state change bumps
 * `action_epoch`, and a submission must cite the epoch it saw, so stale or repeated
 * submissions are rejected instead of racing.
 */

export type AddressActionInput =
  | { readonly type: 'select_candidate'; readonly candidateId: string; readonly epoch: number }
  | { readonly type: 'provide_unit'; readonly unit: string; readonly epoch: number }
  | {
      readonly type: 'correct_input';
      readonly line1: string;
      readonly unit: string | null;
      readonly city: string;
      readonly region: string;
      readonly postalCode: string;
      readonly epoch: number;
    };

export type SearchActionFailure =
  'not_found' | 'expired' | 'action_not_allowed' | 'conflict' | 'invalid_action';

export class SearchActionError extends Error {
  override readonly name = 'SearchActionError';
  readonly code: SearchActionFailure;
  constructor(code: SearchActionFailure) {
    super(`address action rejected: ${code}`);
    this.code = code;
  }
}

/** What the caller (the resolver wiring in the web app) must supply. */
export interface AddressActionDeps {
  readonly policy: SessionPolicy;
  readonly now: Date;
  readonly resolve: (input: {
    line1: string;
    unit: string | null;
    city: string;
    region: string;
    postalCode: string;
    selectedCandidateId?: string;
  }) => Promise<ResolvedAddress>;
}

export interface AddressActionResult {
  readonly state: SearchState;
  readonly requiredAction: string | null;
  readonly actionEpoch: number;
}

const ACTION_FOR_TYPE: Readonly<Record<AddressActionInput['type'], string>> = {
  select_candidate: 'select_candidate',
  provide_unit: 'provide_unit',
  correct_input: 'correct_input',
};

export async function applyAddressAction(
  handle: DatabaseHandle,
  searchId: string,
  action: AddressActionInput,
  deps: AddressActionDeps,
): Promise<AddressActionResult> {
  return handle.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(searches)
      .where(eq(searches.id, searchId))
      .for('update')
      .limit(1);
    if (!row) throw new SearchActionError('not_found');
    if (isSearchExpired(row, deps.now)) throw new SearchActionError('expired');
    if (row.state !== 'address_action_required') throw new SearchActionError('action_not_allowed');
    if (row.requiredAction !== ACTION_FOR_TYPE[action.type]) {
      throw new SearchActionError('action_not_allowed');
    }
    if (action.epoch !== row.actionEpoch) throw new SearchActionError('conflict');
    if (
      action.type === 'select_candidate' &&
      !(row.addressCandidates ?? []).some((candidate) => candidate.id === action.candidateId)
    ) {
      throw new SearchActionError('invalid_action');
    }

    const [material] = await tx
      .select()
      .from(searchAddressMaterial)
      .where(eq(searchAddressMaterial.searchId, searchId))
      .limit(1);
    // The raw material is required to re-resolve; if retention already removed it, the
    // search can only be restarted.
    if (!material) throw new SearchActionError('expired');
    const opened = openAddressMaterial(
      material.ciphertext,
      material.keyVersion,
      deps.policy.rawAddressKey,
    );
    const previous = opened.resolved.address;

    const resolveInput =
      action.type === 'select_candidate'
        ? {
            line1: previous.line1,
            unit: previous.unit,
            city: previous.city,
            region: previous.region,
            postalCode: previous.postalCode,
            selectedCandidateId: action.candidateId,
          }
        : action.type === 'provide_unit'
          ? {
              line1: previous.line1,
              unit: action.unit,
              city: previous.city,
              region: previous.region,
              postalCode: previous.postalCode,
            }
          : {
              line1: action.line1,
              unit: action.unit,
              city: action.city,
              region: action.region,
              postalCode: action.postalCode,
            };

    const resolved = await deps.resolve(resolveInput);
    const nextAction = requiredAddressAction(resolved.validationState);
    const nextState: SearchState =
      nextAction !== null
        ? 'address_action_required'
        : assertTransition(row.state, 'resolving_address');
    const identity = deriveAddressIdentity(resolved.address, deps.policy.hmacKey);
    const nextEpoch = row.actionEpoch + 1;

    await tx
      .update(searches)
      .set({
        state: nextState,
        addressIdentity: identity.value,
        addressIdentityVersion: identity.version,
        displayAddress: formatDisplayAddress(resolved.address),
        addressCandidates: resolved.candidates,
        unitOptions: resolved.unitOptions,
        requiredAction: nextAction,
        actionEpoch: nextEpoch,
        resolverId: resolved.resolverId,
        resolverVersion: resolved.resolverVersion,
        validationState: resolved.validationState,
        addressPrecision: resolved.precision,
        updatedAt: deps.now,
      })
      .where(eq(searches.id, searchId));
    // Re-seal with the new resolution; the raw-address TTL is deliberately NOT extended.
    await tx
      .update(searchAddressMaterial)
      .set({
        ciphertext: sealAddressMaterial({ resolved }, deps.policy.rawAddressKey),
        keyVersion: deps.policy.rawAddressKey.version,
      })
      .where(eq(searchAddressMaterial.searchId, searchId));

    return { state: nextState, requiredAction: nextAction, actionEpoch: nextEpoch };
  });
}
