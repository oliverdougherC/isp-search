import { describe, expect, it } from 'vitest';

import { StructuredAddress } from './address.js';
import { isSyntheticAddress, SyntheticAddress, syntheticAddress } from './synthetic.js';

describe('synthetic address conventions', () => {
  it('factory output satisfies the conventions', () => {
    const address = syntheticAddress({ number: 12, unit: '3B' });
    expect(isSyntheticAddress(address)).toBe(true);
    expect(address.region).toBe('ZZ');
    expect(address.postalCode.startsWith('000')).toBe(true);
    expect(address.line1.toUpperCase()).toContain('SYNTHETIC');
  });

  it('rejects a realistic-looking address even if otherwise valid', () => {
    const realistic: StructuredAddress = StructuredAddress.parse({
      line1: '100 Main Street',
      unit: null,
      city: 'Fixtureville',
      region: 'ZZ',
      postalCode: '00001',
      country: 'US',
    });
    expect(isSyntheticAddress(realistic)).toBe(false);
    expect(SyntheticAddress.safeParse(realistic).success).toBe(false);
  });

  it('rejects a real region or postal prefix', () => {
    const base = syntheticAddress();
    expect(isSyntheticAddress({ ...base, region: 'CA' })).toBe(false);
    expect(isSyntheticAddress({ ...base, postalCode: '90210' })).toBe(false);
  });
});
