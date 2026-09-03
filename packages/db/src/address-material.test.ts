import { randomBytes } from 'node:crypto';

import { syntheticAddress, type ResolvedAddress } from '@isp-search/domain';
import { describe, expect, it } from 'vitest';

import {
  AddressMaterialError,
  openAddressMaterial,
  sealAddressMaterial,
} from './address-material.js';

const key = { version: 1, secretHex: randomBytes(32).toString('hex') };

function resolved(): ResolvedAddress {
  return {
    schemaVersion: 1,
    address: syntheticAddress({ unit: 'Apt 2' }),
    precision: 'subpremise',
    validationState: 'validated',
    scope: { region: 'ZZ', countyFips: null, cbsaGeoid: 'synthetic-zz' },
    coordinates: null,
    resolverId: 'synthetic',
    resolverVersion: '1.0.0',
    resolvedAt: '2026-09-03T00:00:00.000Z',
    restrictions: { storagePermitted: true, permittedUntil: null, coordinatesPermitted: false },
    candidates: [],
    unitOptions: [],
  };
}

describe('address material encryption', () => {
  it('round-trips resolved material and preserves the unit', () => {
    const sealed = sealAddressMaterial({ resolved: resolved() }, key);
    const opened = openAddressMaterial(sealed, 1, key);
    expect(opened.resolved.address.unit).toBe('Apt 2');
  });

  it('produces a different ciphertext per seal (random nonce)', () => {
    const a = sealAddressMaterial({ resolved: resolved() }, key);
    const b = sealAddressMaterial({ resolved: resolved() }, key);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects tampered ciphertext without echoing content', () => {
    const sealed = Buffer.from(sealAddressMaterial({ resolved: resolved() }, key));
    sealed[sealed.length - 1] = sealed[sealed.length - 1]! ^ 0xff;
    let caught: unknown;
    try {
      openAddressMaterial(sealed, 1, key);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AddressMaterialError);
    expect((caught as AddressMaterialError).reason).toBe('undecryptable');
    expect((caught as Error).message).not.toContain('Synthetic');
  });

  it('rejects a key-version mismatch before touching the ciphertext', () => {
    const sealed = sealAddressMaterial({ resolved: resolved() }, key);
    expect(() => openAddressMaterial(sealed, 2, key)).toThrow(/key_version_mismatch/);
  });

  it('rejects the wrong key', () => {
    const sealed = sealAddressMaterial({ resolved: resolved() }, key);
    const other = { version: 1, secretHex: randomBytes(32).toString('hex') };
    expect(() => openAddressMaterial(sealed, 1, other)).toThrow(/undecryptable/);
  });
});
