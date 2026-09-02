import { redactText, redactValue } from './redaction.js';

/**
 * Typed application error. `code` is a stable machine-readable identifier; `safeMetadata` may
 * only contain values that are safe to expose in public API responses and logs. Anything
 * sensitive belongs in `cause`, which is never serialized for clients.
 */
export type ErrorCode =
  | 'config_invalid'
  | 'database_unavailable'
  | 'queue_unavailable'
  | 'not_found'
  | 'invalid_request'
  | 'internal';

export interface SafeErrorShape {
  readonly code: ErrorCode;
  readonly message: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export class AppError extends Error {
  override readonly name = 'AppError';
  readonly code: ErrorCode;
  readonly safeMetadata: Readonly<Record<string, string | number | boolean>>;
  readonly httpStatus: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      readonly httpStatus?: number;
      readonly safeMetadata?: Readonly<Record<string, string | number | boolean>>;
      readonly cause?: unknown;
    } = {},
  ) {
    super(redactText(message), options.cause === undefined ? undefined : { cause: options.cause });
    this.code = code;
    this.httpStatus = options.httpStatus ?? defaultStatus(code);
    this.safeMetadata = options.safeMetadata ?? {};
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'not_found':
      return 404;
    case 'database_unavailable':
    case 'queue_unavailable':
      return 503;
    case 'config_invalid':
    case 'internal':
      return 500;
  }
}

/**
 * Convert any thrown value into a shape that is safe for a public API response. Unknown errors
 * collapse to a generic `internal` message: their text may contain provider payloads.
 */
export function toSafeError(error: unknown, correlationId?: string): SafeErrorShape {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(correlationId ? { correlationId } : {}),
      ...(Object.keys(error.safeMetadata).length > 0 ? { metadata: error.safeMetadata } : {}),
    };
  }
  return {
    code: 'internal',
    message: 'An internal error occurred.',
    ...(correlationId ? { correlationId } : {}),
  };
}

/** Log-oriented serialization: keeps name/stack (redacted) for operators, never raw payloads. */
export function toLoggableError(error: unknown): unknown {
  if (error instanceof AppError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      metadata: error.safeMetadata,
      ...(error.stack ? { stack: redactText(error.stack) } : {}),
      ...(error.cause !== undefined ? { cause: redactValue(error.cause) } : {}),
    };
  }
  return redactValue(error);
}
