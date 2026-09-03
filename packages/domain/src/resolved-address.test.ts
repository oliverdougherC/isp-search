import { describe, expect, it } from 'vitest';

import { isApprovedOfficialUrl } from './provider.js';
import {
  formatDisplayAddress,
  requiredAddressAction,
  ResolvedAddress,
} from './resolved-address.js';
import { syntheticAddress } from './synthetic.js';

describe('requiredAddressAction', () => {
  it('maps every validation state to its ADR-002 user action', () => {
    expect(requiredAddressAction('ambiguous')).toBe('select_candidate');
    expect(requiredAddressAction('validated_unit_missing')).toBe('provide_unit');
    expect(requiredAddressAction('not_found')).toBe('correct_input');
    expect(requiredAddressAction('invalid_input')).toBe('correct_input');
    expect(requiredAddressAction('validated')).toBeNull();
    expect(requiredAddressAction('validated_unit_unconfirmed')).toBeNull();
    expect(requiredAddressAction('unsupported')).toBeNull();
  });
});

describe('ResolvedAddress', () => {
  it('parses a synthetic resolution with preserved unit intent', () => {
    const resolved = ResolvedAddress.parse({
      schemaVersion: 1,
      address: syntheticAddress({ unit: 'Unit 4B' }),
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
    });
    expect(resolved.address.unit).toBe('Unit 4B');
  });
});

describe('formatDisplayAddress', () => {
  it('includes the unit only when present', () => {
    expect(formatDisplayAddress(syntheticAddress({ number: 100 }))).toBe(
      '100 Synthetic Way, Fixtureville, ZZ 00000',
    );
    expect(formatDisplayAddress(syntheticAddress({ number: 100, unit: 'Apt 2' }))).toBe(
      '100 Synthetic Way, Apt 2, Fixtureville, ZZ 00000',
    );
  });
});

describe('isApprovedOfficialUrl', () => {
  const approved = ['example.com', 'fcc.gov'];

  it('accepts https URLs on approved hosts and their subdomains', () => {
    expect(isApprovedOfficialUrl('https://example.com/internet', approved)).toBe(true);
    expect(isApprovedOfficialUrl('https://shop.example.com/uas/', approved)).toBe(true);
    expect(isApprovedOfficialUrl('https://broadbandmap.fcc.gov/', approved)).toBe(true);
  });

  it('rejects http, credentials, lookalike hosts, unsafe schemes, and garbage', () => {
    expect(isApprovedOfficialUrl('http://example.com/', approved)).toBe(false);
    expect(isApprovedOfficialUrl('https://user:pw@example.com/', approved)).toBe(false);
    expect(isApprovedOfficialUrl('https://evilexample.com/', approved)).toBe(false);
    expect(isApprovedOfficialUrl('https://example.com.evil.net/', approved)).toBe(false);
    expect(isApprovedOfficialUrl('javascript:alert(1)', approved)).toBe(false);
    expect(isApprovedOfficialUrl('not a url', approved)).toBe(false);
  });
});
