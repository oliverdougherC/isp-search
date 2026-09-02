import { createHmac, timingSafeEqual } from 'node:crypto';

import { canonicalizeForIdentity, type StructuredAddress } from './address.js';

/**
 * Versioned, keyed HMAC identity for addresses.
 *
 * This is the only permitted derivation of an address cache key. A plaintext hash or an
 * unsalted digest is not a privacy mechanism: the address space is small enough to enumerate.
 * Rotating the key changes every identity, which is intentional; the version prefix lets old
 * cache entries expire naturally instead of colliding.
 *
 * Server-only. The `browser` export condition maps this subpath to a module that throws.
 */
export interface AddressIdentityKey {
  /** Monotonic key version. Included in the identity so rotations never collide. */
  readonly version: number;
  /** Secret key material, at least 32 bytes. Loaded from configuration, never committed. */
  readonly secret: string;
}

export interface AddressIdentity {
  /** Opaque identity string: `v<version>:<hex hmac>`. Safe to log and to use as a cache key. */
  readonly value: string;
  readonly version: number;
}

const MIN_SECRET_LENGTH = 32;

export function assertUsableIdentityKey(key: AddressIdentityKey): void {
  if (!Number.isInteger(key.version) || key.version < 1) {
    throw new Error('address identity key version must be a positive integer');
  }
  if (typeof key.secret !== 'string' || key.secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `address identity secret must be at least ${String(MIN_SECRET_LENGTH)} characters`,
    );
  }
}

export function deriveAddressIdentity(
  address: StructuredAddress,
  key: AddressIdentityKey,
): AddressIdentity {
  assertUsableIdentityKey(key);
  const canonical = canonicalizeForIdentity(address);
  const digest = createHmac('sha256', key.secret)
    .update(`isp-search/address-identity/v${String(key.version)}\n`)
    .update(canonical)
    .digest('hex');
  return { value: `v${String(key.version)}:${digest}`, version: key.version };
}

export function addressIdentityEquals(a: AddressIdentity, b: AddressIdentity): boolean {
  if (a.version !== b.version || a.value.length !== b.value.length) return false;
  return timingSafeEqual(Buffer.from(a.value), Buffer.from(b.value));
}
