import { describe, expect, it } from 'vitest';

import { addressIdentityEquals, deriveAddressIdentity } from './address-identity.js';
import { syntheticAddress } from './synthetic.js';

const key = { version: 1, secret: 'test-secret-that-is-at-least-32-characters-long' };

describe('deriveAddressIdentity', () => {
  it('is deterministic and versioned', () => {
    const a = deriveAddressIdentity(syntheticAddress({ number: 7 }), key);
    const b = deriveAddressIdentity(syntheticAddress({ number: 7 }), key);
    expect(a.value).toBe(b.value);
    expect(a.value).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(addressIdentityEquals(a, b)).toBe(true);
  });

  it('separates units of the same building', () => {
    const a = deriveAddressIdentity(syntheticAddress({ number: 7, unit: '1A' }), key);
    const b = deriveAddressIdentity(syntheticAddress({ number: 7, unit: '1B' }), key);
    const c = deriveAddressIdentity(syntheticAddress({ number: 7, unit: null }), key);
    expect(new Set([a.value, b.value, c.value]).size).toBe(3);
  });

  it('normalizes case, punctuation, and whitespace before hashing', () => {
    const base = syntheticAddress({ number: 7, unit: 'Apt 2' });
    const messy = { ...base, line1: `  ${base.line1.toLowerCase()}. `, unit: 'APT   2' };
    expect(deriveAddressIdentity(messy, key).value).toBe(deriveAddressIdentity(base, key).value);
  });

  it('changes with key version and secret', () => {
    const a = deriveAddressIdentity(syntheticAddress(), key);
    const b = deriveAddressIdentity(syntheticAddress(), { ...key, version: 2 });
    const c = deriveAddressIdentity(syntheticAddress(), {
      ...key,
      secret: 'another-secret-that-is-at-least-32-characters-long',
    });
    expect(a.value).not.toBe(b.value);
    expect(a.value).not.toBe(c.value);
    expect(addressIdentityEquals(a, b)).toBe(false);
  });

  it('rejects weak keys', () => {
    expect(() =>
      deriveAddressIdentity(syntheticAddress(), { version: 1, secret: 'short' }),
    ).toThrow(/at least 32/);
    expect(() =>
      deriveAddressIdentity(syntheticAddress(), { version: 0, secret: key.secret }),
    ).toThrow(/positive integer/);
  });

  it('never embeds the canonical address in the identity', () => {
    const address = syntheticAddress({ number: 42, unit: '9Z' });
    const identity = deriveAddressIdentity(address, key);
    expect(identity.value.toUpperCase()).not.toContain('SYNTHETIC');
    expect(identity.value).not.toContain('42');
  });
});
