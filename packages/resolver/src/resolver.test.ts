import { requiredAddressAction } from '@isp-search/domain';
import { describe, expect, it } from 'vitest';

import { ResolverUnavailableError, type ResolverContext } from './contract.js';
import { createSmartyResolver } from './smarty.js';
import { createSyntheticResolver, SYNTHETIC_MDU_UNITS } from './synthetic.js';

const context: ResolverContext = { now: () => new Date('2026-09-03T12:00:00.000Z') };
const resolver = createSyntheticResolver();

const base = {
  line1: '100 Synthetic Way',
  unit: null,
  city: 'Fixtureville',
  region: 'ZZ',
  postalCode: '00000',
} as const;

describe('synthetic resolver', () => {
  it('validates a single-family synthetic address into the synthetic market', async () => {
    const resolved = await resolver.resolve(base, context);
    expect(resolved.validationState).toBe('validated');
    expect(resolved.scope.cbsaGeoid).toBe('synthetic-zz');
    expect(requiredAddressAction(resolved.validationState)).toBeNull();
  });

  it('returns ambiguity candidates and resolves after an explicit selection', async () => {
    const ambiguous = await resolver.resolve({ ...base, line1: '7 Ambiguous Synthetic' }, context);
    expect(ambiguous.validationState).toBe('ambiguous');
    expect(ambiguous.candidates).toHaveLength(2);
    expect(requiredAddressAction(ambiguous.validationState)).toBe('select_candidate');
    const candidateId = ambiguous.candidates[0]?.id;
    if (!candidateId) throw new Error('no candidate id');
    const selected = await resolver.resolve(
      { ...base, line1: '7 Ambiguous Synthetic', selectedCandidateId: candidateId },
      context,
    );
    expect(selected.validationState).toBe('validated');
    expect(selected.address.line1).toBe('7 Ambiguous Synthetic Way');
  });

  it('pauses an MDU without a unit and enumerates the units', async () => {
    const resolved = await resolver.resolve({ ...base, line1: '200 Mdu Synthetic Ave' }, context);
    expect(resolved.validationState).toBe('validated_unit_missing');
    expect(resolved.unitOptions).toEqual([...SYNTHETIC_MDU_UNITS]);
    expect(requiredAddressAction(resolved.validationState)).toBe('provide_unit');
  });

  it('accepts a known unit and preserves an unknown unit as unconfirmed — never dropped', async () => {
    const known = await resolver.resolve(
      { ...base, line1: '200 Mdu Synthetic Ave', unit: 'Unit 4B' },
      context,
    );
    expect(known.validationState).toBe('validated');
    expect(known.precision).toBe('subpremise');
    expect(known.address.unit).toBe('Unit 4B');
    const unknown = await resolver.resolve(
      { ...base, line1: '200 Mdu Synthetic Ave', unit: 'Unit 99' },
      context,
    );
    expect(unknown.validationState).toBe('validated_unit_unconfirmed');
    expect(unknown.address.unit).toBe('Unit 99');
    expect(requiredAddressAction(unknown.validationState)).toBeNull();
  });

  it('maps invalid and not-found inputs to correction actions', async () => {
    const invalid = await resolver.resolve({ ...base, line1: '1 Invalid Synthetic' }, context);
    expect(invalid.validationState).toBe('invalid_input');
    const missing = await resolver.resolve({ ...base, line1: '1 Notfound Synthetic' }, context);
    expect(missing.validationState).toBe('not_found');
    expect(requiredAddressAction(invalid.validationState)).toBe('correct_input');
  });

  it('resolves unsupported-market addresses outside every launch market', async () => {
    const outside = await resolver.resolve(
      { ...base, line1: '5 Unsupported Synthetic Rd' },
      context,
    );
    expect(outside.validationState).toBe('validated');
    expect(outside.scope.cbsaGeoid).toBeNull();
  });

  it('is deterministic', async () => {
    const a = await resolver.resolve(base, context);
    const b = await resolver.resolve(base, context);
    expect(a).toEqual(b);
  });
});

describe('smarty resolver gate', () => {
  it('refuses to run while disabled, before checking anything else', async () => {
    const smarty = createSmartyResolver({
      authId: undefined,
      authToken: undefined,
      enabled: false,
    });
    await expect(smarty.resolve(base, context)).rejects.toMatchObject({ reason: 'disabled' });
  });

  it('refuses to run without credentials even when enabled', async () => {
    const smarty = createSmartyResolver({ authId: undefined, authToken: undefined, enabled: true });
    await expect(smarty.resolve(base, context)).rejects.toBeInstanceOf(ResolverUnavailableError);
    await expect(smarty.resolve(base, context)).rejects.toMatchObject({
      reason: 'not_configured',
    });
  });
});
