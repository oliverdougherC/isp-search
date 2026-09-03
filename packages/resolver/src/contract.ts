import { StructuredAddress, type ResolvedAddress } from '@isp-search/domain';
import { z } from 'zod';

/**
 * AddressResolver contract (ADR-002, PLA-363). The application owns this interface; vendor
 * request/response shapes stay inside the adapter that talks to the vendor. Ambiguity, missing
 * units, and invalid input are expressed through `ResolvedAddress.validationState`, not
 * exceptions; exceptions are reserved for the resolver itself being unusable.
 */

export const ResolveInput = z
  .object({
    line1: z.string().min(1).max(200),
    /** User-entered unit, preserved verbatim; the application owns it (ADR-002 §5). */
    unit: z.string().min(1).max(40).nullable(),
    city: z.string().min(1).max(100),
    region: StructuredAddress.shape.region,
    postalCode: StructuredAddress.shape.postalCode,
    /** Present when the user resolved an earlier ambiguity by picking a candidate. */
    selectedCandidateId: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ResolveInput = z.infer<typeof ResolveInput>;

export interface ResolverContext {
  readonly now: () => Date;
}

export interface AddressResolver {
  readonly id: string;
  readonly version: string;
  resolve(input: ResolveInput, context: ResolverContext): Promise<ResolvedAddress>;
}

export type ResolverFailure =
  'disabled' | 'not_configured' | 'timeout' | 'rate_limited' | 'upstream_error';

/** The resolver could not run at all. Message is a typed code; never input-derived text. */
export class ResolverUnavailableError extends Error {
  override readonly name = 'ResolverUnavailableError';
  readonly reason: ResolverFailure;
  constructor(reason: ResolverFailure) {
    super(`address resolver unavailable: ${reason}`);
    this.reason = reason;
  }
}
