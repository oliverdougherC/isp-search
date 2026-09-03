import { randomBytes } from 'node:crypto';

import {
  formatDisplayAddress,
  requiredAddressAction,
  type ResolvedAddress,
  type SearchState,
} from '@isp-search/domain';
import {
  deriveAddressIdentity,
  type AddressIdentityKey,
} from '@isp-search/domain/address-identity';
import { eq } from 'drizzle-orm';

import { sealAddressMaterial, type RawAddressKey } from './address-material.js';
import type { Database } from './client.js';
import { searchAddressMaterial, searches, type SearchRow } from './schema/index.js';

/**
 * Privacy-safe search sessions (PLA-362).
 *
 * The raw address enters only through here: it is HMAC'd for cache identity, encrypted for the
 * worker, rendered once into the display tier, and never logged. Search ids carry 256 bits of
 * entropy, so possession of the id is the read capability (no enumeration).
 */

export function newSearchId(): string {
  return randomBytes(32).toString('base64url');
}

export interface SessionPolicy {
  readonly hmacKey: AddressIdentityKey;
  readonly rawAddressKey: RawAddressKey;
  readonly rawAddressTtlMinutes: number;
  readonly searchTtlMinutes: number;
  readonly deadlineSeconds: number;
  readonly consentVersion: string;
}

export interface CreateSearchSessionInput {
  readonly resolved: ResolvedAddress;
  readonly policy: SessionPolicy;
  readonly now: Date;
}

export interface CreatedSearchSession {
  readonly searchId: string;
  readonly state: SearchState;
  readonly deadlineAt: Date;
  readonly expiresAt: Date;
}

/**
 * Persists a new search session inside the caller's transaction: the search row (display tier)
 * plus the encrypted address material (raw tier). Candidate/job creation is the orchestrator's
 * step (PLA-367) inside the same transaction.
 */
export async function createSearchSession(
  tx: Database,
  input: CreateSearchSessionInput,
): Promise<CreatedSearchSession> {
  const { resolved, policy, now } = input;
  const searchId = newSearchId();
  const action = requiredAddressAction(resolved.validationState);
  const state: SearchState =
    action !== null ? 'address_action_required' : ('resolving_address' as const);
  const identity = deriveAddressIdentity(resolved.address, policy.hmacKey);
  const deadlineAt = new Date(now.getTime() + policy.deadlineSeconds * 1000);
  const expiresAt = new Date(now.getTime() + policy.searchTtlMinutes * 60_000);
  const rawExpiresAt = new Date(now.getTime() + policy.rawAddressTtlMinutes * 60_000);

  await tx.insert(searches).values({
    id: searchId,
    state,
    addressIdentity: identity.value,
    addressIdentityVersion: identity.version,
    displayAddress: formatDisplayAddress(resolved.address),
    addressCandidates: resolved.candidates,
    unitOptions: resolved.unitOptions,
    requiredAction: action,
    resolverId: resolved.resolverId,
    resolverVersion: resolved.resolverVersion,
    validationState: resolved.validationState,
    addressPrecision: resolved.precision,
    consentVersion: policy.consentVersion,
    deadlineAt,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(searchAddressMaterial).values({
    searchId,
    ciphertext: sealAddressMaterial({ resolved }, policy.rawAddressKey),
    keyVersion: policy.rawAddressKey.version,
    createdAt: now,
    expiresAt: rawExpiresAt,
  });
  return { searchId, state, deadlineAt, expiresAt };
}

export async function getSearch(db: Database, searchId: string): Promise<SearchRow | undefined> {
  const [row] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  return row;
}

/** Whether a search row should be served as expired (state machine aside, `expiresAt` rules). */
export function isSearchExpired(row: Pick<SearchRow, 'expiresAt' | 'state'>, now: Date): boolean {
  return row.state === 'expired' || row.expiresAt.getTime() <= now.getTime();
}
