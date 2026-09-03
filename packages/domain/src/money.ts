import { z } from 'zod';

/**
 * Monetary and speed values that keep "we do not know" representable.
 *
 * A missing price is never zero and a missing speed is never made up (PLA-360). Every consumer
 * must branch on `kind` before using a numeric value, which makes silently treating unknown
 * data as a number a type error.
 */

export const UnknownReason = z.enum([
  'not_disclosed',
  'varies_by_location',
  'requires_contact',
  'not_applicable',
  'source_incomplete',
]);
export type UnknownReason = z.infer<typeof UnknownReason>;

export const Money = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('known'),
      /** Integer cents. May be negative only for credits/discounts. */
      amountCents: z.number().int(),
      currency: z.literal('USD'),
    })
    .strict(),
  z.object({ kind: z.literal('unknown'), reason: UnknownReason }).strict(),
]);
export type Money = z.infer<typeof Money>;

export function knownMoney(amountCents: number): Money {
  return { kind: 'known', amountCents, currency: 'USD' };
}

export function unknownMoney(reason: UnknownReason = 'not_disclosed'): Money {
  return { kind: 'unknown', reason };
}

/** Whether a speed figure is a marketing number or a measured/typical disclosure. */
export const SpeedBasis = z.enum(['advertised', 'typical']);
export type SpeedBasis = z.infer<typeof SpeedBasis>;

export const Speed = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('known'),
      mbps: z.number().positive(),
      basis: SpeedBasis,
    })
    .strict(),
  z.object({ kind: z.literal('unknown'), reason: UnknownReason }).strict(),
]);
export type Speed = z.infer<typeof Speed>;

export function knownSpeed(mbps: number, basis: SpeedBasis = 'advertised'): Speed {
  return { kind: 'known', mbps, basis };
}

export function unknownSpeed(reason: UnknownReason = 'not_disclosed'): Speed {
  return { kind: 'unknown', reason };
}

export const DataAllowance = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unlimited') }).strict(),
  z.object({ kind: z.literal('capped'), gigabytes: z.number().positive() }).strict(),
  z.object({ kind: z.literal('unknown'), reason: UnknownReason }).strict(),
]);
export type DataAllowance = z.infer<typeof DataAllowance>;

export const ContractTerm = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z
    .object({
      kind: z.literal('term'),
      months: z.number().int().positive(),
      earlyTerminationFee: Money,
    })
    .strict(),
  z.object({ kind: z.literal('unknown'), reason: UnknownReason }).strict(),
]);
export type ContractTerm = z.infer<typeof ContractTerm>;
