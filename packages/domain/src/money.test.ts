import { describe, expect, it } from 'vitest';

import { ContractTerm, DataAllowance, knownMoney, Money, Speed, unknownMoney } from './money.js';

describe('Money and Speed', () => {
  it('represents unknown amounts without inventing zeros', () => {
    const unknown = Money.parse({ kind: 'unknown', reason: 'not_disclosed' });
    expect(unknown.kind).toBe('unknown');
    // @ts-expect-error unknown money has no amount to read accidentally
    expect(unknown.amountCents).toBeUndefined();
  });

  it('rejects an amount on an unknown value and a missing amount on a known one', () => {
    expect(Money.safeParse({ kind: 'unknown', amountCents: 0 }).success).toBe(false);
    expect(Money.safeParse({ kind: 'known', currency: 'USD' }).success).toBe(false);
  });

  it('allows negative cents only as explicit known values (credits)', () => {
    expect(knownMoney(-1000)).toEqual({ kind: 'known', amountCents: -1000, currency: 'USD' });
  });

  it('rejects zero and negative speeds', () => {
    expect(Speed.safeParse({ kind: 'known', mbps: 0, basis: 'advertised' }).success).toBe(false);
    expect(Speed.safeParse({ kind: 'known', mbps: -5, basis: 'typical' }).success).toBe(false);
  });

  it('data allowance and contract keep unknown representable', () => {
    expect(DataAllowance.parse({ kind: 'unknown', reason: 'source_incomplete' }).kind).toBe(
      'unknown',
    );
    expect(
      ContractTerm.parse({
        kind: 'term',
        months: 12,
        earlyTerminationFee: unknownMoney('not_disclosed'),
      }).kind,
    ).toBe('term');
  });
});
