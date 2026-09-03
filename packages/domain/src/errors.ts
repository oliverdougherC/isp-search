import { z } from 'zod';

/**
 * Safe public API errors (PLA-360/368). The public surface exposes a typed code, a fixed safe
 * message, and retryability — never stack traces, vendor payloads, or anything derived from
 * the submitted address.
 */

export const PublicErrorCode = z.enum([
  'invalid_request',
  'not_found',
  'expired',
  'rate_limited',
  'payload_too_large',
  'action_not_allowed',
  'conflict',
  'unsupported_market',
  'internal',
]);
export type PublicErrorCode = z.infer<typeof PublicErrorCode>;

export const PublicApiError = z
  .object({
    schemaVersion: z.literal(1),
    code: PublicErrorCode,
    /** Fixed, human-readable, address-free description. */
    message: z.string().min(1).max(300),
    retryable: z.boolean(),
  })
  .strict();
export type PublicApiError = z.infer<typeof PublicApiError>;

const MESSAGES: Readonly<Record<PublicErrorCode, { message: string; retryable: boolean }>> = {
  invalid_request: { message: 'The request was malformed or failed validation.', retryable: false },
  not_found: { message: 'No such search exists or it is no longer accessible.', retryable: false },
  expired: { message: 'This search has expired. Start a new search.', retryable: false },
  rate_limited: { message: 'Too many requests. Slow down and retry shortly.', retryable: true },
  payload_too_large: { message: 'The request body exceeds the allowed size.', retryable: false },
  action_not_allowed: {
    message: 'This action is not valid for the current search state.',
    retryable: false,
  },
  conflict: {
    message: 'The request conflicts with a newer change. Re-read and retry.',
    retryable: true,
  },
  unsupported_market: {
    message: 'This address is outside the supported launch markets.',
    retryable: false,
  },
  internal: { message: 'Something went wrong on our side.', retryable: true },
};

export function publicApiError(code: PublicErrorCode): PublicApiError {
  const entry = MESSAGES[code];
  return { schemaVersion: 1, code, message: entry.message, retryable: entry.retryable };
}
